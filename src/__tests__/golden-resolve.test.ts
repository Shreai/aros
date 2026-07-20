import { describe, expect, it, beforeEach } from 'vitest';
import { resolveCanonical, type GoldenStore, type ResolveInput } from '../golden/resolve.js';

// In-memory GoldenStore stub — exercises the real decision table without a DB.
class FakeStore implements GoldenStore {
  aliases = new Map<string, string>();           // "sys|id" -> canonicalId
  canon = new Map<string, Record<string, string>>(); // canonicalId -> strong keys
  candidates: Array<{ canonicalId: string; candidateIds: string[] }> = [];
  seq = 0;

  async findAliasCanonicalId(i: { sourceSystem: string; sourceId: string }) {
    return this.aliases.get(`${i.sourceSystem}|${i.sourceId}`) ?? null;
  }
  async findStrongMatches(i: { matchKeys: Record<string, string> }) {
    const hits: string[] = [];
    for (const [id, keys] of this.canon) {
      if (Object.entries(i.matchKeys).some(([k, v]) => keys[k] === v)) hits.push(id);
    }
    return hits;
  }
  async createCanonical(i: { matchKeys: Record<string, string> }) {
    const id = `c${++this.seq}`;
    this.canon.set(id, i.matchKeys);
    return id;
  }
  async writeAlias(i: { sourceSystem: string; sourceId: string; canonicalId: string }) {
    this.aliases.set(`${i.sourceSystem}|${i.sourceId}`, i.canonicalId);
  }
  async flagCandidate(i: { canonicalId: string; candidateIds: string[] }) {
    this.candidates.push({ canonicalId: i.canonicalId, candidateIds: i.candidateIds });
  }
}

const base = (over: Partial<ResolveInput> = {}): ResolveInput => ({
  tenantId: 't1', entityType: 'product', sourceSystem: 'rapidrms', sourceId: 's1',
  matchKeys: { upc: '012345678905' }, ...over,
});

let store: FakeStore;
beforeEach(() => { store = new FakeStore(); });

describe('resolveCanonical — the golden-record decision table', () => {
  it('alias hit short-circuits (a resolved source never re-creates)', async () => {
    const first = await resolveCanonical(store, base());
    expect(first.outcome).toBe('created_clean'); // no prior canon → fresh
    const again = await resolveCanonical(store, base()); // same source pair
    expect(again.outcome).toBe('alias_hit');
    expect(again.canonicalId).toBe(first.canonicalId);
  });

  it('single strong match auto-links and persists the alias', async () => {
    // seed an existing canonical product with the same UPC from a different source
    const seed = await resolveCanonical(store, base({ sourceId: 'existing' }));
    const incoming = await resolveCanonical(store, base({ sourceSystem: 'pos_snapshot', sourceId: 'new' }));
    expect(incoming.outcome).toBe('auto_linked');
    expect(incoming.canonicalId).toBe(seed.canonicalId);
    // and it stuck — re-ingesting the same new source is now an alias hit
    const repeat = await resolveCanonical(store, base({ sourceSystem: 'pos_snapshot', sourceId: 'new' }));
    expect(repeat.outcome).toBe('alias_hit');
  });

  it('no strong key → clean create, never auto-links on weak data', async () => {
    const r = await resolveCanonical(store, base({ matchKeys: { name: 'Generic Widget' } }));
    expect(r.outcome).toBe('created_clean');
    // a second weak-key item does NOT link to the first (no auto-merge on fuzzy)
    const r2 = await resolveCanonical(store, base({ sourceId: 's2', matchKeys: { name: 'Generic Widget' } }));
    expect(r2.outcome).toBe('created_clean');
    expect(r2.canonicalId).not.toBe(r.canonicalId);
  });

  it('multiple strong matches → fresh id + flagged candidate, never auto-merge', async () => {
    // two pre-existing canon records that BOTH carry a key the newcomer shares
    await resolveCanonical(store, base({ sourceId: 'a', matchKeys: { upc: 'X' } }));
    await resolveCanonical(store, base({ sourceId: 'b', matchKeys: { sku: 'Y' } }));
    const newcomer = await resolveCanonical(store, base({ sourceId: 'c', matchKeys: { upc: 'X', sku: 'Y' } }));
    expect(newcomer.outcome).toBe('created_flagged');
    expect(newcomer.candidateIds?.length).toBe(2);
    expect(store.candidates).toHaveLength(1);
  });

  it('flagged candidate never auto-merges the matched canonicals with each other', async () => {
    const a = await resolveCanonical(store, base({ sourceId: 'a', matchKeys: { upc: 'X' } }));
    const b = await resolveCanonical(store, base({ sourceId: 'b', matchKeys: { sku: 'Y' } }));
    const newcomer = await resolveCanonical(store, base({ sourceId: 'c', matchKeys: { upc: 'X', sku: 'Y' } }));
    // fresh id, distinct from both matches; A and B remain their own records
    expect(newcomer.canonicalId).not.toBe(a.canonicalId);
    expect(newcomer.canonicalId).not.toBe(b.canonicalId);
    expect(store.canon.get(a.canonicalId)).toBeDefined();
    expect(store.canon.get(b.canonicalId)).toBeDefined();
    expect(newcomer.candidateIds).toEqual(expect.arrayContaining([a.canonicalId, b.canonicalId]));
  });

  it('location entity uses geohash as a strong key', async () => {
    const seed = await resolveCanonical(store, base({ entityType: 'location', matchKeys: { geohash: 'dn5bp' }, sourceId: 'loc-a' }));
    const dup = await resolveCanonical(store, base({ entityType: 'location', matchKeys: { geohash: 'dn5bp' }, sourceSystem: 'manual', sourceId: 'loc-b' }));
    expect(dup.outcome).toBe('auto_linked');
    expect(dup.canonicalId).toBe(seed.canonicalId);
  });
});
