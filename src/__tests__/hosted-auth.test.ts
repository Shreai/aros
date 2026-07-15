import { describe, expect, it } from 'vitest';
import { safeIssuerReturnTo } from '../../apps/web/src/lib/hosted-auth';

describe('safeIssuerReturnTo', () => {
  it('accepts only issuer-internal authorization resumes', () => {
    expect(safeIssuerReturnTo('/oauth/authorize?client_id=mib&state=abc')).toBe('/oauth/authorize?client_id=mib&state=abc');
  });

  it.each([
    'https://mib.aros.live/callback',
    '//evil.example/oauth/authorize',
    '/oauth/authorize\\evil',
    '/dashboard',
    'https://id.aros.live.evil.example/oauth/authorize',
  ])('rejects %s', (value) => expect(safeIssuerReturnTo(value)).toBeNull());
});
