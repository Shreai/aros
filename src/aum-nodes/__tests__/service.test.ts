import { describe, expect, it } from 'vitest';
import type { AumNodeActivation, AumNodeHeartbeat } from '../contracts.js';
import { AumNodeService, digest, type AumNodeRepository } from '../service.js';

class Repository implements AumNodeRepository {
  heartbeatValue?: AumNodeHeartbeat;
  async activate(codeHash:string,_tokenHash:string,nodeId:string,_input:AumNodeActivation){return codeHash===digest('valid')?{nodeId,tenantId:'tenant',tokenId:'token'}:null;}
  async authenticate(tokenId:string,tokenHash:string){return tokenId==='token'&&tokenHash===digest('secret')?{nodeId:'node',tenantId:'tenant'}:null;}
  async heartbeat(_node:{nodeId:string;tenantId:string},input:AumNodeHeartbeat){this.heartbeatValue=input;}
}

const activation:AumNodeActivation={activationCode:'valid',machineId:'machine',nodeName:'Node',operatingSystem:'win32',architecture:'x64',runtimeVersion:'0.1.0'};
const heartbeat:AumNodeHeartbeat={runtimeVersion:'0.1.0',runtimeReachable:true,models:['mib:7b'],tools:['files.read'],skills:['support'],features:['offline-capable']};

describe('AumNodeService',()=>{
  it('issues a scoped credential only for a valid one-time activation',async()=>{
    const service=new AumNodeService(new Repository());
    expect((await service.activate(activation))?.accessToken).toMatch(/^token\./);
    expect(await service.activate({...activation,activationCode:'invalid'})).toBeNull();
  });
  it('authenticates hashed credentials and records capability heartbeats',async()=>{
    const repo=new Repository();const service=new AumNodeService(repo);
    expect(await service.authenticate('token.secret')).toEqual({nodeId:'node',tenantId:'tenant'});
    await service.heartbeat({nodeId:'node',tenantId:'tenant'},heartbeat);
    expect(repo.heartbeatValue?.models).toEqual(['mib:7b']);
  });
});
