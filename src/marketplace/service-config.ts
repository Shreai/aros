// Pure projection of a marketplace entitlement's service_config for API
// responses. service_config also carries provisioning secrets (the encrypted
// MIB Documents token, the workspace mapping, registration flags) — those must
// never reach a browser, even encrypted, even for an admin. Whitelist only the
// fields the web client legitimately reads.

export interface PublicServiceConfig {
  scopes?: string[];
  storeIds?: string[];
  activationState?: string;
}

export function publicServiceConfig(config: unknown): PublicServiceConfig {
  if (typeof config !== 'object' || config === null) return {};
  const c = config as Record<string, unknown>;
  const out: PublicServiceConfig = {};
  if (Array.isArray(c.scopes)) out.scopes = c.scopes as string[];
  if (Array.isArray(c.storeIds)) out.storeIds = c.storeIds as string[];
  if (typeof c.activationState === 'string') out.activationState = c.activationState;
  return out;
}
