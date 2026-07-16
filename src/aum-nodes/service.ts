import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AumNodeActivation, AumNodeHeartbeat } from './contracts.js';

export interface AumNodeIdentity { nodeId: string; tenantId: string }
export interface AumNodeRepository {
  activate(codeHash:string, tokenHash:string, nodeId:string, input:AumNodeActivation):Promise<(AumNodeIdentity & {tokenId:string}) | null>;
  authenticate(tokenId:string, tokenHash:string):Promise<AumNodeIdentity | null>;
  heartbeat(node:AumNodeIdentity, input:AumNodeHeartbeat):Promise<void>;
}
export const digest = (value:string) => createHash('sha256').update(value).digest('hex');
export class AumNodeService {
  constructor(private readonly repository:AumNodeRepository) {}
  async activate(input:AumNodeActivation) {
    const secret=randomBytes(32).toString('base64url');
    const enrolled=await this.repository.activate(digest(input.activationCode),digest(secret),randomUUID(),input);
    return enrolled ? {nodeId:enrolled.nodeId,tenantId:enrolled.tenantId,accessToken:`${enrolled.tokenId}.${secret}`} : null;
  }
  async authenticate(token:string) {
    const [id,secret,...rest]=token.split('.');
    return id && secret && rest.length===0 ? this.repository.authenticate(id,digest(secret)) : null;
  }
  async heartbeat(node:AumNodeIdentity,input:AumNodeHeartbeat) {
    await this.repository.heartbeat(node,input); return {acceptedAt:new Date().toISOString()};
  }
}
