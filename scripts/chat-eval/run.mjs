#!/usr/bin/env node
// Chat eval harness — imperative shell.
//
// Runs the battery.json question set against /v1/chat for one or many
// workspaces, scores replies against live ground truth (core.mjs), and writes
// JSONL + markdown reports. Exits non-zero when the aggregate pass rate is
// below CHAT_EVAL_MIN_PASS (default 0.7) so it can gate deploys.
//
// Modes:
//   node run.mjs --email x --password y            one account (or CHAT_EVAL_EMAIL/PASSWORD)
//   node run.mjs --accounts accounts.json          list of {email,password,name?}
//   node run.mjs --all                             every active workspace owner, via
//                                                  Supabase admin magiclink mint (needs
//                                                  SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY;
//                                                  run on the VPS where .env has them)
// Options:
//   --base https://app.aros.live   target deployment (default)
//   --out  reports/                output dir (default scripts/chat-eval/reports)
//   --judge                        also score with an LLM judge via the shre gateway
//                                  (JUDGE_BASE_URL, JUDGE_API_KEY, JUDGE_MODEL)

import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { scoreReply, aggregate, renderReport } from './core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));
const BASE = args.base ?? process.env.CHAT_EVAL_BASE ?? 'https://app.aros.live';
const OUT = args.out ?? join(HERE, 'reports');
const MIN_PASS = Number(process.env.CHAT_EVAL_MIN_PASS ?? '0.7');
const BATTERY = JSON.parse(readFileSync(join(HERE, 'battery.json'), 'utf8')).questions;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { out[key] = next; i++; } else { out[key] = true; }
  }
  return out;
}

async function api(path, { token, tenantId, method = 'GET', body, timeoutMs = 60_000 } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { 'x-aros-tenant-id': tenantId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* non-JSON (e.g. edge 502) */ }
  return { status: res.status, data, text };
}

async function loginPassword(email, password) {
  const { status, data } = await api('/api/login', { method: 'POST', body: { email, password } });
  if (status !== 200 || !data?.session?.access_token) throw new Error(`login failed for ${email}: HTTP ${status}`);
  return data.session.access_token;
}

// ── all-workspaces mode: enumerate tenants + mint sessions via Supabase admin ──

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('--all needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment');
  return { url: url.replace(/\/$/, ''), key };
}

