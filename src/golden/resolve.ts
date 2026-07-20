// Regulars golden records (task #17) — canonical resolution.
// resolveCanonical() is the ONE entry point every ingest/read uses to turn a
// (source_system, source_id) + strong match keys into a stable canonical_id.
// Guarantees: the alias registry is checked first (a resolved duplicate can
// never be re-created); a single strong deterministic match auto-links; zero
// or multiple matches create a FRESH canonical id + a merge_candidate for the
// review queue (NEVER an auto-merge on a non-exact match). Plan §10.
// Mission: docs/missions/regulars-golden-records.md (in the regulars repo).

export type EntityType = 'product' | 'location' | 'customer';

export interface ResolveInput {
  tenantId: string;
  entityType: EntityType;
  sourceSystem: string;
  sourceId: string;
  /** Strong deterministic keys. Products: {upc|gtin|sku}. Locations: {geohash|address_norm}. */
  matchKeys: Record<string, string>;
  displayName?: string;
}

export interface ResolveResult {
  canonicalId: string;
  outcome: 'alias_hit' | 'auto_linked' | 'created_flagged' | 'created_clean';
  candidateIds?: string[];
}

/** Minimal DB port — lets the resolver be unit-tested with a stub and run on
 *  the real service-role client in the app. */
export interface GoldenStore {
  findAliasCanonicalId(i: { tenantId: string; entityType: string; sourceSystem: string; sourceId: string }): Promise<string | null>;
  /** Canonical records in this tenant/type whose match_keys share a STRONG key value. */
  findStrongMatches(i: { tenantId: string; entityType: string; matchKeys: Record<string, string> }): Promise<string[]>;
  createCanonical(i: { tenantId: string; entityType: string; displayName?: string; matchKeys: Record<string, string> }): Promise<string>;
  writeAlias(i: { tenantId: string; entityType: string; sourceSystem: string; sourceId: string; canonicalId: string }): Promise<void>;
  flagCandidate(i: { tenantId: string; entityType: string; canonicalId: string; candidateIds: string[] }): Promise<void>;
}
// NOTE (review-queue increment): kept-separate suppression lives in the
// `negative_pair` table but is NOT wired here yet. It cannot be evaluated at
// resolve time against a brand-new canonical id (which has no prior verdicts);
// it belongs in the merge/review flow, which compares two EXISTING canonicals.
// Foundation increment deliberately flags all strong-match candidates.

/** The STRONG keys per entity type — only these auto-link. Everything else is
 *  fuzzy (a later increment) and must never auto-merge. */
const STRONG_KEYS: Record<EntityType, string[]> = {
  product: ['upc', 'gtin', 'sku'],
  location: ['geohash', 'address_norm'],
  customer: ['phone_hash', 'email_hash'],
};

function strongSubset(entityType: EntityType, keys: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of STRONG_KEYS[entityType]) if (keys[k]) out[k] = keys[k];
  return out;
}

export async function resolveCanonical(store: GoldenStore, input: ResolveInput): Promise<ResolveResult> {
  const { tenantId, entityType, sourceSystem, sourceId } = input;

  // (1) Alias registry FIRST — a previously resolved source can never re-create.
  const existing = await store.findAliasCanonicalId({ tenantId, entityType, sourceSystem, sourceId });
  if (existing) return { canonicalId: existing, outcome: 'alias_hit' };

  const strong = strongSubset(entityType, input.matchKeys);

  // No strong key at all → cannot deterministically match; create clean.
  // (A fuzzy pass may later raise a candidate, but we never auto-link here.)
  if (Object.keys(strong).length === 0) {
    const id = await store.createCanonical({ tenantId, entityType, displayName: input.displayName, matchKeys: input.matchKeys });
    await store.writeAlias({ tenantId, entityType, sourceSystem, sourceId, canonicalId: id });
    return { canonicalId: id, outcome: 'created_clean' };
  }

  // (2) Deterministic match on strong keys.
  const matches = await store.findStrongMatches({ tenantId, entityType, matchKeys: strong });

  if (matches.length === 1) {
    // (3) Exactly one strong match → auto-link (write alias so it sticks).
    const canonicalId = matches[0];
    await store.writeAlias({ tenantId, entityType, sourceSystem, sourceId, canonicalId });
    return { canonicalId, outcome: 'auto_linked' };
  }

  // (4) Zero or MULTIPLE strong matches → fresh canonical id, never auto-merge.
  const canonicalId = await store.createCanonical({ tenantId, entityType, displayName: input.displayName, matchKeys: input.matchKeys });
  await store.writeAlias({ tenantId, entityType, sourceSystem, sourceId, canonicalId });

  if (matches.length > 1) {
    // Multiple plausible strong matches → flag for the review queue. We do NOT
    // pick one (that would be an auto-merge on ambiguity) and do NOT merge the
    // matched canonicals with each other. The human resolves in the queue.
    await store.flagCandidate({ tenantId, entityType, canonicalId, candidateIds: matches });
    return { canonicalId, outcome: 'created_flagged', candidateIds: matches };
  }
  return { canonicalId, outcome: 'created_clean' };
}
