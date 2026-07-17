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
default surface until connect.

*(Fixed 2026-07-17: the live `/v1/demo/activation` 404 — root cause was the
route only existing on unmerged shreai#761; restored via shreai#1007 +
public-allowlist shreai#1012, patched onto the serving pm2 router, prod walk
J1 now WALKS CLEAN.)*

## Residual debt (from the closed demo-chat $0.00 finding)

*(The $0.00 finding itself closed 2026-07-17: shreai#1020 merged and the
public `/v1` cutover to the launch.sh-managed docker router landed (aros#85
socat edge + passport, aros#86 reply-envelope fix); demo journey verified
live end-to-end by persona walk.)* Remaining debt for real tenants:
`tool-forge/output/*` tools still shell to psql — one hardcodes PGPASSWORD —
needs the #991-style pg-client migration + a security-lane look.

## J2 steps 4–5 — readiness state machine pending activation-contract merge

Fixed so far: in-flight "Checking with <provider>…"; success copy scoped
honestly per provider; the KPI mapping drift that prevented real numbers
from EVER rendering; "live from <source>" marker; four honest Home states
via `hasConnector` + `summaryCapable`; and connect success now echoes a
recognizable live detail ("we found <store>: N transactions today") from
`/api/connectors/test`. Remaining:

- The full readiness state machine (`store_connector_bindings.status`,
  `tenant_app_activation_status`: `waiting_for_store → syncing → ready →
  attention`) lives on the **unmerged activation-contract branch** (chat
  data-wiring session). When it merges, replace the connector-row heuristic
  behind `hasConnector`/`summaryCapable` with the real binding states.

*(Inventory finding CLOSED 2026-07-17 via #90, live-verified: the catalog is
`GET /api/Item` — mapped with `iteM_InStock`/`iteM_MinStockLevel`/
`description`, deleted/inactive filtered, thresholds must be >0. Live
summary for the real store now reads `partial:false, lowStock
available:true, count:1` — "1000 STORIES CAB." 0/2, a genuine reorder item.
This followed the #88 closure of the partial-poisoning finding; PR #18
closed superseded with credit.)*

## Structural — connect UIs share one provider catalogue; step flows still differ

Provider/field definitions are consolidated in `lib/posProviders.ts` (single
source of truth for both `/connect` and the `ConnectWizard`, incl. hints and
wire types), and the wizard now reports the REAL test outcome (failed API
test keeps the wizard open; unconfirmable tunnel says "saved — couldn't
confirm yet" instead of claiming success). Remaining: the two surfaces still
render separate step flows (page = single form; wizard = 4 steps with SCOPE/
REVIEW) — acceptable while both consume the shared catalogue, revisit if
either grows another step.

## Tooling — browser E2E runner exists; deepest live step still manual

`pnpm e2e` (Playwright) now runs: public J1 seams + draft-safety + fail-closed
checks locally against the real frontend with mocked `/api/*` (no backend, no
seeded state), and a live J2 spec against a deployed surface when
`E2E_BASE_URL`/`E2E_EMAIL`/`E2E_PASSWORD` are set. Still manual: the deepest
J2 step (a real POS connect) needs test-store credentials — until then it's
the `journey-walker` subagent's job on beta.