async function sbFetch(sb, path, init = {}) {
  const res = await fetch(`${sb.url}${path}`, {
    ...init,
    headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`supabase ${path}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

async function listWorkspaces(sb) {
  const tenants = await sbFetch(sb, '/rest/v1/tenants?select=id,name');
  const members = await sbFetch(sb, '/rest/v1/tenant_members?status=eq.active&select=tenant_id,user_id,role,is_default&order=is_default.desc,joined_at.asc');
  const byTenant = new Map();
  for (const m of members) if (!byTenant.has(m.tenant_id) || (m.role === 'owner' && byTenant.get(m.tenant_id).role !== 'owner')) byTenant.set(m.tenant_id, m);
  const out = [];
  for (const t of tenants) {
    const m = byTenant.get(t.id);
    if (!m) continue;
    const user = await sbFetch(sb, `/auth/v1/admin/users/${m.user_id}`);
    if (user?.email) out.push({ tenantId: t.id, name: t.name, email: user.email, userId: m.user_id });
  }
  return out;
}

/** Mint a real user session without a password: admin magiclink -> verify token_hash. */
async function mintSession(sb, email) {
  const link = await sbFetch(sb, '/auth/v1/admin/generate_link', {
    method: 'POST',
    body: JSON.stringify({ type: 'magiclink', email }),
  });
  const tokenHash = link.hashed_token ?? link.properties?.hashed_token;
  if (!tokenHash) throw new Error(`generate_link for ${email} returned no hashed_token`);
  const verified = await sbFetch(sb, '/auth/v1/verify', {
    method: 'POST',
    body: JSON.stringify({ type: 'magiclink', token_hash: tokenHash }),
  });
  const token = verified.access_token ?? verified.session?.access_token;
  if (!token) throw new Error(`verify for ${email} returned no access_token`);
  return token;
}

// ── ground truth + battery ──

async function fetchGroundTruth(token, tenantId) {
  const gt = { summary: null, lowStockNames: [], connectorNames: [] };
  const s = await api('/api/store/summary', { token, tenantId });
  if (s.status === 200 && s.data?.summary) {
    gt.summary = s.data.summary;
    gt.lowStockNames = (s.data.summary.lowStock?.items ?? []).map((i) => i.name).filter(Boolean);
  }
  const c = await api('/api/connectors', { token, tenantId });
  if (c.status === 200 && Array.isArray(c.data?.connectors)) {
    gt.connectorNames = c.data.connectors.filter((x) => x.status === 'connected').map((x) => x.name).filter(Boolean);
  }
  return gt;
}

async function askChat(token, tenantId, content) {
  const started = Date.now();
  try {
    const { status, data, text } = await api('/v1/chat', {
      token, tenantId, method: 'POST', timeoutMs: 120_000,
      body: { agentId: 'aros-agent', tenantId, workspaceId: tenantId, messages: [{ role: 'user', content }], stream: false },
    });
    let reply = data?.response ?? data?.message ?? data?.content ?? text?.slice(0, 4000) ?? null;
    if (reply && typeof reply === 'object') reply = reply.content ?? JSON.stringify(reply);
    return { status, ms: Date.now() - started, reply, err: null };
  } catch (e) {
    return { status: 0, ms: Date.now() - started, reply: null, err: String(e) };
  }
}

async function judgeReply(question, reply, groundTruth) {
  const base = process.env.JUDGE_BASE_URL;
  const key = process.env.JUDGE_API_KEY;
  const model = process.env.JUDGE_MODEL ?? 'shre-70b';
  if (!base || !key) return null;
  const prompt = `You grade a retail-operations assistant's answer. Question: ${question.question}\nGround truth (from the platform's own APIs): ${JSON.stringify(groundTruth).slice(0, 1500)}\nAnswer: ${reply}\nReturn STRICT JSON: {"answered":bool,"grounded":bool,"actionable":bool,"score":1-5,"reason":"<one sentence>"}`;
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0 }),
      signal: AbortSignal.timeout(60_000),
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch { return null; }
}

// ── per-workspace run ──

async function evalWorkspace(ws, token) {
  const tenantId = ws.tenantId ?? null;
  const groundTruth = await fetchGroundTruth(token, tenantId);
  const results = [];
  for (const q of BATTERY) {
    const r = await askChat(token, tenantId ?? groundTruthTenant(groundTruth), q.question);
    results.push({ id: q.id, q: q.question, ...r });
  }
  const scores = [];
  for (const q of BATTERY) {
    const r = results.find((x) => x.id === q.id);
    const s = r.status === 200
      ? scoreReply(q, r.reply, groundTruth, { latencyMs: r.ms })
      : { id: q.id, verdict: 'fail', reasons: [`transport: HTTP ${r.status} ${r.err ?? ''}`.trim()] };
    if (args.judge) s.judge = await judgeReply(q, r.reply, groundTruth);
    scores.push(s);
  }
  return { groundTruth, results, scores, summary: aggregate(scores) };
}

function groundTruthTenant(gt) { return gt?.summary?.source?.tenantId ?? null; }

// ── main ──

const when = new Date().toISOString();
const stamp = when.replace(/[:.]/g, '-').slice(0, 19);
const runDir = join(OUT, stamp);
mkdirSync(runDir, { recursive: true });

let workspaces = [];
if (args.all) {
  const sb = supabaseAdmin();
  workspaces = (await listWorkspaces(sb)).map((w) => ({ ...w, mint: true }));
  console.log(`[chat-eval] ${workspaces.length} workspaces discovered`);
} else if (args.accounts) {
  workspaces = JSON.parse(readFileSync(args.accounts, 'utf8'));
} else {
  const email = args.email ?? process.env.CHAT_EVAL_EMAIL;
  const password = args.password ?? process.env.CHAT_EVAL_PASSWORD;
  if (!email || !password) {
    console.error('Usage: run.mjs --email <e> --password <p> | --accounts <file> | --all');
    process.exit(2);
  }
  workspaces = [{ email, password }];
}

const allSummaries = [];
for (const ws of workspaces) {
  try {
    const token = ws.mint ? await mintSession(supabaseAdmin(), ws.email) : await loginPassword(ws.email, ws.password);
    if (!ws.tenantId) {
      // resolve default tenant from connectors (any row carries tenant_id)
      const c = await api('/api/connectors', { token });
      ws.tenantId = c.data?.connectors?.[0]?.tenant_id ?? null;
    }
    const { results, scores, summary } = await evalWorkspace(ws, token);
    const slug = (ws.name ?? ws.email).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    for (const r of results) appendFileSync(join(runDir, 'results.jsonl'), JSON.stringify({ workspace: ws.email, tenantId: ws.tenantId, when, ...r, score: scores.find((s) => s.id === r.id) }) + '\n');
    writeFileSync(join(runDir, `report-${slug}.md`), renderReport({ workspace: ws, when, results, scores, summary }));
    allSummaries.push({ workspace: ws.email, tenantId: ws.tenantId, name: ws.name, ...summary });
    console.log(`[chat-eval] ${ws.email}: ${summary.pass}/${summary.total} pass, ${summary.fail} fail (${Object.keys(summary.byReason).join(', ') || 'clean'})`);
  } catch (e) {
    allSummaries.push({ workspace: ws.email, error: String(e), total: 0, pass: 0, warn: 0, fail: 0, passRate: 0 });
    console.error(`[chat-eval] ${ws.email}: ERROR ${e}`);
  }
}

const fleet = {
  when, base: BASE,
  workspaces: allSummaries,
  passRate: allSummaries.length ? allSummaries.reduce((a, s) => a + (s.passRate ?? 0), 0) / allSummaries.length : 0,
};
writeFileSync(join(runDir, 'summary.json'), JSON.stringify(fleet, null, 2));
console.log(`[chat-eval] fleet pass rate ${(fleet.passRate * 100).toFixed(0)}% -> ${runDir}`);
process.exit(fleet.passRate >= MIN_PASS ? 0 : 1);
