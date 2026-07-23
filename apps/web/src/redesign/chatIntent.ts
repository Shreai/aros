// Functional core for client-side chat intent interception. Pure, DOM-free,
// framework-free — the composers (ConciergeChat, ArosChat, StartChat) are the
// imperative shell that acts on these decisions.

/**
 * Requests that need a Research & External Intelligence agent (web.search /
 * weather.read). AROS's retail specialists cannot answer these, so a workspace
 * without that agent gets an honest routing message instead of a hallucinated
 * forecast.
 */
export const EXTERNAL_INTELLIGENCE_REQUEST =
  /\b(weather|forecast|temperature|news|headlines|search (?:the )?web|browse (?:the )?(?:web|internet)|look up online)\b/i;

/**
 * Should a text-only intent interceptor claim this turn and answer locally
 * instead of sending it?
 *
 * The interceptors match on message TEXT alone — they cannot see a file. A
 * photographed invoice captioned "any news on this vendor?" used to trip the
 * external-intelligence branch: the composer had already been cleared
 * optimistically, the branch returned early without restoring, and the
 * attachment was discarded unrecoverably while the user got a canned routing
 * message about an agent they never asked for.
 *
 * The rail: a turn carrying attachments is never interceptable. It mirrors the
 * server-side guard in src/server.ts, where `hasAttachments(body)` gates every
 * /v1/chat intent handler, so both ends of the wire fail the same way.
 */
export function shouldInterceptTextOnly(input: {
  /** Did the interceptor's text matcher fire on the message text? */
  matched: boolean;
  /** Does this turn carry files the matcher cannot see? */
  hasAttachments: boolean;
  /** Is the capability the interceptor exists to report as MISSING actually active? */
  capabilityActive: boolean;
}): boolean {
  if (input.hasAttachments) return false;
  return input.matched && !input.capabilityActive;
}
