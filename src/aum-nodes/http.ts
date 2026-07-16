import type { IncomingMessage, ServerResponse } from 'node:http';
import { createSupabaseAdmin } from '../supabase.js';
import { validActivation, validHeartbeat } from './contracts.js';
import { AumNodeService } from './service.js';
import { SupabaseAumNodeRepository } from './supabase-repository.js';
const reply=(res:ServerResponse,status:number,value:unknown)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
async function body(req:IncomingMessage){const chunks:Buffer[]=[];let size=0;for await(const chunk of req){const part=Buffer.from(chunk);size+=part.length;if(size>262144)throw new Error('BODY_TOO_LARGE');chunks.push(part);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
export async function handleAumNodeRequest(req:IncomingMessage,res:ServerResponse,pathname:string):Promise<boolean>{
  if(!pathname.startsWith('/v1/aum/nodes/'))return false;
  const service=new AumNodeService(new SupabaseAumNodeRepository(createSupabaseAdmin()));
  try{
    if(pathname==='/v1/aum/nodes/activate'&&req.method==='POST'){const input=await body(req);if(!validActivation(input)){reply(res,400,{error:'invalid_activation'});return true;}const result=await service.activate(input);reply(res,result?201:401,result??{error:'invalid_or_expired_activation'});return true;}
    const token=req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];const node=token?await service.authenticate(token):null;
    if(!node){reply(res,401,{error:'invalid_node_credential'});return true;}
    if(pathname==='/v1/aum/nodes/heartbeat'&&req.method==='POST'){const input=await body(req);if(!validHeartbeat(input)){reply(res,400,{error:'invalid_heartbeat'});return true;}reply(res,202,await service.heartbeat(node,input));return true;}
    reply(res,404,{error:'not_found'});return true;
  }catch(error){if(error instanceof Error&&error.message==='BODY_TOO_LARGE')reply(res,413,{error:'payload_too_large'});else if(error instanceof SyntaxError)reply(res,400,{error:'invalid_json'});else reply(res,500,{error:'aum_node_control_plane_failure'});return true;}
}
