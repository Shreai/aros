-- Resource manifests for first-party applications shared by AROS and MIB.
INSERT INTO public.provisioning_manifests(key,source_kind,source_key,version,resources) VALUES
('app.storepulse.v1','app','storepulse','1.0.0','[
 {"kind":"app","provider":"aros","name":"StorePulse","capabilities":["pos.sales.read","pos.inventory.read"]},
 {"kind":"skill","provider":"storepulse","name":"Retail Performance Analytics","capabilities":["pos.sales.read","analytics.read"]},
 {"kind":"agent","provider":"shreai","name":"Retail Analyst Agent","capabilities":["pos.sales.read","analytics.read"]}
]'::jsonb),
('app.mib.v1','app','mib','1.0.0','[
 {"kind":"app","provider":"aros","name":"MIB","capabilities":["workspace.read","agent.context"]},
 {"kind":"tool","provider":"mib","name":"MIB Workspace","capabilities":["workspace.read","workspace.write"]}
]'::jsonb),
('app.centrix.v1','app','centrix','1.0.0','[
 {"kind":"app","provider":"aros","name":"Centrix","capabilities":["support.read","support.write"]},
 {"kind":"skill","provider":"centrix","name":"Support Ticket Management","capabilities":["support.read","support.write"]}
]'::jsonb),
('app.rapidsupport.v1','app','rapidsupport','1.0.0','[
 {"kind":"app","provider":"aros","name":"RapidSupport","capabilities":["support.read","support.write"]},
 {"kind":"agent","provider":"shreai","name":"Customer Support Agent","capabilities":["support.read","support.write"]}
]'::jsonb),
('app.chat.v1','app','chat','1.0.0','[
 {"kind":"app","provider":"aros","name":"Chat","capabilities":["chat.use","agent.context"]},
 {"kind":"tool","provider":"shreai","name":"Shre Chat","capabilities":["chat.use","agent.context"]}
]'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  source_kind=EXCLUDED.source_kind,
  source_key=EXCLUDED.source_key,
  version=EXCLUDED.version,
  resources=EXCLUDED.resources,
  active=true,
  updated_at=now();

DO $$
DECLARE e record;
BEGIN
  FOR e IN SELECT tenant_id,app_key,enabled_by FROM public.marketplace_app_entitlements WHERE status='active'
  LOOP
    PERFORM public.apply_provisioning_manifest(
      e.tenant_id,'app',e.app_key,
      'app.' || e.app_key || '.v1',true,e.enabled_by
    ) WHERE EXISTS (
      SELECT 1 FROM public.provisioning_manifests m WHERE m.key='app.' || e.app_key || '.v1' AND m.active
    );
  END LOOP;
END $$;
