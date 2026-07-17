# Plugins — Operator Runbook

How to bring the unified **Plugins** feature fully live across AROS, mib007
(shre-command-center), and the mib-desktop ops console. The code degrades safely
until each item below is configured, so you can enable it incrementally.

Related PRs: `Shreai/aros#76`, `Shreai/shre-command-center#89`, `Shreai/shreai#1011`.

---

## What "Plugins" is

A tenant's Plugins view unifies two sources:

- **Built** — apps the tenant generated via the App Factory (`public.tenant_apps`),
  walking the lifecycle `draft → preview → live → retired`.
- **Installed** — marketplace apps enabled with `source = 'plugin'`
  (`public.marketplace_app_entitlements`).

AROS owns the data + the `/api/plugins` contract; the MIB surfaces read it
service-to-service.

---

## 1. Apply the `tenant_apps` migration (AROS) — enables "Built"

The registry is **staged-apply** — `launch.sh` never runs migrations.

```bash
# On the AROS DB (Supabase project), after rebasing onto latest main:
supabase/migrations/20260715_tenant_apps.sql
```

Until applied, `GET /api/plugins` degrades to **installed-only** (built list is
empty), and provisioning (`POST /api/plugins`) fails. No error is surfaced to
end users — the page still renders marketplace plugins.

Verify:

```sql
select to_regclass('public.tenant_apps'), to_regclass('public.app_events');
-- both non-null = applied
```

---

## 2. Configure the provisioning backend (AROS) — enables the write path

`POST /api/plugins` provisions a built app (registry row + private schema +
scoped role). It needs a **privileged** Postgres connection (can `CREATE SCHEMA`
/ `CREATE ROLE`). Provide **one** of:

- Env: `APP_FACTORY_DATABASE_URL=postgresql://<privileged-user>:<pw>@<host>:5432/<db>`
- Vault file: `~/.shre/vault/app-factory-db.json`
  ```json
  { "connectionString": "postgresql://…" }
  ```
  (or `{ "host", "port", "user", "password", "database" }`)

Until configured, `POST /api/plugins` returns **501** (`provisioning backend not
configured`) — read paths are unaffected.

**Secret handling:** the generated per-app role password is written to
`~/.shre/vault/app-<subdomain>.json` (mode 0600) and is **never** returned over
the API. Rotate/relocate to OpenBao per the vault-first policy when convenient.

---

## 3. Service token for the MIB surfaces — enables Plugins in MIB

The MIB surfaces read a tenant's plugins service-to-service. Set on **each MIB
server host** (mib007 server, and the mib-desktop console host):

```bash
AROS_CONTROL_PLANE_URL=https://app.aros.live      # AROS control plane base
AROS_SERVICE_TOKEN=<the shared AROS service token> # or ~/.shre/vault/aros-platform.token
```

The AROS side already allow-lists the callers (`x-service-source`):
`shre-router`, `mib007`, `shre-command-center`, `mib-desktop` (see
`ALLOWED_PLUGIN_SERVICE_SOURCES` in `src/server.ts`). The token is the real gate;
the header is allow-listed for audit clarity.

- **mib007** already uses this exact pair for its AROS onboarding proxy — reuse it.
- **mib-desktop** is new: without the token, its Plugins page shows an empty list
  with an `unavailable` reason (never errors).

---

## 4. Verification

**AROS read (as a service):**

```bash
TOKEN=$(cat ~/.shre/vault/aros-platform.token)   # or $AROS_SERVICE_TOKEN
# Per-tenant:
curl -s -H "authorization: Bearer $TOKEN" -H "x-service-source: mib007" \
  "$AROS_CONTROL_PLANE_URL/api/plugins?tenantId=<TENANT_UUID>" | jq
# Cross-tenant (ops console):
curl -s -H "authorization: Bearer $TOKEN" -H "x-service-source: mib-desktop" \
  "$AROS_CONTROL_PLANE_URL/api/plugins/all" | jq '.tenants | length'
```

**AROS provision (service-only):**

```bash
curl -s -X POST -H "authorization: Bearer $TOKEN" -H "x-service-source: sia" \
  -H "content-type: application/json" \
  -d '{"tenantId":"<TENANT_UUID>","slug":"demo-app","displayName":"Demo App"}' \
  "$AROS_CONTROL_PLANE_URL/api/plugins" | jq
# 201 + {app:{status:"draft",…}} when configured; 501 until step 2 is done.
```

**AROS UI:** open the workspace → **Plugins**. Built apps in `preview` show a
**Confirm & publish** button (owner/admin) that promotes `preview → live`.

**mib007 / mib-desktop:** open the **Plugins** page — it lists the same apps
(mib007 per-tenant read-only; mib-desktop cross-tenant, operator view).

---

## 5. Lifecycle & guardrails (already enforced)

- `draft → preview` — AUTO on smoke pass, **service role only** (build pipeline).
- `preview → live` — **always human-approved**; the promote carries the approving
  user's `auth.users` uuid, recorded as the actor of the `promoted` event. A
  tenant admin with a stolen anon session cannot self-promote.
- `live → retired` — pipeline only (container teardown accompanies it).

Enforced twice: the `tenant_apps` DB trigger (`20260715_tenant_apps.sql`) and the
`appfactory/promote.ts` pipeline-side assertions.

---

## 6. Rollback

- Feature is additive and behind config. To disable the MIB surfaces, unset
  `AROS_SERVICE_TOKEN` on the MIB hosts — their Plugins pages go to an empty
  `unavailable` state.
- To disable provisioning, unset `APP_FACTORY_DATABASE_URL` (and remove the vault
  file) — `POST /api/plugins` returns 501; existing rows are untouched.
- The `tenant_apps` migration is `IF NOT EXISTS` throughout and safe to re-run;
  apps are **retired, never deleted** (the row anchors `db_schema` + audit).
