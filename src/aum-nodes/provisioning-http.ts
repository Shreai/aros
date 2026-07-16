import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createSupabaseAdmin } from '../supabase.js';
import type { ProvisioningAuth } from '../edge/provisioning.js';
import { digest } from './service.js';

const managers=new Set(['owner','admin']);
const reply=(res:ServerResponse,status:number,value:unknown)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
async function body(req:IncomingMessage){const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string,unknown>;}

export async function handleAumNodeProvisioningRequest(req:IncomingMessage,res:ServerResponse,pathname:string,auth:ProvisioningAuth):Promise<boolean>{
  if(!pathname.startsWith('/api/aum/nodes'))return false;
  const db=createSupabaseAdmin();
  try{
    if(pathname==='/api/aum/nodes/activation-codes'&&req.method==='POST'){
      if(!managers.has(auth.role)){reply(res,403,{error:'insufficient_role'});return true;}
      const input=await body(req);const minutes=input.expiresInMinutes===undefined?15:Number(input.expiresInMinutes);
      if(!Number.isInteger(minutes)||minutes<5||minutes>60){reply(res,400,{error:'invalid_expiry'});return true;}
      const activationCode=randomBytes(6).toString('hex').toUpperCase().match(/.{1,4}/g)!.join('-');
      const expiresAt=new Date(Date.now()+minutes*60_000).toISOString();
      const {data,error}=await db.from('aum_node_activation_tokens').insert({tenant_id:auth.tenantId,code_hash:digest(activationCode),expires_at:expiresAt}).select('id').single();
      if(error)throw error;reply(res,201,{id:data.id,activationCode,expiresAt});return true;
    }
    if(pathname==='/api/aum/nodes'&&req.method==='GET'){
      const {data,error}=await db.from('aum_nodes').select('id,machine_id,node_name,operating_system,architecture,runtime_version,status,capabilities,last_heartbeat_at,created_at,revoked_at').eq('tenant_id',auth.tenantId).order('created_at',{ascending:false});
      if(error)throw error;reply(res,200,{nodes:data??[]});return true;
    }
    return false;
  }catch(error){if(error instanceof SyntaxError)reply(res,400,{error:'invalid_json'});else reply(res,500,{error:'aum_node_provisioning_failure'});return true;}
}
