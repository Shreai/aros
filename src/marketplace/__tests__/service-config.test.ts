import { describe, it, expect } from 'vitest';
import { publicServiceConfig } from '../service-config';

describe('publicServiceConfig', () => {
  it('strips provisioning secrets, keeps client-facing fields', () => {
    const full = {
      scopes: ['documents:read', 'documents:write'],
      storeIds: ['s1', 's2'],
      activationState: 'needs_store',
      mibServiceTokenEnc: 'AAAA-encrypted-token-ciphertext',
      mibWorkspaceId: 'fb49a145-55d7-4702-8913-239cfeb6306a',
      mibTokenRegistered: false,
    };
    const out = publicServiceConfig(full);
    expect(out).toEqual({ scopes: ['documents:read', 'documents:write'], storeIds: ['s1', 's2'], activationState: 'needs_store' });
    // The token blob and workspace mapping must not survive the projection.
    expect(JSON.stringify(out)).not.toContain('mib');
    expect(JSON.stringify(out)).not.toContain('encrypted');
  });

  it('handles null / non-object / empty configs', () => {
    expect(publicServiceConfig(null)).toEqual({});
    expect(publicServiceConfig(undefined)).toEqual({});
    expect(publicServiceConfig('nope')).toEqual({});
    expect(publicServiceConfig({})).toEqual({});
  });

  it('omits fields of the wrong type rather than passing them through', () => {
    expect(publicServiceConfig({ scopes: 'not-an-array', activationState: 42 })).toEqual({});
  });
});
