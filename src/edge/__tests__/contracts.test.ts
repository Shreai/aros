import { describe, expect, it } from 'vitest';
import { validateActivation, validateEventBatch, validateHeartbeat } from '../contracts.js';

const activation = { activationCode:'code', machineId:'machine', siteId:'site', serviceVersion:'1', connectorVersion:'1', operatingSystem:'windows', architecture:'x64' };
const heartbeat = { serviceVersion:'1', connectorVersion:'1', commanderReachable:true, queueDepth:0, diskUsageBytes:1, capabilities:['catalog.read'] };
const event = { eventId:'evt-1', eventType:'verifone.item.snapshot', sourceId:'123', sourceTimestamp:'2026-07-15T00:00:00Z', idempotencyKey:'item:123:v1', payload:{ plu:'123' } };
const batch = { schemaVersion:'1.0', tenantId:'tenant', storeId:'store', deviceId:'device', provider:'verifone', batchId:'batch', sequence:1, capturedAt:'2026-07-15T00:00:00Z', events:[event] };

describe('edge contracts', () => {
  it('validates enrollment and heartbeat payloads', () => {
    expect(validateActivation(activation)).toBe(true);
    expect(validateHeartbeat(heartbeat)).toBe(true);
    expect(validateHeartbeat({ ...heartbeat, queueDepth: -1 })).toBe(false);
  });
  it('accepts a typed batch and rejects unknown event types', () => {
    expect(validateEventBatch(batch)).toBe(true);
    expect(validateEventBatch({ ...batch, events:[{ ...event, eventType:'verifone.sync.tick' }] })).toBe(true);
    expect(validateEventBatch({ ...batch, events:[{ ...event, eventType:'commander.password' }] })).toBe(false);
  });
  it('enforces the 500-event request bound', () => {
    expect(validateEventBatch({ ...batch, events:Array.from({length:501}, (_, i) => ({...event,eventId:String(i)})) })).toBe(false);
  });
});
