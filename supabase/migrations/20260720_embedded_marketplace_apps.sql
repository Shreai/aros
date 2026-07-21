-- Documents and EDI Invoices become installable marketplace apps rendered
-- in-shell (embedded=true, relative launch_url) instead of fixed workspace
-- nav entries. The web shell derives nav + route gating from the tenant's
-- marketplace_app_entitlements; installing `documents` still triggers
-- provisionDocumentsAccess() on the server exactly as before.

ALTER TABLE public.platform_apps
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS embedded boolean NOT NULL DEFAULT false;

INSERT INTO public.platform_apps(id,name,launch_url,repo,vault_namespace,required_scopes,status,description,embedded) VALUES
('documents','Documents','/documents','Shreai/aros/apps/web','shre/aros/documents',ARRAY['documents:read','documents:write'],'active','Workspace document storage — upload, organize, and let agents ground answers in your files.',true),
('edi-invoices','EDI Invoices','/edi-invoices','Shreai/aros/apps/web','shre/aros/edi-invoices',ARRAY['edi:read'],'active','Supplier EDI invoices synced from your store connections.',true)
ON CONFLICT(id) DO UPDATE SET
  name=EXCLUDED.name, launch_url=EXCLUDED.launch_url, repo=EXCLUDED.repo,
  vault_namespace=EXCLUDED.vault_namespace, required_scopes=EXCLUDED.required_scopes,
  status=EXCLUDED.status, description=EXCLUDED.description, embedded=EXCLUDED.embedded;

-- Existing workspaces were using Documents/EDI while they were fixed nav
-- entries; grandfather them in so the IA change removes nothing they had.
INSERT INTO public.marketplace_app_entitlements (tenant_id, app_key, status, source, enabled_at, role_mapping, service_config, metadata)
SELECT t.id, app.key, 'active', 'migration-grandfather', now(), '{}'::jsonb, '{}'::jsonb, '{"nodeId":"' || app.key || '"}'::jsonb
FROM public.tenants t
CROSS JOIN (VALUES ('documents'), ('edi-invoices')) AS app(key)
ON CONFLICT (tenant_id, app_key) DO NOTHING;
