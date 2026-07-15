import type { IncomingMessage, ServerResponse } from 'node:http';
import { createSupabaseAdmin } from '../supabase.js';
import { validateActivation, validateEventBatch, validateHeartbeat } from './contracts.js';
import { EdgeService } from './service.js';
import { SupabaseEdgeRepository } from './supabase-repository.js';

const reply = (res: ServerResponse, status: number, value: unknown) => {
  res.writeHead(status, { 'content-type':'application/json' }); res.end(JSON.stringify(value));
};
async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[]=[]; let size=0;
  for await (const chunk of req) { const part=Buffer.from(chunk); size+=part.length; if(size>1_048_576) throw new Error('BODY_TOO_LARGE'); chunks.push(part); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function handleEdgeRequest(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
  if (!pathname.startsWith('/v1/edge/')) return false;
  if (req.method !== 'POST') { reply(res,405,{error:'method_not_allowed'}); return true; }
  const service=new EdgeService(new SupabaseEdgeRepository(createSupabaseAdmin()));
  try {
    const input=await readBody(req);
    if(pathname==='/v1/edge/activate') {
      if(!validateActivation(input)){ reply(res,400,{error:'invalid_activation'}); return true; }
      const activated=await service.activate(input); reply(res,activated?201:401,activated??{error:'invalid_or_expired_activation'}); return true;
    }
    const token=req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    const device=token ? await service.authenticate(token) : null;
    if(!device){ reply(res,401,{error:'invalid_device_credential'}); return true; }
    if(pathname==='/v1/edge/heartbeat') {
      if(!validateHeartbeat(input)){ reply(res,400,{error:'invalid_heartbeat'}); return true; }
      reply(res,202,await service.heartbeat(device,input)); return true;
    }
    if(pathname==='/v1/edge/events/batch') {
      if(!validateEventBatch(input)){ reply(res,400,{error:'invalid_event_batch'}); return true; }
      try { reply(res,202,await service.ingest(device,input)); }
      catch(error) { if(error instanceof Error && error.message==='EDGE_OWNERSHIP_MISMATCH') reply(res,403,{error:'device_scope_mismatch'}); else throw error; }
      return true;
    }
    reply(res,404,{error:'not_found'}); return true;
  } catch(error) {
    if(error instanceof Error && error.message==='BODY_TOO_LARGE') reply(res,413,{error:'payload_too_large'});
    else if(error instanceof SyntaxError) reply(res,400,{error:'invalid_json'});
    else reply(res,500,{error:'edge_control_plane_failure'});
    return true;
  }
}
