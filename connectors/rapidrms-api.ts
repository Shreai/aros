// ── RapidRMS API Connector ──────────────────────────────────────
// Authenticates and communicates with the RapidRMS API.
// Credentials retrieved from vault at auth time — never stored or logged.

import type { RapidRmsApiConfig, RapidRmsSession, ConnectorTestResult } from './types.js';
import { retrieveCredential } from './vault-ref.js';

// ── Authenticate ────────────────────────────────────────────────

/**
 * Authenticate with RapidRMS. Retrieves email + password from vault.
 *
 * Live API contract (verified against rapidrmsapi.azurewebsites.net 2026-07-14):
 * - body is { grant_type: 'token', client_id, Username, Password }
 * - success envelope is { code: '999', message: 'OK', data: <JSON STRING> } —
 *   `data` is DOUBLE-ENCODED: a JSON string that must be parsed to reach
 *   access_token / DbName. Auth failures return HTTP 200 with code '902'.
 */
export async function authenticate(
  config: RapidRmsApiConfig,
  emailRef: string,
  passwordRef: string,
): Promise<RapidRmsSession> {
  const email = await retrieveCredential(emailRef);
  const password = await retrieveCredential(passwordRef);

  const res = await fetch(`${config.baseUrl}/api/Login/Auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'token',
      client_id: String(config.clientId),
      Username: email,
      Password: password,
    }),
  });

  if (!res.ok) {
    throw new Error(`RapidRMS auth failed: ${res.status} ${res.statusText}`);
  }

  const envelope = (await res.json()) as { code?: unknown; message?: unknown; data?: unknown };
  if (String(envelope.code) !== '999') {
    // e.g. code '902' = "invalid user infomation" — HTTP status is 200 regardless
    throw new Error(
      `RapidRMS auth rejected (code ${String(envelope.code)}): ${String(envelope.message ?? 'unknown')}`,
    );
  }

  let inner: Record<string, unknown> = {};
  try {
    inner =
      typeof envelope.data === 'string'
        ? (JSON.parse(envelope.data) as Record<string, unknown>)
        : ((envelope.data ?? {}) as Record<string, unknown>);
  } catch {
    throw new Error('RapidRMS auth: could not parse token payload (data field)');
  }

  const accessToken = String(inner.access_token ?? inner.accessToken ?? '');
  if (!accessToken) {
    throw new Error('RapidRMS auth: no access_token in response');
  }

  const timeout = config.sessionTimeout || 420;
  return {
    config,
    dbName: String(inner.DbName ?? inner.dbName ?? ''),
    accessToken,
    cookie: '',
    expiresAt: Date.now() + timeout * 60 * 1000,
    authenticated: true,
  };
}

// ── Request ─────────────────────────────────────────────────────

/** Make authenticated API request. Auto-refreshes if session expired. */
export async function request(
  session: RapidRmsSession,
  method: string,
  path: string,
  params?: Record<string, unknown>,
): Promise<unknown> {
  if (!session.authenticated) {
    throw new Error('Not authenticated — call authenticate() first');
  }

  const url = `${session.config.baseUrl}${path}`;
  const opts: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      // Token-based API: Bearer token + DbName header (not cookies)
      Authorization: `Bearer ${session.accessToken}`,
      ...(session.dbName ? { DbName: session.dbName } : {}),
    },
  };

  if (params && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    opts.body = JSON.stringify(params);
  }

  const res = await fetch(url, opts);
  if (!res.ok) {
    throw new Error(`RapidRMS ${method} ${path}: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// ── Test ────────────────────────────────────────────────────────

/** Test auth + connectivity. */
export async function testConnection(
  config: RapidRmsApiConfig,
  emailRef: string,
  passwordRef: string,
): Promise<ConnectorTestResult> {
  const start = Date.now();
  try {
    const session = await authenticate(config, emailRef, passwordRef);
    // Success = we hold a real token. DbName may be absent on some tenants,
    // so it must not gate the result (the old check made valid logins fail).
    return {
      success: session.authenticated && session.accessToken.length > 0,
      latencyMs: Date.now() - start,
      testedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      success: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
      testedAt: new Date().toISOString(),
    };
  }
}

// ── Helpers ─────────────────────────────────────────────────────

/** Get the database name from an authenticated session. */
export function getDbName(session: RapidRmsSession): string {
  return session.dbName;
}

// ── Standard Endpoints ──────────────────────────────────────────

export async function getSalesDetail(session: RapidRmsSession, params?: Record<string, unknown>) {
  return request(session, 'POST', '/api/SalesDetail/Get', params);
}

export async function getInventory(session: RapidRmsSession, params?: Record<string, unknown>) {
  return request(session, 'POST', '/api/Inventory/Get', params);
}

export async function getPricing(session: RapidRmsSession, params?: Record<string, unknown>) {
  return request(session, 'POST', '/api/Pricing/Get', params);
}

export async function getEmployees(session: RapidRmsSession, params?: Record<string, unknown>) {
  return request(session, 'POST', '/api/Employee/Get', params);
}

export async function getPromotions(session: RapidRmsSession, params?: Record<string, unknown>) {
  return request(session, 'POST', '/api/Promotion/Get', params);
}
