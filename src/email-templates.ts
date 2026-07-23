/**
 * Branded transactional email templates — pure functional core (no I/O).
 *
 * PORTABLE BY CONSTRUCTION. This file imports nothing: no product modules, no
 * database client, no config singletons, no env reads, no Node built-ins, and
 * it has zero side effects at import time. Everything product-specific (name,
 * URLs, palette, font stacks, reply address) arrives through a REQUIRED
 * `EmailBrand` argument — there is deliberately no default, so a sibling
 * product cannot silently ship another product's colours and links. The
 * concrete token set lives beside this file (see `email-brand.ts`); lifting
 * this module into a shared package is a file move plus an import-path change.
 *
 * Every function is data-in / data-out: give it facts, get back
 * `{ html, text }`. The imperative shell does the sending and owns the failure
 * guard: if anything here throws, the shell falls back to a plain-text send.
 *
 * ── Design contract (email, not web) ──────────────────────────────────────
 * • Table-based layout only (`role="presentation"`), never flex/grid — the
 *   Outlook/Word engine does not implement them.
 * • Every load-bearing style is INLINE on the element. The <style> block holds
 *   ONLY `@media` rules (responsive + dark mode); strip it entirely and the
 *   light email is still complete and correct.
 * • 600px shell, fluid under 480px. No external images, no web fonts as a
 *   requirement, no JS, no external CSS. The wordmark is text + a CSS square.
 * • Always emits a genuine plain-text alternative — not an HTML strip.
 *
 * ── Type system (the primary craft surface) ───────────────────────────────
 * A modular scale with fixed roles, applied INLINE on every text element
 * because Outlook ignores inherited line-height:
 *
 *   32  display   serif, -0.02em,  lh 38px — the hero: a title or a metric
 *   24  title     serif, -0.015em, lh 30px — the subject line, restated
 *   20  section   serif, -0.01em,  lh 26px — section headings
 *   17  lead      sans,  -0.005em, lh 26px — the one sentence that matters
 *   15  body      sans,   0,       lh 24px — body copy, ~1.6
 *   13  label     sans,  +0.08em uppercase — eyebrows, captions, footer
 *
 * Hierarchy comes from weight + colour + space, not size: no single rendered
 * email uses more than FOUR of these roles (mechanically asserted in tests).
 * Measure is held near 62–70 characters by 40px of card padding at 600px.
 * Money, counts and identifiers use the mono stack with tabular figures so a
 * column of numerals reads like a ledger; the hero metric uses the serif with
 * tabular figures and tight tracking. Spacing is a fixed 4/8/12/16/24/32/48
 * rhythm — never an arbitrary value. Fallback families are metric-near
 * (Georgia behind the display serif; Segoe UI/Helvetica behind the system
 * sans) so nothing reflows when the first choice is absent.
 */

// ══════════════════════════════════════════════════════════════════════════
// 1. Brand model — every product-specific value is a parameter, never a literal
// ══════════════════════════════════════════════════════════════════════════

export interface EmailFonts {
  /** Display face: titles and hero metrics. */
  serif: string;
  /** UI/body face. */
  sans: string;
  /** Numerals, identifiers, tabular data. */
  mono: string;
}

export interface EmailPalette {
  canvas: string;
  card: string;
  panel: string;
  ink: string;
  inkSoft: string;
  muted: string;
  hairline: string;
  /** Dots, dividers, quiet rules. */
  rule: string;
  /** The signature accent — used sparingly (a rule, a mark, a link). */
  accent: string;
  /** Accent shifted until link text clears WCAG AA on `canvas`. */
  accentLink: string;
  /** Calm-urgent tone for alert hairlines and callout rules. */
  alert: string;
  /** Neutral tone for TEST bands — deliberately unalarming. */
  quiet: string;
  buttonBg: string;
  buttonInk: string;
}

export interface EmailBrand {
  /** Used in copy, e.g. "your <productName> workspace". */
  productName: string;
  /** Rendered as tracked-out text — never an image. */
  wordmark: string;
  /** From-name the shell should use when sending. Not rendered in the body. */
  senderName: string;
  /**
   * Monitored reply address. Empty string = no Reply-To header, replies go to
   * the sender identity. Set this rather than shipping a bare no-reply@.
   */
  replyTo: string;
  /** Base app URL; every CTA is derived from it. */
  appUrl: string;
  /** Where "Manage notifications" points. */
  manageUrl: string;
  /** Footer signature line. */
  signature: string;
  /** Default "why am I getting this" line. */
  footerNote: string;
  fonts: EmailFonts;
  light: EmailPalette;
  dark: EmailPalette;
}

/** The modular scale. Roles, not sizes — see the module header. */
export const TYPE = {
  display: 32,
  title: 24,
  section: 20,
  lead: 17,
  body: 15,
  label: 13,
} as const;

/** Vertical rhythm. Block padding only ever comes from this set. */
export const SPACE = [4, 8, 12, 16, 24, 32, 48] as const;

/** Utility font sizes that are not typographic roles (spacers, preheader). */
export const NON_TYPE_SIZES = [0, 1] as const;

const CARD_PAD_X = 40;
const SHELL_WIDTH = 600;
const TABULAR = "font-variant-numeric:tabular-nums;-moz-font-feature-settings:'tnum';-webkit-font-feature-settings:'tnum';font-feature-settings:'tnum';";
const EXACT = 'mso-line-height-rule:exactly;';
/** Inlined on every layout table so the <style> block can stay @media-only. */
const TBL = 'border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;';

// ══════════════════════════════════════════════════════════════════════════
// 2. Content model — the composable block vocabulary
// ══════════════════════════════════════════════════════════════════════════

export type AccentTone = 'accent' | 'alert' | 'test' | 'none';
export type CalloutTone = 'neutral' | 'alert' | 'test' | 'accent';

export interface MetricItem {
  /** Small tracked-out uppercase label above the figure. */
  label: string;
  /** The figure itself — pre-formatted (`$42.00`, `128`, `9:41 PM`). */
  value: string;
  /** Optional muted line under the figure. */
  caption?: string;
}

export interface KeyValueRow {
  label: string;
  value: string;
  /** Render the value in the mono/tabular stack (money, ids, counts). */
  mono?: boolean;
}

export interface ListItem {
  text: string;
  /** Right-aligned mono detail — quantities, prices, states. */
  detail?: string;
}

