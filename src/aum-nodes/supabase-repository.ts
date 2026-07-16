import type { SupabaseClient } from '@supabase/supabase-js';
import type { AumNodeActivation, AumNodeHeartbeat } from './contracts.js';
import type { AumNodeIdentity, AumNodeRepository } from './service.js';
export class SupabaseAumNodeRepository implements AumNodeRepository {
  constructor(private readonly db:SupabaseClient) {}
  async activate(codeHash:string,tokenHash:string,nodeId:string,input:AumNodeActivation) {
    const {data,error}=await this.db.rpc('consume_aum_node_activation',{
      p_code_hash:codeHash,p_token_hash:tokenHash,p_node_id:nodeId,p_machine_id:input.machineId,p_node_name:input.nodeName,
      p_operating_system:input.operatingSystem,p_architecture:input.architecture,p_runtime_version:input.runtimeVersion,
    });
    if(error) throw error; const row=data?.[0];
    return row ? {nodeId:row.node_id,tenantId:row.tenant_id,tokenId:row.token_id} : null;
  }
  async authenticate(tokenId:string,tokenHash:string):Promise<AumNodeIdentity|null> {
    const {data,error}=await this.db.from('aum_node_tokens').select('aum_nodes!inner(id,tenant_id)').eq('id',tokenId).eq('token_hash',tokenHash).is('revoked_at',null).maybeSingle();
    if(error) throw error; const node=(data as any)?.aum_nodes;
    return node ? {nodeId:node.id,tenantId:node.tenant_id} : null;
  }
  async heartbeat(node:AumNodeIdentity,input:AumNodeHeartbeat) {
    const {error}=await this.db.from('aum_node_heartbeats').insert({node_id:node.nodeId,tenant_id:node.tenantId,payload:input});
    if(error) throw error;
    const update=await this.db.from('aum_nodes').update({runtime_version:input.runtimeVersion,status:input.runtimeReachable?'online':'degraded',capabilities:input,last_heartbeat_at:new Date().toISOString()}).eq('id',node.nodeId).eq('tenant_id',node.tenantId).is('revoked_at',null);
    if(update.error) throw update.error;
  }
}
