/**
 * Branded email templates — pure assertions, zero setup.
 *
 * These tests do three jobs:
 *  1. Lock the EMAIL-CLIENT contract (tables, inline CSS, 600px, preheader,
 *     dark mode, plain-text alternative, no external assets, no script).
 *  2. Mechanise TASTE where it can be mechanised — the type budget, inline
 *     line-height on every text element, tabular figures on money.
 *  3. Prove the SAFETY properties: hostile input is neutralised, and the
 *     chokepoint never produces a blank or missing notification.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  EVENT_PRESENTERS,
  TYPE,
  connectorHealthEmail,
  dailySalesEmail,
  derivePreheader,
  escapeHtml,
  genericContent,
  lowStockEmail,
  parseTextBlocks,
  renderEmail,
  renderNotificationEmail,
  safeUrl,
  teamChangeEmail,
  voidAlertEmail,
  voidAlertTestEmail,
  weeklyBriefEmail,
  wrapText,
  type BuiltEmail,
  type EmailBrand,
  type EmailContent,
} from '../email-templates';
import { AROS_BRAND } from '../email-brand';
import { NOTIFICATION_CATALOG } from '../notifications';
import { formatDailySales, formatLowStock, formatWeeklyBrief } from '../digest-email';

const B: EmailBrand = AROS_BRAND;
const STORE = 'Party Liquor';

const VOID_FACTS = {
  storeName: STORE,
  invoiceNo: 'INV-4482',
  amount: 42.0,
  timestamp: 'Jul 22, 2026 · 9:41 PM',
  businessDate: '2026-07-22',
  cashier: 'Ravi P.',
};

const DIGEST = {
  period_end: '2026-07-20',
  digest: {
    period: { end: '2026-07-20', window_days: 7 },
    reorder: [
      { name: 'MICHELOB ULTRA 12 CAN', qty_on_hand: 0, stock_status: 'out_of_stock', suggested_qty: 23, est_reorder_cost: 316.71 },
      { name: 'TITOS HANDMADE VODKA 750', qty_on_hand: 3, stock_status: 'low', suggested_qty: 12 },
    ],
    attach: [
      { name_a: 'LIBERTY CREEK MOSCATO 1.5', name_b: 'LIBERTY CREEK PINOT NOIR 1.5', together: 33, attach_rate: 0.917 },
    ],
    notes: [],
  },
};

const LOW_STOCK = [
  { name: 'TITOS HANDMADE VODKA 750', current: 3, threshold: 12 },
  { name: 'ICE 10LB BAG', current: 6, threshold: 24 },
];

/** Every bespoke builder, rendered once. */
const BUILT: Record<string, BuiltEmail> = {
  voidAlert: voidAlertEmail(VOID_FACTS, B),
  voidAlertTest: voidAlertTestEmail(STORE, 'email', B),
  weeklyBrief: weeklyBriefEmail(STORE, DIGEST, B)!,
  dailySales: dailySalesEmail(STORE, '2026-07-22', { revenue: 4218.75, transactions: 197 }, B)!,
  lowStock: lowStockEmail(STORE, LOW_STOCK, B)!,
  connectorHealth: connectorHealthEmail({
    storeName: STORE,
    connectorLabel: 'RapidRMS',
    issue: 'The last three sync attempts were rejected.',
    detectedAt: 'Jul 22, 2026 · 6:12 AM',
    lastSyncAt: 'Jul 21, 2026 · 11:47 PM',
  }, B),
  teamChange: teamChangeEmail({
    action: 'invited',
    summary: 'ravi@partyliquor.com was invited to the workspace as an admin.',
    workspaceName: STORE,
    personEmail: 'ravi@partyliquor.com',
    role: 'admin',
  }, B),
  fallback: {
    subject: 'Your report is ready',
    ...renderNotificationEmail('an-event-with-no-template', 'Your report is ready', 'The report finished.', B),
  },
};

/** The body only — the <style> block holds responsive overrides that are not
 *  part of the inline type budget. */
const bodyOf = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, '');
const styleOf = (html: string) => /<style[^>]*>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';

// ══════════════════════════════════════════════════════════════════════════
// The shell contract
// ══════════════════════════════════════════════════════════════════════════