export type EmailBlock =
  | { kind: 'heading'; text: string; eyebrow?: string }
  | { kind: 'paragraph'; text: string; size?: 'lead' | 'body'; muted?: boolean }
  | { kind: 'metricRow'; items: MetricItem[] }
  | { kind: 'keyValue'; rows: KeyValueRow[] }
  | { kind: 'list'; items: ListItem[]; more?: string }
  | { kind: 'callout'; tone?: CalloutTone; eyebrow?: string; title?: string; lines: string[] }
  | { kind: 'cta'; label: string; href: string }
  | { kind: 'note'; text: string }
  | { kind: 'divider' };

export interface EmailContent {
  /** The <title> and the restated headline inside the card. */
  title: string;
  /** Inbox preview snippet. Never rendered visibly. */
  preheader: string;
  /** Small tracked-out uppercase line above the title. */
  eyebrow?: string;
  /** Hairline rule across the top of the card. Defaults to 'accent'. */
  accent?: AccentTone;
  /** 'display' (32px) when the title is the hero; 'title' (24px) otherwise. */
  titleScale?: 'display' | 'title';
  /** Muted uppercase context beside the wordmark — usually the store name. */
  contextLabel?: string;
  blocks: EmailBlock[];
  /** Replaces the brand's default "why am I getting this" footer line. */
  footerNote?: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

export interface BuiltEmail extends RenderedEmail {
  subject: string;
}

export interface RenderOptions {
  /**
   * Preview-only. Emits the dark rules under `@media screen` instead of
   * `@media (prefers-color-scheme: dark)` so a review page can show both
   * schemes side by side. Never use for a real send.
   */
  forceDark?: boolean;
}

// ══════════════════════════════════════════════════════════════════════════
// 3. Pure helpers
// ══════════════════════════════════════════════════════════════════════════

export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Attribute-safe URL. Anything that is not http(s)/mailto falls back to the
 *  brand's app URL — a template must never emit `javascript:`. */
export function safeUrl(href: string, brand: EmailBrand): string {
  const trimmed = String(href || '').trim();
  return /^(https?:\/\/|mailto:)/i.test(trimmed) ? escapeHtml(trimmed) : escapeHtml(brand.appUrl);
}

/** Hard-wrap for the plain-text alternative. Tokens longer than the width
 *  (URLs) are never broken — they take a line of their own. */
export function wrapText(input: string, width = 72): string[] {
  const out: string[] = [];
  for (const raw of String(input).split('\n')) {
    const words = raw.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      if (!line) line = word;
      else if (line.length + 1 + word.length <= width) line += ` ${word}`;
      else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

const RULE_TEXT = '─'.repeat(56);

function padRight(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

/** Collapse blank runs and trim both edges — a text email should never arrive
 *  with a ragged head or tail. */
function tidy(lines: string[]): string {
  const out: string[] = [];
  for (const line of lines) {
    const clean = line.replace(/\s+$/, '');
    if (clean === '' && out.length > 0 && out[out.length - 1] === '') continue;
    out.push(clean);
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  while (out.length && out[0] === '') out.shift();
  return out.join('\n');
}

const money = (value: number | null | undefined): string =>
  typeof value === 'number' && Number.isFinite(value) ? `$${value.toFixed(2)}` : '—';

// ══════════════════════════════════════════════════════════════════════════
// 4. Inline type styles — one definition per role, derived from the brand
// ══════════════════════════════════════════════════════════════════════════

interface Styles {
  eyebrow: string;
  display: string;
  title: string;
  section: string;
  lead: string;
  body: string;
  bodyStrong: string;
  bodyMuted: string;
  note: string;
  hero: string;
  metric: string;
  mono: string;
  monoSmall: string;
  wordmark: string;
  link: string;
  button: string;
}

function stylesFor(brand: EmailBrand): Styles {
  const f = brand.fonts;
  const c = brand.light;
  return {
    eyebrow: `margin:0;font-family:${f.sans};font-size:${TYPE.label}px;line-height:18px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;color:${c.muted};${EXACT}`,
    display: `margin:0;font-family:${f.serif};font-size:${TYPE.display}px;line-height:38px;letter-spacing:-0.02em;font-weight:600;color:${c.ink};${EXACT}`,
    title: `margin:0;font-family:${f.serif};font-size:${TYPE.title}px;line-height:30px;letter-spacing:-0.015em;font-weight:600;color:${c.ink};${EXACT}`,
    section: `margin:0;font-family:${f.serif};font-size:${TYPE.section}px;line-height:26px;letter-spacing:-0.01em;font-weight:600;color:${c.ink};${EXACT}`,
    lead: `margin:0;font-family:${f.sans};font-size:${TYPE.lead}px;line-height:26px;letter-spacing:-0.005em;font-weight:400;color:${c.inkSoft};${EXACT}`,
    body: `margin:0;font-family:${f.sans};font-size:${TYPE.body}px;line-height:24px;font-weight:400;color:${c.inkSoft};${EXACT}`,
    bodyStrong: `margin:0;font-family:${f.sans};font-size:${TYPE.body}px;line-height:24px;font-weight:600;color:${c.ink};${EXACT}`,
    bodyMuted: `margin:0;font-family:${f.sans};font-size:${TYPE.body}px;line-height:24px;font-weight:400;color:${c.muted};${EXACT}`,
    note: `margin:0;font-family:${f.sans};font-size:${TYPE.label}px;line-height:20px;font-weight:400;color:${c.muted};${EXACT}`,
    hero: `margin:0;font-family:${f.serif};font-size:${TYPE.display}px;line-height:38px;letter-spacing:-0.02em;font-weight:600;color:${c.ink};${TABULAR}${EXACT}`,
    metric: `margin:0;font-family:${f.serif};font-size:${TYPE.title}px;line-height:30px;letter-spacing:-0.015em;font-weight:600;color:${c.ink};${TABULAR}${EXACT}`,
    mono: `margin:0;font-family:${f.mono};font-size:${TYPE.body}px;line-height:24px;letter-spacing:-0.01em;font-weight:500;color:${c.ink};${TABULAR}${EXACT}`,
    monoSmall: `margin:0;font-family:${f.mono};font-size:${TYPE.label}px;line-height:20px;font-weight:500;color:${c.muted};${TABULAR}${EXACT}`,
    wordmark: `font-family:${f.serif};font-size:${TYPE.body}px;line-height:20px;letter-spacing:0.24em;font-weight:600;color:${c.ink};${EXACT}`,
    link: `font-family:${f.sans};font-size:${TYPE.label}px;line-height:20px;font-weight:600;color:${c.accentLink};text-decoration:none;${EXACT}`,
    button: `display:inline-block;padding:14px 28px;font-family:${f.sans};font-size:${TYPE.body}px;line-height:20px;font-weight:600;letter-spacing:0.005em;color:${c.buttonInk};text-decoration:none;border-radius:8px;${EXACT}`,
  };
}

interface Ctx {
  brand: EmailBrand;
  s: Styles;
}

function accentBar(tone: Exclude<AccentTone, 'none'>, brand: EmailBrand): { color: string; cls: string } {
  if (tone === 'alert') return { color: brand.light.alert, cls: 'em-bar-alert' };
  if (tone === 'test') return { color: brand.light.quiet, cls: 'em-bar-test' };
  return { color: brand.light.accent, cls: 'em-bar-accent' };
}

function calloutRule(tone: CalloutTone, brand: EmailBrand): { color: string; cls: string } {
  if (tone === 'alert') return { color: brand.light.alert, cls: 'em-bar-alert' };
  if (tone === 'accent') return { color: brand.light.accent, cls: 'em-bar-accent' };
  return { color: brand.light.quiet, cls: 'em-bar-test' };
}

// ══════════════════════════════════════════════════════════════════════════
// 5. Progressive-enhancement stylesheet — @media rules ONLY
// ══════════════════════════════════════════════════════════════════════════

/** Dark declarations, generated from the brand's dark palette. Nothing here
 *  is load-bearing: strip the whole <style> and the light email is intact. */
function darkRules(brand: EmailBrand): string {
  const d = brand.dark;
  return [
    `.em-canvas { background-color:${d.canvas} !important; }`,
    `.em-card { background-color:${d.card} !important; border-color:${d.hairline} !important; }`,
    `.em-panel { background-color:${d.panel} !important; border-color:${d.hairline} !important; }`,
    `.em-ink { color:${d.ink} !important; }`,
    `.em-ink-soft { color:${d.inkSoft} !important; }`,
    `.em-muted { color:${d.muted} !important; }`,
    `.em-rule { background-color:${d.rule} !important; }`,
    `.em-hairline { border-color:${d.hairline} !important; }`,
    `.em-link { color:${d.accentLink} !important; }`,
    `.em-mark { background-color:${d.accent} !important; }`,
    `.em-bar-accent { background-color:${d.accent} !important; }`,
    `.em-bar-alert { background-color:${d.alert} !important; }`,
    `.em-bar-test { background-color:${d.quiet} !important; }`,
    `.em-btn { background-color:${d.buttonBg} !important; }`,
    `.em-btn-label { color:${d.buttonInk} !important; }`,
  ].map((r) => `      ${r}`).join('\n');
}

function styleBlock(brand: EmailBrand, forceDark: boolean): string {
  const d = brand.dark;
  const dark = darkRules(brand);
  const scheme = forceDark
    ? `@media screen {\n${dark}\n    }`
    : `@media (prefers-color-scheme: dark) {\n${dark}\n    }\n    `
      // Outlook.com strips the media query and rewrites colours; mirror the
      // essentials under its own attribute hook, still inside an @media rule.
      + `@media screen {\n`
      + `      a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; }\n`
      + `      [data-ogsc] .em-canvas { background-color:${d.canvas} !important; }\n`
      + `      [data-ogsc] .em-card { background-color:${d.card} !important; border-color:${d.hairline} !important; }\n`
      + `      [data-ogsc] .em-panel { background-color:${d.panel} !important; border-color:${d.hairline} !important; }\n`
      + `      [data-ogsc] .em-ink { color:${d.ink} !important; }\n`
      + `      [data-ogsc] .em-ink-soft { color:${d.inkSoft} !important; }\n`
      + `      [data-ogsc] .em-muted { color:${d.muted} !important; }\n`
      + `      [data-ogsc] .em-link { color:${d.accentLink} !important; }\n`
      + `    }`;
  return `<style type="text/css">
    @media only screen and (max-width:480px) {
      .em-shell { width:100% !important; }
      .em-pad { padding-left:24px !important; padding-right:24px !important; }
      .em-display { font-size:26px !important; line-height:32px !important; }
      .em-hero { font-size:28px !important; line-height:34px !important; }
      .em-stack { display:block !important; width:100% !important; padding:0 0 20px 0 !important; text-align:left !important; }
      .em-kv-value { text-align:left !important; }
    }
    ${scheme}
  </style>`;
}

// ══════════════════════════════════════════════════════════════════════════
// 6. HTML block renderers
// ══════════════════════════════════════════════════════════════════════════

/** Vertical rhythm per block kind: [top, bottom], all from the SPACE scale. */
const BLOCK_RHYTHM: Record<EmailBlock['kind'], [number, number]> = {
  heading: [32, 12],
  paragraph: [0, 16],
  metricRow: [8, 24],
  keyValue: [8, 24],
  list: [4, 24],
  callout: [8, 24],
  cta: [12, 24],
  note: [8, 16],
  divider: [24, 24],
};

function row(top: number, bottom: number, inner: string): string {
  return `<tr><td class="em-pad" style="padding:${top}px ${CARD_PAD_X}px ${bottom}px ${CARD_PAD_X}px;">${inner}</td></tr>`;
}

function eyebrowHtml(ctx: Ctx, text: string, bottom = 10): string {
  return `<div class="em-muted" style="${ctx.s.eyebrow}padding-bottom:${bottom}px;">${escapeHtml(text)}</div>`;
}

function paragraphHtml(ctx: Ctx, text: string, size: 'lead' | 'body', muted: boolean): string {
  const style = size === 'lead' ? ctx.s.lead : muted ? ctx.s.bodyMuted : ctx.s.body;
  const cls = size === 'lead' ? 'em-ink-soft' : muted ? 'em-muted' : 'em-ink-soft';
  return `<p class="${cls}" style="${style}">${escapeHtml(text).replace(/\n/g, '<br />')}</p>`;
}

/** One item = the typographic hero (32px serif, tabular, tight). Two or three
 *  step down to 24px so the row reads as a set, not competing heroes. */
function metricRowHtml(ctx: Ctx, items: MetricItem[]): string {
  const solo = items.length === 1;
  const valueStyle = solo ? ctx.s.hero : ctx.s.metric;
  const valueCls = solo ? 'em-ink em-hero' : 'em-ink';
  const cells = items
    .map((item, index) => {
      const gutter = index < items.length - 1 ? 32 : 0;
      const caption = item.caption
        ? `<div class="em-muted" style="${ctx.s.note}padding-top:6px;">${escapeHtml(item.caption)}</div>`
        : '';
      return `<td class="em-stack" valign="top" style="padding:0 ${gutter}px 0 0;">`
        + eyebrowHtml(ctx, item.label, 8)
        + `<div class="${valueCls}" style="${valueStyle}">${escapeHtml(item.value)}</div>`
        + caption
        + `</td>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;${TBL}"><tr>${cells}</tr></table>`;
}

function keyValueHtml(ctx: Ctx, rows: KeyValueRow[]): string {
  const body = rows
    .map((r, index) => {
      const border = index === 0 ? '' : `border-top:1px solid ${ctx.brand.light.hairline};`;
      const hair = index === 0 ? '' : ' em-hairline';
      const valueStyle = r.mono ? ctx.s.mono : ctx.s.bodyStrong;
      return `<tr>`
        + `<td class="em-kv-label${hair}" width="40%" valign="top" style="${border}padding:12px 12px 12px 0;">`
        + `<span class="em-muted" style="${ctx.s.eyebrow}">${escapeHtml(r.label)}</span></td>`
        + `<td class="em-kv-value${hair}" align="right" valign="top" style="${border}padding:11px 0 11px 12px;text-align:right;">`
        + `<span class="em-ink" style="${valueStyle}">${escapeHtml(r.value)}</span></td>`
        + `</tr>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;${TBL}">${body}</table>`;
}

function listHtml(ctx: Ctx, items: ListItem[], more?: string): string {
  const rows = items
    .map(
      (item) =>
        `<tr>`
        + `<td width="14" valign="top" style="padding:9px 10px 0 0;font-size:0;line-height:0;">`
        + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="${TBL}"><tr>`
        + `<td class="em-rule" width="4" height="4" style="width:4px;height:4px;background-color:${ctx.brand.light.rule};border-radius:2px;font-size:0;line-height:0;">&nbsp;</td>`
        + `</tr></table></td>`
        + `<td valign="top" style="padding:0 12px 10px 0;"><span class="em-ink-soft" style="${ctx.s.body}">${escapeHtml(item.text)}</span></td>`
        + `<td align="right" valign="top" style="padding:2px 0 10px 0;text-align:right;white-space:nowrap;">`
        + (item.detail ? `<span class="em-muted" style="${ctx.s.monoSmall}">${escapeHtml(item.detail)}</span>` : '')
        + `</td></tr>`,
    )
    .join('');
  const tail = more
    ? `<tr><td></td><td colspan="2" style="padding:2px 0 0 0;"><span class="em-muted" style="${ctx.s.note}">${escapeHtml(more)}</span></td></tr>`
    : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;${TBL}">${rows}${tail}</table>`;
}

function calloutHtml(ctx: Ctx, tone: CalloutTone, eyebrow: string | undefined, title: string | undefined, lines: string[]): string {
  const rule = calloutRule(tone, ctx.brand);
  const inner = [
    eyebrow ? eyebrowHtml(ctx, eyebrow, title || lines.length ? 8 : 0) : '',
    title ? `<div class="em-ink" style="${ctx.s.section}padding-bottom:${lines.length ? 8 : 0}px;">${escapeHtml(title)}</div>` : '',
    ...lines.map((line, i) => `<div class="em-ink-soft" style="${ctx.s.body}${i > 0 ? 'padding-top:6px;' : ''}">${escapeHtml(line)}</div>`),
  ].join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="em-panel em-hairline" style="width:100%;background-color:${ctx.brand.light.panel};border:1px solid ${ctx.brand.light.hairline};border-radius:10px;${TBL}">`
    + `<tr>`
    + `<td class="${rule.cls}" width="3" style="width:3px;background-color:${rule.color};font-size:0;line-height:0;border-radius:10px 0 0 10px;">&nbsp;</td>`
    + `<td style="padding:20px 24px;">${inner}</td>`
    + `</tr></table>`;
}

/** Bulletproof CTA: the padding lives on a table cell carrying a `bgcolor`
 *  attribute plus `mso-padding-alt`, so Outlook paints a real filled button
 *  even when it drops the anchor's own box model. */
function ctaHtml(ctx: Ctx, label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="${TBL}"><tr>`
    + `<td class="em-btn" align="center" bgcolor="${ctx.brand.light.buttonBg}" style="background-color:${ctx.brand.light.buttonBg};border-radius:8px;mso-padding-alt:14px 28px;">`
    + `<a class="em-btn-label" href="${safeUrl(href, ctx.brand)}" target="_blank" rel="noopener" style="${ctx.s.button}">${escapeHtml(label)}</a>`
    + `</td></tr></table>`;
}

function dividerHtml(ctx: Ctx): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;${TBL}"><tr>`
    + `<td class="em-rule" height="1" style="height:1px;background-color:${ctx.brand.light.hairline};font-size:0;line-height:0;">&nbsp;</td>`
    + `</tr></table>`;
}

function blockHtml(ctx: Ctx, block: EmailBlock): string {
  const [top, bottom] = BLOCK_RHYTHM[block.kind];
  switch (block.kind) {
    case 'heading':
      return row(top, bottom, (block.eyebrow ? eyebrowHtml(ctx, block.eyebrow, 8) : '')
        + `<div class="em-ink" style="${ctx.s.section}">${escapeHtml(block.text)}</div>`);
    case 'paragraph':
      return row(top, bottom, paragraphHtml(ctx, block.text, block.size ?? 'body', Boolean(block.muted)));
    case 'metricRow':
      return row(top, bottom, metricRowHtml(ctx, block.items));
    case 'keyValue':
      return row(top, bottom, keyValueHtml(ctx, block.rows));
    case 'list':
      return row(top, bottom, listHtml(ctx, block.items, block.more));
    case 'callout':
      return row(top, bottom, calloutHtml(ctx, block.tone ?? 'neutral', block.eyebrow, block.title, block.lines));
    case 'cta':
      return row(top, bottom, ctaHtml(ctx, block.label, block.href));
    case 'note':
      return row(top, bottom, `<p class="em-muted" style="${ctx.s.note}">${escapeHtml(block.text)}</p>`);
    case 'divider':
      return row(top, bottom, dividerHtml(ctx));
  }
}

// ══════════════════════════════════════════════════════════════════════════
// 7. Plain-text block renderers (a real alternative, not an HTML strip)
// ══════════════════════════════════════════════════════════════════════════

function blockText(block: EmailBlock): string[] {
  switch (block.kind) {
    case 'heading':
      return ['', ...(block.eyebrow ? [block.eyebrow.toUpperCase()] : []), block.text.toUpperCase(), ''];
    case 'paragraph':
      return [...wrapText(block.text), ''];
    case 'metricRow':
      return block.items.flatMap((item) => [
        item.label.toUpperCase(),
        `  ${item.value}${item.caption ? `   ${item.caption}` : ''}`,
        '',
      ]);
    case 'keyValue': {
      const width = Math.max(0, ...block.rows.map((r) => r.label.length)) + 3;
      return [...block.rows.map((r) => `${padRight(r.label, width)}${r.value}`), ''];
    }
    case 'list':
      return [
        ...block.items.map((i) => `  • ${i.text}${i.detail ? ` — ${i.detail}` : ''}`),
        ...(block.more ? [`  ${block.more}`] : []),
        '',
      ];
    case 'callout':
      return [
        ...(block.eyebrow ? [block.eyebrow.toUpperCase()] : []),
        ...(block.title ? wrapText(block.title, 68) : []),
        ...block.lines.flatMap((line) => wrapText(line, 68)),
        '',
      ];
    case 'cta':
      return [`${block.label}: ${block.href}`, ''];
    case 'note':
      return [...wrapText(block.text), ''];
    case 'divider':
      return ['', RULE_TEXT, ''];
  }
}

// ══════════════════════════════════════════════════════════════════════════
// 8. The shell
// ══════════════════════════════════════════════════════════════════════════

function wordmarkHtml(ctx: Ctx, contextLabel?: string): string {
  const mark = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="${TBL}"><tr>`
    + `<td class="em-mark" width="7" height="7" style="width:7px;height:7px;background-color:${ctx.brand.light.accent};border-radius:2px;font-size:0;line-height:0;">&nbsp;</td>`
    + `</tr></table>`;
  const right = contextLabel
    ? `<td align="right" valign="middle" style="text-align:right;"><span class="em-muted" style="${ctx.s.eyebrow}">${escapeHtml(contextLabel)}</span></td>`
    : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;${TBL}"><tr>`
    + `<td valign="middle" width="16" style="padding:0 9px 0 0;">${mark}</td>`
    + `<td valign="middle" style="${ctx.s.wordmark}"><span class="em-ink">${escapeHtml(ctx.brand.wordmark)}</span></td>`
    + right
    + `</tr></table>`;
}

/** Hidden preview text plus zero-width padding, so the client cannot spill
 *  body copy into the inbox snippet behind it. */
function preheaderHtml(ctx: Ctx, preheader: string): string {
  const filler = '&#847;&zwnj;&nbsp;&#8203;'.repeat(30);
  return `<div class="em-preheader" style="display:none;font-size:1px;color:${ctx.brand.light.canvas};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">`
    + `${escapeHtml(preheader)}${filler}</div>`;
}

function footerHtml(ctx: Ctx, note: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;${TBL}">`
    + `<tr><td style="padding:0 0 10px 0;"><span class="em-muted" style="${ctx.s.note}">${escapeHtml(ctx.brand.signature)}</span></td></tr>`
    + `<tr><td style="padding:0 0 8px 0;"><a class="em-link" href="${safeUrl(ctx.brand.manageUrl, ctx.brand)}" target="_blank" rel="noopener" style="${ctx.s.link}">Manage notifications</a></td></tr>`
    + `<tr><td><span class="em-muted" style="${ctx.s.note}">${escapeHtml(note)}</span></td></tr>`
    + `</table>`;
}

/**
 * The shared shell: canvas → wordmark → card (accent rule, eyebrow, title,
 * blocks) → footer. Pure: identical inputs produce byte-identical output.
 * `brand` is required — there is no implicit product.
 */
export function renderEmail(content: EmailContent, brand: EmailBrand, options: RenderOptions = {}): RenderedEmail {
  const ctx: Ctx = { brand, s: stylesFor(brand) };
  const tone = content.accent ?? 'accent';
  const bar = tone === 'none' ? null : accentBar(tone, brand);
  const titleStyle = content.titleScale === 'display' ? ctx.s.display : ctx.s.title;
  const titleCls = content.titleScale === 'display' ? 'em-ink em-display' : 'em-ink';
  const footerNote = content.footerNote ?? brand.footerNote;

  const cardRows = [
    bar
      ? `<tr><td class="${bar.cls}" height="3" style="height:3px;background-color:${bar.color};font-size:0;line-height:0;border-radius:14px 14px 0 0;">&nbsp;</td></tr>`
      : '',
    row(bar ? 36 : 40, 20, (content.eyebrow ? eyebrowHtml(ctx, content.eyebrow, 10) : '')
      + `<h1 class="${titleCls}" style="${titleStyle}">${escapeHtml(content.title)}</h1>`),
    ...content.blocks.map((b) => blockHtml(ctx, b)),
    `<tr><td style="height:16px;font-size:0;line-height:0;">&nbsp;</td></tr>`,
  ].join('');

  const c = brand.light;
  const html = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="x-ua-compatible" content="ie=edge" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${escapeHtml(content.title)}</title>
${styleBlock(brand, Boolean(options.forceDark))}
</head>
<body class="em-canvas" style="margin:0;padding:0;width:100%;background-color:${c.canvas};color-scheme:light dark;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
${preheaderHtml(ctx, content.preheader)}
<table role="presentation" class="em-canvas" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${c.canvas};${TBL}">
<tr><td align="center" style="padding:40px 12px 56px 12px;">
<table role="presentation" class="em-shell" width="${SHELL_WIDTH}" cellpadding="0" cellspacing="0" border="0" style="width:${SHELL_WIDTH}px;max-width:${SHELL_WIDTH}px;${TBL}">
<tr><td class="em-pad" style="padding:0 ${CARD_PAD_X}px 20px ${CARD_PAD_X}px;">${wordmarkHtml(ctx, content.contextLabel)}</td></tr>
<tr><td>
<table role="presentation" class="em-card em-hairline" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${c.card};border:1px solid ${c.hairline};border-radius:14px;${TBL}">
${cardRows}
</table>
</td></tr>
<tr><td class="em-pad" style="padding:28px ${CARD_PAD_X}px 0 ${CARD_PAD_X}px;">${footerHtml(ctx, footerNote)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = tidy([
    brand.wordmark,
    ...(content.contextLabel ? [content.contextLabel] : []),
    RULE_TEXT,
    '',
    ...(content.eyebrow ? [content.eyebrow.toUpperCase()] : []),
    ...wrapText(content.title, 68),
    '',
    ...content.blocks.flatMap(blockText),
    '',
    RULE_TEXT,
    brand.signature,
    `Manage notifications: ${brand.manageUrl}`,
    footerNote,
  ]);

  return { html, text };
}

// ══════════════════════════════════════════════════════════════════════════
// 9. Structuring existing plain text (the never-regress fallback path)
// ══════════════════════════════════════════════════════════════════════════

const CAPS_HEADING = /^[A-Z0-9][A-Z0-9 &'.,/()-]{2,48}$/;
const BULLET = /^\s*[•*-]\s+/;
const KV_LINE = /^([A-Z][A-Za-z ]{1,24}):\s+(.+)$/;
const CTA_LINE = /^(.{0,60}?):\s*(https?:\/\/\S+)$/;
const BARE_URL = /^(https?:\/\/\S+)$/;

function listItemFromLine(line: string): ListItem {
  const body = line.replace(BULLET, '').trim();
  const split = body.split(' — ');
  if (split.length >= 2) {
    const text = split[0].trim();
    const detail = split.slice(1).join(' — ').trim();
    // Only promote to the mono detail column when it fits on one line;
    // otherwise keep the whole thing as prose.
    if (detail.length <= 34) return { text, detail };
  }
  return { text: body };
}

function titleCase(caps: string): string {
  return caps.toLowerCase().replace(/(^|\s)([a-z])/g, (_m, pre: string, ch: string) => pre + ch.toUpperCase());
}

/**
 * Turn an existing plain-text notification body into branded blocks.
 * Conservative by design: anything unrecognised stays a paragraph, so the
 * worst case is a well-typeset rendering of exactly what shipped before.
 */
export function parseTextBlocks(text: string): EmailBlock[] {
  const blocks: EmailBlock[] = [];
  const paragraphs = String(text || '').replace(/\r\n/g, '\n').split(/\n\s*\n/);
  for (const para of paragraphs) {
    let lines = para.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim().length > 0);
    if (lines.length === 0) continue;

    if (CAPS_HEADING.test(lines[0].trim()) && lines.length > 1) {
      blocks.push({ kind: 'heading', text: titleCase(lines[0].trim()) });
      lines = lines.slice(1);
    }

    const bullets = lines.filter((l) => BULLET.test(l));
    if (bullets.length > 0 && bullets.length >= lines.length - 1) {
      const more = lines.find((l) => !BULLET.test(l) && /^(…|\.\.\.)/.test(l.trim()));
      blocks.push({ kind: 'list', items: bullets.map(listItemFromLine), ...(more ? { more: more.trim() } : {}) });
      continue;
    }

    const kv = lines.map((l) => KV_LINE.exec(l.trim()));
    if (lines.length >= 2 && kv.every((m) => m !== null)) {
      blocks.push({
        kind: 'keyValue',
        rows: kv.map((m) => ({ label: m![1], value: m![2], mono: /^[$\d]/.test(m![2]) })),
      });
      continue;
    }

    for (const line of lines) {
      const trimmed = line.trim();
      const bare = BARE_URL.exec(trimmed);
      if (bare) {
        blocks.push({ kind: 'cta', label: 'Open', href: bare[1] });
        continue;
      }
      const cta = CTA_LINE.exec(trimmed);
      if (cta) {
        blocks.push({ kind: 'cta', label: cta[1].trim(), href: cta[2] });
        continue;
      }
      blocks.push({ kind: 'paragraph', text: trimmed });
    }
  }
  return blocks.length > 0
    ? blocks
    : [{ kind: 'paragraph', text: String(text || '').trim() || 'Open the app for details.' }];
}

/** One-line inbox snippet derived from the body — first real sentence, capped. */
export function derivePreheader(text: string, fallback: string): string {
  const first = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !CAPS_HEADING.test(l));
  const snippet = (first || fallback).replace(/\s+/g, ' ').trim();
  return snippet.length > 140 ? `${snippet.slice(0, 137).trimEnd()}…` : snippet;
}

// ══════════════════════════════════════════════════════════════════════════
// 10. Per-event content builders — `brand` is required on every one
// ══════════════════════════════════════════════════════════════════════════

export interface VoidAlertFacts {
  storeName: string;
  invoiceNo: string;
  amount: number | null;
  timestamp: string | null;
  businessDate: string | null;
  cashier?: string | null;
}

export function voidAlertContent(facts: VoidAlertFacts, brand: EmailBrand): EmailContent {
  const amountText = typeof facts.amount === 'number' && Number.isFinite(facts.amount) ? money(facts.amount) : 'Unlisted';
  const when = facts.timestamp || facts.businessDate || 'Just now';
  const rows: KeyValueRow[] = [
    { label: 'Store', value: facts.storeName },
    { label: 'Invoice', value: facts.invoiceNo, mono: true },
    { label: 'Time', value: when, mono: true },
  ];
  if (facts.cashier) rows.push({ label: 'Cashier', value: facts.cashier });
  return {
    title: `A transaction was voided at ${facts.storeName}`,
    eyebrow: 'Voided transaction',
    preheader: `${amountText} voided · invoice ${facts.invoiceNo} · ${when}`,
    accent: 'alert',
    contextLabel: facts.storeName,
    blocks: [
      { kind: 'metricRow', items: [{ label: 'Void amount', value: amountText, caption: when }] },
      { kind: 'keyValue', rows },
      { kind: 'cta', label: 'Review this transaction', href: `${brand.appUrl}/dashboard` },
      { kind: 'note', text: 'Voids are reported exactly as your point of sale records them.' },
    ],
  };
}

export function voidAlertEmail(facts: VoidAlertFacts, brand: EmailBrand, options: RenderOptions = {}): BuiltEmail {
  return {
    subject: `Voided transaction at ${facts.storeName}`,
    ...renderEmail(voidAlertContent(facts, brand), brand, options),
  };
}

export function voidAlertTestContent(storeLabel: string, channel: string, brand: EmailBrand): EmailContent {
  const verb = channel === 'sms' ? 'text' : 'email';
  const store = storeLabel || 'your store';
  return {
    title: 'Your void alert is working',
    eyebrow: 'Test — no action needed',
    preheader: `Test only. No transaction was voided at ${store}.`,
    accent: 'test',
    contextLabel: store,
    blocks: [
      {
        kind: 'callout',
        tone: 'test',
        eyebrow: 'This is a test',
        lines: [`No transaction was voided at ${store}. Nothing has happened at your store.`],
      },
      {
        kind: 'paragraph',
        size: 'lead',
        text: `When a real void happens I'll ${verb} you a message like this one — with the amount, the invoice number and the time.`,
      },
      { kind: 'cta', label: 'Manage this alert', href: brand.manageUrl },
      { kind: 'note', text: "Test messages don't count toward your alert limits." },
    ],
  };
}

export function voidAlertTestEmail(storeLabel: string, channel: string, brand: EmailBrand, options: RenderOptions = {}): BuiltEmail {
  return {
    subject: 'TEST — your void alert is live',
    ...renderEmail(voidAlertTestContent(storeLabel, channel, brand), brand, options),
  };
}

export interface DailySalesFacts {
  revenue: number;
  transactions: number;
}

export function dailySalesContent(storeName: string, day: string, sales: DailySalesFacts, brand: EmailBrand): EmailContent {
  const average = sales.transactions > 0 ? money(sales.revenue / sales.transactions) : '—';
  return {
    title: `Yesterday at ${storeName}`,
    eyebrow: day,
    preheader: `${money(sales.revenue)} across ${sales.transactions} transactions on ${day}.`,
    accent: 'accent',
    contextLabel: storeName,
    blocks: [
      { kind: 'metricRow', items: [{ label: 'Revenue', value: money(sales.revenue), caption: day }] },
      {
        kind: 'metricRow',
        items: [
          { label: 'Transactions', value: String(sales.transactions) },
          { label: 'Average ticket', value: average },
        ],
      },
      { kind: 'cta', label: 'Open the dashboard', href: `${brand.appUrl}/dashboard` },
    ],
  };
}

/** Null semantics mirror the plain-text formatter: a missing day never sends,
 *  a genuine $0 day still does. */
export function dailySalesEmail(storeName: string, day: string, sales: DailySalesFacts | null, brand: EmailBrand, options: RenderOptions = {}): BuiltEmail | null {
  if (!sales) return null;
  return {
    subject: `${storeName} yesterday: ${money(sales.revenue)} across ${sales.transactions} transactions`,
    ...renderEmail(dailySalesContent(storeName, day, sales, brand), brand, options),
  };
}

export interface LowStockItem {
  name: string;
  current: number;
  threshold: number;
}

export function lowStockContent(storeName: string, items: LowStockItem[], brand: EmailBrand): EmailContent {
  const shown = items.slice(0, 12);
  const more = items.length > shown.length ? `…and ${items.length - shown.length} more` : undefined;
  const plural = items.length === 1 ? '' : 's';
  return {
    title: `${items.length} item${plural} at or below reorder point`,
    eyebrow: 'Low stock',
    preheader: `${storeName}: ${items.length} item${plural} need reordering.`,
    accent: 'accent',
    contextLabel: storeName,
    blocks: [
      { kind: 'metricRow', items: [{ label: 'Items to reorder', value: String(items.length), caption: storeName }] },
      { kind: 'divider' },
      {
        kind: 'list',
        items: shown.map((i) => ({ text: i.name.trim(), detail: `${i.current} / ${i.threshold}` })),
        ...(more ? { more } : {}),
      },
      { kind: 'note', text: 'On hand / reorder point.' },
      { kind: 'cta', label: 'Review inventory', href: `${brand.appUrl}/dashboard` },
    ],
  };
}

/** Nothing low → no email, matching the plain-text formatter. */
export function lowStockEmail(storeName: string, items: LowStockItem[], brand: EmailBrand, options: RenderOptions = {}): BuiltEmail | null {
  if (items.length === 0) return null;
  return {
    subject: `${storeName}: ${items.length} item${items.length === 1 ? '' : 's'} at or below reorder point`,
    ...renderEmail(lowStockContent(storeName, items, brand), brand, options),
  };
}

// Structurally compatible with the owner-digest payload the platform already
// consumes — declared locally so this module stays import-free.
export interface WeeklyBriefReorderRow {
  name?: string;
  qty_on_hand?: number;
  suggested_qty?: number;
  est_reorder_cost?: number;
  stock_status?: string;
}
export interface WeeklyBriefAttachRow {
  name_a?: string;
  name_b?: string;
  attach_rate?: number;
  together?: number;
}
export interface WeeklyBriefBody {
  period_end?: string;
  cadence?: string;
  digest?: {
    period?: { end?: string; window_days?: number };
    reorder?: WeeklyBriefReorderRow[];
    attach?: WeeklyBriefAttachRow[];
    notes?: unknown[];
  } | null;
}

function briefSections(body: WeeklyBriefBody) {
  const digest = body.digest ?? null;
  const periodEnd = body.period_end || digest?.period?.end || '';
  const reorder = (digest?.reorder || []).filter((r) => r.name).slice(0, 8);
  const attach = (digest?.attach || []).filter((a) => a.name_a && a.name_b).slice(0, 5);
  return { digest, periodEnd, reorder, attach, windowDays: digest?.period?.window_days ?? 7 };
}

export function weeklyBriefContent(storeName: string, body: WeeklyBriefBody, brand: EmailBrand): EmailContent {
  const { periodEnd, reorder, attach, windowDays } = briefSections(body);

  // Body, not lead: the 32px display title already carries this email, and a
  // fifth type size would break the four-role budget.
  const blocks: EmailBlock[] = [
    { kind: 'paragraph', text: `Your ${windowDays}-day brief for ${storeName}, week ending ${periodEnd}.` },
  ];

  if (reorder.length) {
    const estimated = reorder.reduce((sum, r) => sum + (r.est_reorder_cost || 0), 0);
    blocks.push({ kind: 'divider' });
    blocks.push({ kind: 'heading', text: 'Reorder suggestions', eyebrow: `${reorder.length} item${reorder.length === 1 ? '' : 's'}` });
    if (estimated > 0) {
      blocks.push({ kind: 'metricRow', items: [{ label: 'Estimated reorder cost', value: money(estimated), caption: 'Across the items below' }] });
    }
    blocks.push({
      kind: 'list',
      items: reorder.map((r) => ({
        text: (r.name || '').trim(),
        detail: r.stock_status === 'out_of_stock'
          ? `0 · buy ${r.suggested_qty ?? '?'}`
          : `${r.qty_on_hand ?? '?'} · buy ${r.suggested_qty ?? '?'}`,
      })),
    });
    blocks.push({ kind: 'note', text: 'On hand · suggested order quantity.' });
  }

  if (attach.length) {
    blocks.push({ kind: 'divider' });
    blocks.push({ kind: 'heading', text: 'Bought together', eyebrow: 'Attach rates' });
    blocks.push({
      kind: 'list',
      items: attach.map((a) => ({
        text: `${(a.name_a || '').trim()} + ${(a.name_b || '').trim()}`,
        detail: `${Math.round((a.attach_rate || 0) * 100)}% · ${a.together ?? '?'}×`,
      })),
    });
  }

  blocks.push({ kind: 'cta', label: 'Open the full brief', href: `${brand.appUrl}/dashboard` });

  return {
    title: 'Your weekly brief',
    eyebrow: `Week ending ${periodEnd}`,
    preheader: `${storeName}: ${reorder.length} reorder suggestion${reorder.length === 1 ? '' : 's'} and this week's attach rates.`,
    accent: 'accent',
    titleScale: 'display',
    contextLabel: storeName,
    blocks,
  };
}

/** Empty digests yield null — never an empty send. `periodEnd` comes back so
 *  the shell keeps its per-period dedupe. */
export function weeklyBriefEmail(storeName: string, body: WeeklyBriefBody, brand: EmailBrand, options: RenderOptions = {}): (BuiltEmail & { periodEnd: string }) | null {
  const { digest, periodEnd, reorder, attach } = briefSections(body);
  if (!digest || !periodEnd) return null;
  if (reorder.length === 0 && attach.length === 0) return null;
  return {
    subject: `Weekly Brief — ${storeName} (week ending ${periodEnd})`,
    periodEnd,
    ...renderEmail(weeklyBriefContent(storeName, body, brand), brand, options),
  };
}

export interface ConnectorHealthFacts {
  storeName: string;
  connectorLabel: string;
  issue: string;
  detectedAt: string;
  lastSyncAt?: string | null;
}

export function connectorHealthContent(facts: ConnectorHealthFacts, brand: EmailBrand): EmailContent {
  const rows: KeyValueRow[] = [
    { label: 'Store', value: facts.storeName },
    { label: 'Connection', value: facts.connectorLabel },
    { label: 'Detected', value: facts.detectedAt, mono: true },
  ];
  if (facts.lastSyncAt) rows.push({ label: 'Last good sync', value: facts.lastSyncAt, mono: true });
  return {
    title: `${facts.connectorLabel} stopped syncing`,
    eyebrow: 'Connection issue',
    preheader: `${facts.storeName}: ${facts.issue}`,
    accent: 'alert',
    contextLabel: facts.storeName,
    blocks: [
      { kind: 'callout', tone: 'alert', eyebrow: 'What happened', lines: [facts.issue] },
      { kind: 'keyValue', rows },
      {
        kind: 'paragraph',
        text: `Sales, inventory and alerts for this store are paused until the connection is restored. Nothing is lost — ${brand.productName} backfills once it reconnects.`,
      },
      { kind: 'cta', label: 'Fix the connection', href: `${brand.appUrl}/connections` },
    ],
  };
}

export function connectorHealthEmail(facts: ConnectorHealthFacts, brand: EmailBrand, options: RenderOptions = {}): BuiltEmail {
  return {
    subject: `${facts.storeName}: ${facts.connectorLabel} stopped syncing`,
    ...renderEmail(connectorHealthContent(facts, brand), brand, options),
  };
}

export type TeamChangeAction = 'invited' | 'added' | 'role_changed' | 'removed';

export interface TeamChangeFacts {
  action: TeamChangeAction;
  /** Human sentence, e.g. "ravi@partyliquor.com was invited as admin." */
  summary: string;
  workspaceName?: string;
  personEmail?: string | null;
  role?: string | null;
}

const TEAM_ACTION_LABEL: Record<TeamChangeAction, string> = {
  invited: 'Member invited',
  added: 'Member added',
  role_changed: 'Role changed',
  removed: 'Member removed',
};

export function teamChangeContent(facts: TeamChangeFacts, brand: EmailBrand): EmailContent {
  const rows: KeyValueRow[] = [];
  if (facts.workspaceName) rows.push({ label: 'Workspace', value: facts.workspaceName });
  if (facts.personEmail) rows.push({ label: 'Person', value: facts.personEmail });
  if (facts.role) rows.push({ label: 'Role', value: facts.role });
  return {
    title: TEAM_ACTION_LABEL[facts.action],
    eyebrow: 'Team change',
    preheader: facts.summary,
    accent: 'accent',
    contextLabel: facts.workspaceName,
    blocks: [
      { kind: 'paragraph', size: 'lead', text: facts.summary },
      ...(rows.length ? [{ kind: 'keyValue' as const, rows }] : []),
      { kind: 'cta', label: 'Review your team', href: `${brand.appUrl}/admin/team` },
      { kind: 'note', text: 'Workspace owners and admins are notified of every membership change.' },
    ],
  };
}

export function teamChangeEmail(facts: TeamChangeFacts, brand: EmailBrand, options: RenderOptions = {}): BuiltEmail {
  return {
    subject: `Team change in your ${brand.productName} workspace`,
    ...renderEmail(teamChangeContent(facts, brand), brand, options),
  };
}

/** Last-resort shape: a well-typeset rendering of whatever plain text the
 *  caller already had. Strictly better than an unstyled send. */
export function genericContent(subject: string, text: string, eyebrow?: string, accent: AccentTone = 'accent'): EmailContent {
  return {
    title: subject,
    eyebrow,
    preheader: derivePreheader(text, subject),
    accent,
    blocks: parseTextBlocks(text),
  };
}

// ══════════════════════════════════════════════════════════════════════════
// 11. Event → presenter map (the chokepoint)
// ══════════════════════════════════════════════════════════════════════════

const isTestSubject = (subject: string) => /^TEST\b/i.test(subject);

/**
 * Notification event id → a presenter that shapes an already-built
 * (subject, text) pair into branded content. Adding an event is ONE line.
 *
 * Call sites holding structured facts should pass a §10 builder to the shell
 * instead; this map is what guarantees every other lane — including ones added
 * later — still arrives branded rather than as raw text.
 */
export const EVENT_PRESENTERS: Record<string, (subject: string, text: string) => EmailContent> = {
  'weekly-brief': (subject, text) => ({ ...genericContent(subject, text, 'Weekly brief'), titleScale: 'display' }),
  'daily-sales-summary': (subject, text) => genericContent(subject, text, 'Daily sales'),
  'connector-health': (subject, text) => genericContent(subject, text, 'Connection issue', 'alert'),
  'low-stock': (subject, text) => genericContent(subject, text, 'Low stock'),
  'team-changes': (subject, text) => genericContent(subject, text, 'Team change'),
  'void-alert': (subject, text) =>
    isTestSubject(subject)
      ? genericContent(subject, text, 'Test — no action needed', 'test')
      : genericContent(subject, text, 'Void alert', 'alert'),
};

/**
 * Chokepoint renderer. Never fails for want of a template: an unknown event
 * falls back to the generic shell, which is still strictly better than the
 * unstyled text that shipped before.
 */
export function renderNotificationEmail(event: string, subject: string, text: string, brand: EmailBrand, options: RenderOptions = {}): RenderedEmail {
  const presenter = EVENT_PRESENTERS[event];
  return renderEmail(presenter ? presenter(subject, text) : genericContent(subject, text), brand, options);
}
