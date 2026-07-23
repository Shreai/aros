-- Automation fire ledger — the at-most-once send authority for the sentinel
-- (mission: docs/missions/aros-automation-rules.md, slice 1b; send-path review
-- H1/H2 + Fix B). The sentinel CLAIMS a row here BEFORE it sends, via
--   INSERT ... ON CONFLICT DO NOTHING RETURNING id
-- so a returned id = this process/replica owns the send; no row = a prior pass
-- or another replica already sent it (skip, do not send).
--
-- The UNIQUE key is (tenant_id, invoice_no) — PER INVOICE. One notifyWorkspace
-- call per void fans out to EVERY opted-in member/channel from
-- notification_preferences, so per-invoice is the correct dedupe granularity.
-- Deliberately IMMUTABLE: keying on the resolved destination (a mutable pref
-- override) would let the same void re-claim under a new key if an owner edits
-- their number mid-window → a duplicate alert. channel/destination/rule_id are
-- retained as NULLABLE OBSERVABILITY columns only (which rule won attribution,
-- where it went) — never part of the dedupe constraint.
--
-- Intentionally AT-MOST-ONCE: a claim whose send then throws is recorded
-- status='send_failed' and NEVER retried (the row still blocks a refire) — for
-- owner-facing SMS one rare missed alert beats a duplicate storm.
CREATE TABLE IF NOT EXISTS public.automation_fires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rule_id uuid,
  invoice_no text NOT NULL,
  channel text,
  destination text,
  message_id text,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, invoice_no)
);

-- Window scan (already-fired pre-filter + daily counter) is keyed by tenant+time.
CREATE INDEX IF NOT EXISTS automation_fires_tenant_created
  ON public.automation_fires(tenant_id, created_at);

ALTER TABLE public.automation_fires ENABLE ROW LEVEL SECURITY;

-- Service-role only: no RLS policies and no grants to authenticated, so only
-- the platform server (service role) claims/reads fires — the same posture as
-- event_subscriptions writes. This is an internal delivery ledger, not a
-- user-facing table.