describe('renderEmail — shell contract', () => {
  const sample: EmailContent = {
    title: 'A transaction was voided',
    eyebrow: 'Voided transaction',
    preheader: 'Forty-two dollars voided at Party Liquor.',
    contextLabel: STORE,
    blocks: [
      { kind: 'metricRow', items: [{ label: 'Void amount', value: '$42.00', caption: 'Tonight' }] },
      { kind: 'keyValue', rows: [{ label: 'Invoice', value: 'INV-4482', mono: true }] },
      { kind: 'cta', label: 'Review', href: 'https://app.aros.live/dashboard' },
    ],
  };
  const { html, text } = renderEmail(sample, B);

  it('emits the wordmark, signature and manage-notifications link', () => {
    expect(html).toContain(`>${B.wordmark}<`);
    expect(html).toContain(B.signature);
    expect(html).toContain(`href="${B.manageUrl}"`);
    expect(html).toContain('Manage notifications');
    expect(text).toContain(B.signature);
    expect(text).toContain(`Manage notifications: ${B.manageUrl}`);
  });

  it('renders a hidden preheader before any visible content', () => {
    const preheader = /class="em-preheader"[^>]*style="([^"]*)"[^>]*>([^&<]*)/.exec(html);
    expect(preheader).not.toBeNull();
    expect(preheader![1]).toContain('display:none');
    expect(preheader![1]).toContain('mso-hide:all');
    expect(preheader![2]).toBe(sample.preheader);
    // It must precede the first visible element in the body, not merely exist.
    expect(html.indexOf('em-preheader')).toBeLessThan(html.indexOf('<table role="presentation" class="em-canvas"'));
  });

  it('uses a 600px table shell, not flex or grid', () => {
    expect(html).toContain('width:600px;max-width:600px;');
    expect(html).toContain('<table role="presentation"');
    expect(html).not.toMatch(/display\s*:\s*(flex|grid)/);
    // Every layout table declares its presentation role.
    const tables = html.match(/<table[^>]*>/g) ?? [];
    expect(tables.length).toBeGreaterThan(5);
    for (const tag of tables) expect(tag).toContain('role="presentation"');
  });

  it('ships a dark-mode block and avoids pure black or white ink', () => {
    expect(html).toContain('@media (prefers-color-scheme: dark)');
    expect(html).toContain('prefers-color-scheme');
    expect(html).toContain('[data-ogsc]');
    expect(B.dark.ink.toUpperCase()).not.toBe('#FFFFFF');
    expect(B.light.ink.toUpperCase()).not.toBe('#000000');
    expect(B.dark.canvas.toUpperCase()).not.toBe('#000000');
  });

  it('keeps the <style> block to @media rules only, so stripping it is safe', () => {
    const style = styleOf(html);
    let depth = 0;
    let topLevel = '';
    for (const ch of style) {
      if (ch === '{') { depth += 1; continue; }
      if (ch === '}') { depth -= 1; continue; }
      if (depth === 0) topLevel += ch;
    }
    // Removing the @media preludes must leave nothing but whitespace.
    expect(topLevel.replace(/@media[^{]*/g, '').trim()).toBe('');
  });

  it('has no script, no external images, no external stylesheets, no JS handlers', () => {
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<link');
    expect(html).not.toMatch(/<img[^>]+src=/i);
    expect(html).not.toMatch(/src\s*=\s*"https?:/i);
    expect(html).not.toMatch(/\son(click|load|error|mouseover)\s*=/i);
    expect(html).not.toContain('@import');
    expect(html).not.toContain('javascript:');
  });

  it('renders a bulletproof CTA (bgcolor cell + mso padding), not a bare anchor', () => {
    expect(html).toContain('mso-padding-alt:14px 28px');
    expect(html).toMatch(/<td class="em-btn"[^>]*bgcolor="[^"]+"/);
    expect(html).toContain('href="https://app.aros.live/dashboard"');
  });

  it('always produces a non-empty plain-text alternative carrying the facts', () => {
    expect(text.length).toBeGreaterThan(80);
    expect(text).not.toContain('<');
    expect(text).toContain('$42.00');
    expect(text).toContain('INV-4482');
    expect(text).toContain('https://app.aros.live/dashboard');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Typography — the mechanised part of the taste
// ══════════════════════════════════════════════════════════════════════════

describe('typography budget', () => {
  it.each(Object.entries(BUILT))('%s uses at most four inline type sizes', (_name, built) => {
    const sizes = [...bodyOf(built.html).matchAll(/font-size:(\d+)px/g)]
      .map((m) => Number(m[1]))
      .filter((n) => n > 1); // 0px/1px are spacers and the hidden preheader
    const distinct = [...new Set(sizes)];
    expect(distinct.length).toBeGreaterThan(0);
    expect(distinct.length).toBeLessThanOrEqual(4);
    for (const size of distinct) expect(Object.values(TYPE)).toContain(size);
  });

  it.each(Object.entries(BUILT))('%s sets line-height inline wherever it sets font-size', (_name, built) => {
    const declarations = [...bodyOf(built.html).matchAll(/style="([^"]*font-size:[^"]*)"/g)].map((m) => m[1]);
    expect(declarations.length).toBeGreaterThan(0);
    for (const decl of declarations) expect(decl).toMatch(/line-height:/);
  });

  it.each(Object.entries(BUILT))('%s pins line-height for Outlook (mso-line-height-rule)', (_name, built) => {
    expect(built.html).toContain('mso-line-height-rule:exactly');
  });

  it('gives the hero metric tabular figures and tight tracking', () => {
    const html = BUILT.voidAlert.html;
    expect(html).toMatch(new RegExp(`font-size:${TYPE.display}px[^"]*letter-spacing:-0\\.02em`));
    expect(html).toContain('font-variant-numeric:tabular-nums');
  });

  it('tracks out small uppercase labels and only those', () => {
    const html = BUILT.voidAlert.html;
    expect(html).toMatch(new RegExp(`font-size:${TYPE.label}px[^"]*letter-spacing:0\\.08em;text-transform:uppercase`));
    // Large display text gets negative tracking, never positive.
    expect(html).not.toMatch(new RegExp(`font-size:${TYPE.display}px[^"]*letter-spacing:0\\.`));
  });

  it('holds a readable measure in the plain-text alternative', () => {
    for (const built of Object.values(BUILT)) {
      const overlong = built.text.split('\n').filter((l) => l.length > 78 && !/https?:\/\//.test(l));
      expect(overlong).toEqual([]);
    }
  });

  it('wrapText never splits a token longer than the measure', () => {
    const url = 'https://app.aros.live/a-very-long-path-that-exceeds-the-measure-by-a-lot';
    expect(wrapText(`See ${url} now`, 40)).toContain(url);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Per-event builders
// ══════════════════════════════════════════════════════════════════════════

describe('per-event builders', () => {
  it.each(Object.entries(BUILT))('%s returns a non-empty subject, text and html', (_name, built) => {
    expect(built.subject.trim().length).toBeGreaterThan(0);
    expect(built.text.trim().length).toBeGreaterThan(0);
    expect(built.html.trim().length).toBeGreaterThan(0);
    expect(built.html).toContain('<!DOCTYPE html>');
  });

  it('void alert states the amount, invoice, time and cashier in both parts', () => {
    const { html, text, subject } = BUILT.voidAlert;
    expect(subject).toBe(`Voided transaction at ${STORE}`);
    for (const fact of ['$42.00', 'INV-4482', 'Jul 22, 2026 · 9:41 PM', 'Ravi P.', STORE]) {
      expect(text).toContain(fact);
      expect(html).toContain(fact);
    }
  });

  it('void alert wears the alert accent; the test fire wears the quiet one', () => {
    expect(BUILT.voidAlert.html).toContain(`background-color:${B.light.alert}`);
    expect(BUILT.voidAlertTest.html).not.toContain(`background-color:${B.light.alert}`);
    expect(BUILT.voidAlertTest.html).toContain(`background-color:${B.light.quiet}`);
  });

  it('the test fire is unmistakably marked TEST in subject, html and text', () => {
    const { subject, html, text } = BUILT.voidAlertTest;
    expect(subject).toContain('TEST');
    expect(html).toContain('Test — no action needed');
    expect(html).toContain('This is a test');
    expect(text).toContain('THIS IS A TEST');
    expect(text).toContain('No transaction was voided');
  });

  it('weekly brief carries its sections and the period', () => {
    const built = BUILT.weeklyBrief;
    expect(built.subject).toBe(`Weekly Brief — ${STORE} (week ending 2026-07-20)`);
    expect(built.text).toContain('REORDER SUGGESTIONS');
    expect(built.text).toContain('BOUGHT TOGETHER');
    expect(built.text).toContain('MICHELOB ULTRA 12 CAN');
    expect(built.html).toContain('Reorder suggestions');
    expect(built.html).toContain('92% · 33×');
  });

  it('daily sales makes revenue the hero and reports the average ticket', () => {
    const { html, text, subject } = BUILT.dailySales;
    expect(subject).toContain('$4218.75');
    expect(html).toContain('$4218.75');
    expect(text).toContain('REVENUE');
    expect(text).toContain('AVERAGE TICKET');
    expect(text).toContain('$21.41'); // 4218.75 / 197
  });

  it('low stock lists items with on-hand / reorder detail', () => {
    expect(BUILT.lowStock.text).toContain('TITOS HANDMADE VODKA 750 — 3 / 12');
    expect(BUILT.lowStock.html).toContain('ICE 10LB BAG');
  });

  it('connector health explains the impact and links the fix', () => {
    expect(BUILT.connectorHealth.subject).toContain('stopped syncing');
    expect(BUILT.connectorHealth.html).toContain(`${B.appUrl}/connections`);
    expect(BUILT.connectorHealth.text).toContain('rejected');
  });

  it('team change names the person and the role', () => {
    expect(BUILT.teamChange.text).toContain('ravi@partyliquor.com');
    expect(BUILT.teamChange.text).toContain('admin');
    expect(BUILT.teamChange.html).toContain(`${B.appUrl}/admin/team`);
  });

  it('keeps every CTA on the brand host', () => {
    for (const built of Object.values(BUILT)) {
      for (const href of [...built.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])) {
        expect(href.startsWith(B.appUrl)).toBe(true);
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Parity with the plain-text formatters that shipped first
// ══════════════════════════════════════════════════════════════════════════

describe('parity with the existing plain-text formatters', () => {
  it('keeps subjects byte-identical so inbox threading does not change', () => {
    expect(BUILT.dailySales.subject).toBe(formatDailySales(STORE, '2026-07-22', { revenue: 4218.75, transactions: 197 })!.subject);
    expect(BUILT.lowStock.subject).toBe(formatLowStock(STORE, LOW_STOCK)!.subject);
    expect(BUILT.weeklyBrief.subject).toBe(formatWeeklyBrief(STORE, DIGEST as never)!.subject);
  });

  it('keeps the null semantics: nothing to say means nothing is sent', () => {
    expect(dailySalesEmail(STORE, '2026-07-22', null, B)).toBeNull();
    expect(formatDailySales(STORE, '2026-07-22', null)).toBeNull();
    expect(lowStockEmail(STORE, [], B)).toBeNull();
    expect(formatLowStock(STORE, [])).toBeNull();
    const emptyDigest = { period_end: '2026-07-20', digest: { period: { end: '2026-07-20' }, reorder: [], attach: [] } };
    expect(weeklyBriefEmail(STORE, emptyDigest, B)).toBeNull();
    expect(formatWeeklyBrief(STORE, emptyDigest as never)).toBeNull();
    expect(weeklyBriefEmail(STORE, { digest: null }, B)).toBeNull();
  });

  it('reports the same period so the send-once dedupe still works', () => {
    expect(weeklyBriefEmail(STORE, DIGEST, B)!.periodEnd).toBe(formatWeeklyBrief(STORE, DIGEST as never)!.periodEnd);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Hostile input
// ══════════════════════════════════════════════════════════════════════════

describe('escaping and href safety', () => {
  const XSS = '<script>alert(1)</script>';
  const BREAKOUT = '" onload="alert(1)';

  it('escapes angle brackets, quotes and ampersands', () => {
    expect(escapeHtml(XSS)).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escapeHtml(BREAKOUT)).toBe('&quot; onload=&quot;alert(1)');
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('neutralises hostile content anywhere in the block vocabulary', () => {
    const { html } = renderEmail({
      title: XSS,
      preheader: BREAKOUT,
      eyebrow: XSS,
      contextLabel: BREAKOUT,
      blocks: [
        { kind: 'paragraph', text: XSS },
        { kind: 'heading', text: XSS, eyebrow: BREAKOUT },
        { kind: 'metricRow', items: [{ label: XSS, value: BREAKOUT, caption: XSS }] },
        { kind: 'keyValue', rows: [{ label: XSS, value: BREAKOUT, mono: true }] },
        { kind: 'list', items: [{ text: XSS, detail: BREAKOUT }], more: XSS },
        { kind: 'callout', eyebrow: XSS, title: BREAKOUT, lines: [XSS] },
        { kind: 'cta', label: XSS, href: 'https://app.aros.live/x' },
        { kind: 'note', text: BREAKOUT },
      ],
    }, B);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('</script>');
    // A breakout would close an attribute and start a new one; the escaped
    // form keeps the quote as an entity, so no `" on…=` pair can appear.
    expect(html).not.toMatch(/"\s*on[a-z]+\s*=/i);
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot; onload=&quot;');
  });

  it('refuses non-http hrefs and falls back to the brand app URL', () => {
    expect(safeUrl('javascript:alert(1)', B)).toBe(B.appUrl);
    expect(safeUrl('data:text/html,<script>alert(1)</script>', B)).toBe(B.appUrl);
    expect(safeUrl('  ', B)).toBe(B.appUrl);
    expect(safeUrl('https://app.aros.live/ok', B)).toBe('https://app.aros.live/ok');
    expect(safeUrl('mailto:help@aros.live', B)).toBe('mailto:help@aros.live');
  });

  it('drops a javascript: CTA out of the rendered html entirely', () => {
    const { html } = renderEmail({
      title: 'Hostile CTA',
      preheader: 'x',
      blocks: [{ kind: 'cta', label: 'Click', href: 'javascript:alert(1)' }],
    }, B);
    expect(html).not.toContain('javascript:');
    expect(html).toContain(`href="${B.appUrl}"`);
  });

  it('survives pathological input lengths without breaking the shell', () => {
    const long = 'Ω'.repeat(4000);
    const { html, text } = renderEmail({
      title: long,
      preheader: long,
      blocks: [
        { kind: 'paragraph', text: long },
        { kind: 'keyValue', rows: [{ label: long, value: long }] },
        { kind: 'list', items: Array.from({ length: 300 }, (_, i) => ({ text: `Item ${i}`, detail: `${i}` })) },
      ],
    }, B);
    expect(html).toContain('width:600px;max-width:600px;');
    expect(html).toContain('</html>');
    expect(text.length).toBeGreaterThan(0);
    expect(derivePreheader(long, 'fallback').length).toBeLessThanOrEqual(140);
  });

  it('never emits an empty subject or body from the chokepoint', () => {
    const rendered = renderNotificationEmail('unknown-event', '', '', B);
    expect(rendered.html).toContain('</html>');
    expect(rendered.text.trim().length).toBeGreaterThan(0);
    expect(genericContent('', '').blocks.length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// The chokepoint map
// ══════════════════════════════════════════════════════════════════════════

describe('event → template map', () => {
  it('covers every notification event in the catalog', () => {
    const covered = Object.keys(EVENT_PRESENTERS);
    for (const event of NOTIFICATION_CATALOG) {
      expect(covered, `no presenter for "${event.id}"`).toContain(event.id);
    }
  });

  it('renders every catalog event without throwing', () => {
    for (const event of NOTIFICATION_CATALOG) {
      const rendered = renderNotificationEmail(event.id, `${event.label} for ${STORE}`, `${event.description}\n\nOpen AROS: ${B.appUrl}/dashboard`, B);
      expect(rendered.html).toContain('</html>');
      expect(rendered.text).toContain(B.signature);
    }
  });

  it('falls back for an unmapped event rather than failing', () => {
    const rendered = renderNotificationEmail('event-invented-tomorrow', 'Something happened', 'Details here.', B);
    expect(rendered.html).toContain('Something happened');
    expect(rendered.text).toContain('Details here.');
  });

  it('marks a TEST void alert differently from a real one through the map', () => {
    const test = EVENT_PRESENTERS['void-alert']('TEST — your void alert is live', 'No transaction was voided.');
    const real = EVENT_PRESENTERS['void-alert']('Voided transaction at Party Liquor', 'A void happened.');
    expect(test.accent).toBe('test');
    expect(real.accent).toBe('alert');
  });

  it('structures known plain-text shapes into real blocks', () => {
    const blocks = parseTextBlocks('LOW STOCK\n• Titos 750 — 3 on hand\n• Ice 10lb — 6 on hand\n\nReview inventory: https://app.aros.live/dashboard');
    expect(blocks.some((b) => b.kind === 'heading')).toBe(true);
    expect(blocks.some((b) => b.kind === 'list')).toBe(true);
    expect(blocks.some((b) => b.kind === 'cta')).toBe(true);
  });

  it('leaves unrecognised text as paragraphs rather than mangling it', () => {
    const blocks = parseTextBlocks('Just one ordinary sentence about a store.');
    expect(blocks).toEqual([{ kind: 'paragraph', text: 'Just one ordinary sentence about a store.' }]);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Portability — the module must carry no product identity of its own
// ══════════════════════════════════════════════════════════════════════════

describe('portability', () => {
  const SOURCE = readFileSync(fileURLToPath(new URL('../email-templates.ts', import.meta.url)), 'utf8');

  it('contains no product-specific literal — name, host or brand colour', () => {
    expect(SOURCE).not.toMatch(/aros/i);
    expect(SOURCE).not.toMatch(/\.live\b/);
    for (const hex of [B.light.accent, B.light.canvas, B.light.ink, B.light.muted, B.light.hairline, B.dark.canvas]) {
      expect(SOURCE.toUpperCase()).not.toContain(hex.toUpperCase());
    }
  });

  it('imports nothing at all, so it can move to a shared package unchanged', () => {
    expect(SOURCE).not.toMatch(/^\s*import\s/m);
    expect(SOURCE).not.toMatch(/\brequire\(/);
    expect(SOURCE).not.toContain('process.env');
  });

  it('renders a different product correctly when handed different tokens', () => {
    const other: EmailBrand = {
      ...B,
      productName: 'Northwind',
      wordmark: 'NORTHWIND',
      senderName: 'Northwind',
      replyTo: 'support@northwind.example',
      appUrl: 'https://app.northwind.example',
      manageUrl: 'https://app.northwind.example/settings',
      signature: '— Northwind',
      footerNote: 'Sent because Northwind alerts are on.',
      light: { ...B.light, accent: '#2F5D50', accentLink: '#1F4238' },
    };
    const built = voidAlertEmail(VOID_FACTS, other);
    expect(built.html).toContain('NORTHWIND');
    expect(built.html).toContain('https://app.northwind.example/dashboard');
    expect(built.html).toContain('#2F5D50');
    expect(built.html).not.toContain('aros.live');
    expect(built.html).not.toContain(B.light.accent);
    expect(built.text).toContain('— Northwind');
  });

  it('exposes Reply-To as a brand field instead of hardcoding one', () => {
    expect(AROS_BRAND).toHaveProperty('replyTo');
    expect(typeof AROS_BRAND.replyTo).toBe('string');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// The shell wiring — structural, because notifyWorkspace is I/O
// ══════════════════════════════════════════════════════════════════════════

describe('notifyWorkspace wiring', () => {
  const SERVER = readFileSync(fileURLToPath(new URL('../server.ts', import.meta.url)), 'utf8');

  it('passes an html part alongside the text part', () => {
    expect(SERVER).toContain('sendEmail(to, subject, body.text, body.html');
  });

  it('guards template rendering and falls back to the pre-template body', () => {
    const guard = /function renderNotificationBody\([\s\S]*?\n}/.exec(SERVER)?.[0] ?? '';
    expect(guard).toContain('try {');
    expect(guard).toContain('catch');
    expect(guard).toContain('legacyEmailBody(text)');
  });

  it('keeps the SMS lane on the original one-sentence text', () => {
    expect(SERVER).toContain("text.split('\\n')[0]");
  });

  it('builds rich content lazily so a throwing builder cannot fail the caller', () => {
    expect(SERVER).toMatch(/content\?:\s*\(\)\s*=>\s*EmailContent/);
    expect(SERVER).toContain('() => voidAlertContent(');
    expect(SERVER).toContain('() => voidAlertTestContent(');
    expect(SERVER).toContain('() => dailySalesContent(');
    expect(SERVER).toContain('() => lowStockContent(');
    expect(SERVER).toContain('() => weeklyBriefContent(');
    expect(SERVER).toContain('() => teamChangeContent(');
  });
});
