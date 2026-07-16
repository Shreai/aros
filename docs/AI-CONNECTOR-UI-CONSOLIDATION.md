# AI-connector UI consolidation — one front door, no duplicate flows

**Problem:** the user-facing "connect your store" experience exists in **two
places** with two look-and-feels, so a store owner can hit a different UI
depending on entry point. This is the duplication to resolve before we open the
AI connector to Claude/ChatGPT/Gemini + white-label domains.

## The duplication today

| Surface | Where | What it does |
|---|---|---|
| **aros.live onboarding + connect** | `aros-platform/apps/web` — `pages/onboarding/OnboardingPage.tsx`, `pages/connect/ConnectStorePage.tsx`, `pages/ConnectorConsent.tsx` | signup → verify → plan → business setup → **dummy-proof connect-POS** → dashboard; + OAuth consent |
| **mib007 connector wizard** | `mib007/ui` — `apps/operations/pages/PosOnboarding.tsx` (pick → credentials → sites → success, `EdgeRelayDownloadCard`) + a mib007 `/connect` consent page | the connector-selection + edge-download flow the connector OAuth currently redirects to |

Both cover "choose POS → connect → done." Different components, different styling,
different repos. Two OAuth consent pages (mib007 `/connect` vs aros
`/authorize`). If left as-is, the AI-connector login and the web login look and
behave differently — the opposite of the "one consistent AROS" goal.

## Decision: aros.live React app = the single user-facing front door

- **aros.live (`apps/web`) owns ALL user-facing UI** — login, OAuth consent,
  connect-POS, dashboard — for **every** entry point: web signup, AI-assistant
  connector, and white-label custom domains. Themed by the existing
  `WhitelabelProvider`.
- **mib007 = backend + platform** — OAuth grant minting (`connector-oauth.ts`),
  MCP tools/gateway (`packages/mcp-server`), POS connectors, edge control plane.
  It stops serving user-facing connect/consent HTML.
- **shre-rapidrms = canonical data plane** — `shre.*` + `/api/analytics` +
  `/api/canonical/snapshot` + tlog API (what the MCP tools read).

Rationale: aros.live is already the branded, white-label-aware SPA with the
dummy-proof onboarding + consent. Centralizing there gives one identity, one
theme system, one flow — and mib007 keeps what it's best at (backend, gateway,
connectors), which is also where the engineer's active OIDC work lives.

## Migration (each step removes duplication, none adds it)

1. **Consent** — retire mib007's `/connect` consent page; point the connector
   `/oauth/authorize` → `aros.live/authorize` (see `AI-CONNECTOR-CONSENT-WIRING.md`).
   *(consent UI: 1, was 2)*
2. **Connect-POS** — make the OAuth flow reuse the aros dummy-proof connect-POS
   step (PR #31): if the workspace has no POS on Allow, drop into it, then
   complete the grant. Retire the `EdgeRelayDownloadCard`/wizard as a *separate*
   user path; keep mib007's connector **APIs** (validate/connect/sites) as the
   backend the aros UI calls. *(connect UI: 1, was 2; connector APIs stay 1)*
3. **Brand model** — make brands **DB-driven** (today: 3 hardcoded in
   `mcp-server/src/branding`) so per-tenant white-label domains resolve a brand →
   `WhitelabelProvider` config, one theme path for web + connector.
4. **Dashboard continuity** — after connecting via an AI assistant, links land in
   the same aros.live portal (already the case once consent lives there).

## What explicitly is NOT duplicated / stays put

- mib007's **connector APIs** (`/api/mcp/*`, `/api/connector/oauth/*`, edge
  control plane) — backend, single source, the aros UI calls them.
- The **canonical data plane** (shre-rapidrms) — single source for store data.
- The **MCP gateway** (`packages/mcp-server`) — single AI front door; only its
  *human* consent redirect moves to aros.live.

## Sequencing vs. in-flight work

mib007 is on `feat/aros-central-identity` (AROS OIDC / central identity — the
unified-login backbone). This consolidation **depends on and composes with** that:
OIDC gives the one identity; this plan gives the one UI on top of it. Do the
consent-redirect (step 1) as OIDC lands; steps 2–4 follow. Coordinate step 1 + the
`connector-oauth.ts` session-source change with whoever owns the OIDC work so the
two land together, not twice.

See also: `AI-CONNECTOR-CONSENT-WIRING.md`,
`../../../shre-rapidrms/docs/planning/AROS-AI-CONNECTOR.md`.
