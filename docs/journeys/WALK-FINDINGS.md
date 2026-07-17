# Walk findings — where the current build breaks the golden journeys

Grounded gaps between the journey contracts in this folder and the shipped
code, from a code-level walk + a live seam walk of app.aros.live
(2026-07-17). Each maps to a spec + step with file refs. Fix these before
calling the journey done; delete entries as they close (this file trends to
empty).

## J1 / J2 — `/start` shows fabricated data to a real signed-in user

`StartChat.tsx` force-enables demo for the *authenticated* new user (POST
`/v1/demo/enable`, every turn sends `demoMode:true` —
`apps/web/src/pages/start/StartChat.tsx:53-113`). This is the only surface
that breaks the repo's demo guarantee (`useDemo() = !session`,
`apps/web/src/redesign/data.ts:9-23`). Badged "sample data", but Ramesh's
first signed-in screen is fabricated sales. J1's contract is fine with
sample data *when labeled and expected*; the defect is it persists as the
default surface until connect, and:

- 🔴 **LIVE (prod)**: `GET /v1/demo/activation?intent=retail` → **404**
  (fetched on mount, `StartChat.tsx:74`); `/v1/demo/enable` is wired.
  Router-side drift — owned by the routing/data-wiring session, do not
  hand-patch from here.

## J2 step 2 — "Client ID" is not knowledge Ramesh has

`connect-my-store.md` step 2 allows "his POS login". The actual RapidRMS
form also requires **Client ID** (`ConnectStorePage.tsx:24-57`) — a
per-store identifier from the RapidRMS portal, not login knowledge. Needs
the spec's one-line explainer plus a "Where do I find this?" helper (or
lookup-by-account-email server-side).

## J2 steps 4–5 — success is claimed before data flows, and readiness is invisible

Spec requires: in-flight "Checking with RapidRMS…", then "Connected — we
found your store" with a recognizable detail, then honest "syncing" until
real rows. Current build:

- Success bar fires at connector `status='connected'`
  (`ConnectStorePage.tsx:192-197`) while bindings are created as
  `status='syncing'` (`src/server.ts` `provisionCanonicalStores`,
  :2312-2377).
- The readiness state machine exists server-side —
  `store_connector_bindings.status` and the `tenant_app_activation_status`
  view (`waiting_for_store → syncing → ready → attention`, migration
  `20260716_app_data_activation_contract.sql`) — but is **surfaced in no
  UI**. No screen ever confirms "your real numbers are flowing".
- No recognizable store detail is echoed back on success.

## J4 — trends silently null right after connect

Week-over-week `changePercent` needs `store_snapshots` history;
`captureStoreSnapshots` is env-gated + scheduled (`src/server.ts:2047-2135`)
— an **operator activation** the journey depends on. Until a week exists,
trend UI must say "collecting history", not render nothing.

## Structural — two divergent connect UIs on one API

`ConnectStorePage` (pre-onboarding, `/connect`) vs the `ConnectWizard` modal
in `AppShell` (adds SCOPE and Verifone Edge-pairing steps,
`apps/web/src/redesign/ConnectWizard.tsx:39-88`). Same
`/api/connectors` + `/test` contract, drifting step lists. Consolidate or
share step components before the next connect-flow change.

## Tooling — no browser E2E runner behind the gate

`scripts/e2e.sh` expects a `pnpm e2e` script no package defines. The seam
walk (`scripts/journey-walk.mjs`) covers HTTP-level wiring; steps marked
`NEEDS-BROWSER` have no automated runner yet — they rely on the
`journey-walker` subagent until a Playwright suite lands.
