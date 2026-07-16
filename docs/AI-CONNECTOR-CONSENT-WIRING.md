# AI-connector consent — wiring the connector OAuth to the AROS UI

**Goal:** when a store owner adds AROS to Claude / ChatGPT / Gemini, they see the
**same login + consent + connect experience as the web app** — one identity, one
UI, one flow. This spec is the small backend change that makes the UI half
(`aros.live/authorize`, `ConnectorConsent.tsx`) live. It is a *redirect target*
change, not a new flow — no duplicate consent UI.

## The one change

The connector's OAuth authorize endpoint currently redirects to a mib007 page:

```
# mib007/packages/mcp-server/src/auth/oauth.ts  (/oauth/authorize)
redirect → ${MIB007_URL}/connect?connector=<brand>...
```

Point it instead at the AROS web app's consent route:

```
redirect → ${AROS_WEB_URL}/authorize
             ?client_id=<id>
             &client_name=<DCR client_name, e.g. "Claude">
             &redirect_uri=<connector callback>
             &scope=<pos:read ...>
             &state=<state>
             &code_challenge=<pkce>
             &code_challenge_method=S256
             &connector=<brand>       # aros | rapidrms | verifone (or custom-domain brand)
```

`aros.live/authorize` (`apps/web/src/pages/ConnectorConsent.tsx`) is wrapped in
`<ProtectedRoute>`, so an unauthenticated user is sent through the **same
`/login`** as the web app, then returned to the consent screen — unified
identity, no separate connector login.

## The grant callback (already exists — reuse it)

On **Allow**, `ConnectorConsent` POSTs to the existing authorization-code minter
with the user's session bearer:

```
POST ${AROS_API_URL}/api/connector/oauth/authorize      # mib007 connector-oauth.ts
  Authorization: Bearer <aros session token>
  { clientId, redirectUri, scope, state, connector, codeChallenge, codeChallengeMethod, tenantId }
→ 200 { redirectUrl }        # redirect_uri + ?code=<auth code>&state=<state>
```

`connector-oauth.ts` already mints a **workspace-scoped API key** as the token and
validates PKCE S256 — no new grant logic. The only adjustments needed:

1. Accept the AROS **session bearer** (Supabase/shre-id) as the authenticated
   caller instead of a mib007 board session (`assertBoard`), resolving the same
   `workspaceId`. This is where the engineer's in-flight **AROS OIDC /
   central-identity** work (`feat/aros-central-identity`) plugs in — one identity
   spanning web + connector.
2. Return `{ redirectUrl }` (redirect_uri + code + state) for the browser to
   follow, rather than server-redirecting (the consent SPA drives the redirect).

## Config

| Var | Where | Value |
|---|---|---|
| `AROS_WEB_URL` | mcp-server | `https://app.aros.live` (or the custom domain) |
| authorize redirect | `oauth.ts` | `${AROS_WEB_URL}/authorize?...` |
| `Deny` | consent SPA | `redirect_uri?error=access_denied&state=` |

## Why this is not a duplicate flow

- **One consent UI** — `ConnectorConsent.tsx` (web app), themed by the existing
  `WhitelabelProvider` so custom domains auto-brand. mib007's `/connect` consent
  page is **retired** in favor of it.
- **One grant minter** — the existing `connector-oauth.ts`, unchanged except for
  the session source + response shape.
- **One identity** — shre-id OIDC (engineer's work), shared by web + connector.

See also: `../../../shre-rapidrms/docs/planning/AROS-AI-CONNECTOR.md`,
`AI-CONNECTOR-UI-CONSOLIDATION.md`.
