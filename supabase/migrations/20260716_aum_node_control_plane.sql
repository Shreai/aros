CREATE TABLE IF NOT EXISTS public.aum_node_activation_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.aum_nodes (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  machine_id TEXT NOT NULL,
  node_name TEXT NOT NULL,
  operating_system TEXT NOT NULL,
  architecture TEXT NOT NULL,
  runtime_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enrolled',
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_heartbeat_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (tenant_id, machine_id)
);

CREATE TABLE IF NOT EXISTS public.aum_node_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES aum_nodes(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.aum_node_heartbeats (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  node_id UUID NOT NULL REFERENCES aum_nodes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE aum_node_activation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE aum_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE aum_node_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE aum_node_heartbeats ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION consume_aum_node_activation(
  p_code_hash TEXT, p_node_id UUID, p_machine_id TEXT, p_node_name TEXT,
  p_operating_system TEXT, p_architecture TEXT, p_runtime_version TEXT, p_token_hash TEXT
) RETURNS TABLE(node_id UUID, tenant_id UUID, token_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE activation aum_node_activation_tokens%ROWTYPE; issued_token UUID := gen_random_uuid();
BEGIN
  SELECT * INTO activation FROM aum_node_activation_tokens WHERE code_hash=p_code_hash FOR UPDATE;
  IF NOT FOUND OR activation.consumed_at IS NOT NULL OR activation.expires_at <= now() THEN RETURN; END IF;
  INSERT INTO aum_nodes(id,tenant_id,machine_id,node_name,operating_system,architecture,runtime_version)
    VALUES(p_node_id,activation.tenant_id,p_machine_id,p_node_name,p_operating_system,p_architecture,p_runtime_version);
  INSERT INTO aum_node_tokens(id,node_id,token_hash) VALUES(issued_token,p_node_id,p_token_hash);
  UPDATE aum_node_activation_tokens SET consumed_at=now() WHERE id=activation.id;
  INSERT INTO audit_log(tenant_id,action,resource,detail)
    VALUES(activation.tenant_id,'aum.node.enrolled','aum_node',jsonb_build_object('node_id',p_node_id,'machine_id',p_machine_id));
  RETURN QUERY SELECT p_node_id,activation.tenant_id,issued_token;
END $$;
