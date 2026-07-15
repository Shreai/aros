# Store data flow — how a connected store becomes real data

The onboarding journey (`/start` demo → `/connect` → onboarding) and the
`/api/connectors` CRUD/test layer got a tenant to **"store connected"**. This
document describes how that connection turns into numbers a user and the agent
actually see — the read-back layer.

## The four stages

```
  ┌─────────────┐   ┌──────────────┐   ┌───────────────────┐   ┌──────────────┐
  │  1. CONNECT │   │  2. STORE    │   │  3. READ-BACK     │   │  4. CONSUME  │
  │  /connect   │──▶│ tenant_      │──▶│ data-service      │──▶│ dashboard    │
  │  save+test  │   │ connectors   │   │ fetchStoreSummary │   │ agent tool   │
  │             │   │ status=      │   │ (auth → pull →    │   │ (sync cache) │
  │             │   │ connected    │   │  normalize)       │   │              │
  └─────────────┘   └──────────────┘   └───────────────────┘   └──────────────┘
        DONE              DONE                THIS PR              THIS PR (1-2)
```

### 1. Connect — DONE
`/connect` page → `POST /api/connectors` (encrypt + store) → `POST
/api/connectors/test` (decrypt → bridge to vault → connector `testConnection`
→ `status=connected`). Credentials are AES-256-GCM at rest, only decrypted
in-process, never returned.

### 2. Store — DONE
`tenant_connectors` row: `{ type, name, config, credentials_encrypted,
status }`. RLS on; service-role only.

### 3. Read-back — **added here** (`connectors/data-service.ts`)
`fetchStoreSummary(record, vaultSecret)`:
- bridges decrypted secrets into the connector vault (same pattern as the test
  handler), authenticates, and pulls **today's sales** + **inventory**;
- normalizes into a typed `StoreSummary` with **defensive coercion** — unknown
  payload shapes yield an empty section flagged `partial: true`, never a
  fabricated number;
- RapidRMS is mapped today; Azure SQL / Verifone return `null` (they expose
  `query` / `fetchReports` but need a per-deployment schema/report mapping) so
  the dashboard stays on its honest placeholder.

Server helper `getTenantStoreSummary(tenantId)`:
- finds the tenant's `connected` connector (POS preferred over raw DB);
- **60s in-memory TTL cache** so a dashboard load doesn't re-auth the POS every
  request; busted immediately on connector test/delete;
- never throws — a fetch failure resolves to `null` → placeholder.

### 4. Consume
- **Dashboard** (`GET /api/dashboard`) — **wired here.** Now keys "connected?"
  off `tenant_connectors` (not the old `tenants.pos_system` guess) and, when
  connected, fills real `todaySales` + `lowStock` + a `dataSource:{live:true,…}`
  marker; otherwise the honest "Connect your store" zeros.
- **Endpoint** `GET /api/store/summary` — **added here.** `{ connected, summary
  }` for any surface (dashboard already uses the shared helper; the agent tool
  below calls this).
- **Agent tool** — *remaining, out of repo.* The agent runs in `shre-router`
  (proxied via `/v1/*`). Register one tool there, e.g. `get_store_summary`,
  that calls `GET https://app.aros.live/api/store/summary` with the tenant's
  bearer, so non-demo chat answers from real numbers instead of `demoMode`
  sample data. This repo exposes exactly the endpoint it needs.
- **Warehouse (`store_snapshots`)** — **added here.** A scheduled snapshotter
  (`captureStoreSnapshots`, env-gated by `STORE_SNAPSHOT_INTERVAL_MIN`, off by
  default) pulls each connected connector's summary and upserts one row per
  tenant per `business_date` into `store_snapshots` (aros Supabase). This gives
  the self-serve path **history** — so it stops being live-pull-only and
  converges with the warehouse-backed internal stores. `changePercent` is now
  computed from the same-weekday-last-week snapshot (`weekOverWeekChange`),
  null until a week of history exists. A downstream bridge could replicate
  these snapshots into cortexdb for cross-platform analytics/RAG parity with
  the internal `rapidrms.branches` path — deliberately left as a separate step
  (avoids coupling the Supabase-backed app to cortexdb).

## What is deliberately NOT done yet
- Azure SQL / Verifone summaries — need per-deployment mapping.
- cortexdb bridge for the self-serve snapshots (cross-platform analytics).
- `connectors/storepulse-link.ts` is superseded by DB-backed `tenant_connectors`
  and remains dead; fold its "which connectors serve this tenant" intent into
  `getTenantStoreSummary` if StorePulse needs it, rather than reviving the
  in-memory map.

## Field-mapping caveat
The RapidRMS field-name candidate lists in `data-service.ts` are defensive but
not yet validated against a **live tenant** response (no real tenant has
connected). The design fails safe: an unrecognized shape shows "live, no data
yet" (`partial`), not wrong numbers. Refine the lists once a real store
connects and its payload is observed.
