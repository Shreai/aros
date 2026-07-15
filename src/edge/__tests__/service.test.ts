import { describe, expect, it } from 'vitest';
import { EdgeService, hashSecret, type DeviceIdentity, type EdgeRepository } from '../service.js';
import type { EventBatchRequest, HeartbeatRequest } from '../contracts.js';

class FakeRepository implements EdgeRepository {
  used = false; revoked = false; heartbeat?: HeartbeatRequest; keys = new Set<string>();
  device: DeviceIdentity = { deviceId:'device', tenantId:'tenant', storeId:'store', provider:'verifone' };
  async consumeActivation(codeHash:string, _machine:string, _deviceId:string, _tokenHash:string) {
    if (this.used || codeHash !== hashSecret('one-time')) return null;
    this.used = true; return { ...this.device, tokenId:'token' };
  }
  async findDeviceByToken(compound:string) { return !this.revoked && compound.startsWith('token:') ? this.device : null; }
  async recordHeartbeat(_device:DeviceIdentity, heartbeat:HeartbeatRequest) { this.heartbeat=heartbeat; }
  async persistBatch(_device:DeviceIdentity, batch:EventBatchRequest) {
    return batch.events.map(event => { const duplicate=this.keys.has(event.idempotencyKey); this.keys.add(event.idempotencyKey); return {eventId:event.eventId,status:duplicate?'duplicate' as const:'accepted' as const}; });
  }
  async getConfiguration(device:DeviceIdentity) {
    if (this.revoked || device.tenantId !== this.device.tenantId || device.storeId !== this.device.storeId) return null;
    return {mode:'read_only' as const,syncIntervalSeconds:300,enabledReadCapabilities:['catalog.read','price.write'],configVersion:2};
  }
}

const event = { eventId:'event', eventType:'verifone.item.snapshot' as const, sourceId:'sku', sourceTimestamp:'2026-07-15T00:00:00Z', idempotencyKey:'sku:v1', payload:{} };
const batch: EventBatchRequest = { schemaVersion:'1.0',tenantId:'tenant',storeId:'store',deviceId:'device',provider:'verifone',batchId:'batch',sequence:1,capturedAt:'2026-07-15T00:00:00Z',events:[event] };

describe('EdgeService', () => {
  it('consumes an activation code once and issues a scoped opaque token', async () => {
    const service=new EdgeService(new FakeRepository());
    const input={activationCode:'one-time',machineId:'m',siteId:'s',serviceVersion:'1',connectorVersion:'1',operatingSystem:'windows',architecture:'x64'};
    const enrolled=await service.activate(input);
    expect(enrolled?.accessToken).toMatch(/^token\./);
    expect(await service.activate(input)).toBeNull();
  });
  it('rejects cross-tenant batches and acknowledges replay independently', async () => {
    const repo=new FakeRepository(); const service=new EdgeService(repo);
    await expect(service.ingest(repo.device,{...batch,tenantId:'other'})).rejects.toThrow('EDGE_OWNERSHIP_MISMATCH');
    expect((await service.ingest(repo.device,batch)).events[0].status).toBe('accepted');
    expect((await service.ingest(repo.device,{...batch,batchId:'batch2'})).events[0].status).toBe('duplicate');
  });
  it('denies revoked device credentials', async () => {
    const repo=new FakeRepository(); const service=new EdgeService(repo); repo.revoked=true;
    expect(await service.authenticate('token.secret')).toBeNull();
  });
  it('returns only scoped read-only device configuration', async () => {
    const repo=new FakeRepository(); const service=new EdgeService(repo);
    expect(await service.configuration(repo.device)).toEqual({mode:'read_only',syncIntervalSeconds:300,enabledReadCapabilities:['catalog.read'],configVersion:2});
    await expect(service.configuration({...repo.device,tenantId:'other'})).rejects.toThrow('EDGE_DEVICE_NOT_FOUND');
  });
});
