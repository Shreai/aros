/**
 * AROS brand tokens for transactional email — the ONLY place product-specific
 * literals live.
 *
 * `src/email-templates.ts` is deliberately free of product names, URLs and
 * brand hex values (asserted in tests) so it can be lifted into a shared
 * package. A sibling product supplies its own `EmailBrand` object shaped like
 * this one and gets the same typographic system with its own identity.
 *
 * Pure data. No I/O, no env reads, no side effects at import time.
 */

import type { EmailBrand, EmailFonts, EmailPalette } from './email-templates.js';

/** Newsreader is the brand serif; every fallback is metric-near so a missing
 *  webfont changes the texture, never the layout. */
export const AROS_FONTS: EmailFonts = {
  serif: "Newsreader, 'Iowan Old Style', Georgia, 'Times New Roman', serif",
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hanken Grotesk', Helvetica, Arial, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

export const AROS_LIGHT: EmailPalette = {
  canvas: '#FBF9F5',
  card: '#FFFFFF',
  panel: '#FBF9F5',
  ink: '#1A1714',
  inkSoft: '#2E2A25',
  muted: '#6B635A',
  hairline: '#E8E2D8',
  rule: '#C9BFB0',
  accent: '#B8842A',
  // #8A6318 on #FBF9F5 ≈ 5.3:1 — AA for normal text. Raw #B8842A is ~3.3:1
  // and must never be used for body-sized link text.
  accentLink: '#8A6318',
  alert: '#A8443A',
  quiet: '#C9BFB0',
  // Ink button + white label ≈ 16:1. Gold + white would fail AA at 15px.
  buttonBg: '#1A1714',
  buttonInk: '#FFFFFF',
};

/** Deliberately off-black / off-white: pure #000 and #FFF read harsh in dark
 *  clients and blow out the contrast relationships the light palette sets. */
export const AROS_DARK: EmailPalette = {
  canvas: '#141210',
  card: '#1E1B17',
  panel: '#241F19',
  ink: '#F3EEE5',
  inkSoft: '#DCD5CA',
  muted: '#A79D91',
  hairline: '#332E27',
  rule: '#4A4238',
  accent: '#D6A65A',
  accentLink: '#E0B972',
  alert: '#E0857A',
  quiet: '#4A4238',
  buttonBg: '#D6A65A',
  buttonInk: '#17140F',
};

export const AROS_BRAND: EmailBrand = {
  productName: 'AROS',
  wordmark: 'AROS',
  senderName: 'AROS',
  // Empty = no Reply-To header, replies land on the sender identity. Set this
  // to a MONITORED mailbox before telling anyone they can reply.
  replyTo: '',
  appUrl: 'https://app.aros.live',
  manageUrl: 'https://app.aros.live/notifications',
  signature: '— AROS · app.aros.live',
  footerNote: 'You are receiving this because notifications are on for your AROS workspace.',
  fonts: AROS_FONTS,
  light: AROS_LIGHT,
  dark: AROS_DARK,
};
