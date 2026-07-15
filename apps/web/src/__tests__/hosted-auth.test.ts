import { afterEach, describe, expect, it, vi } from 'vitest';
import { BROWSER_SESSION_ACCEPT, hostedAuth, type HostedChallenge } from '../lib/hosted-auth';

describe('hosted auth browser completion', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('explicitly requests the cookie-only response media type for 2FA completion', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      user: { id: 'user-1', username: 'nir', email: 'nir@example.com', name: 'Nir', isSuperAdmin: false },
      workspace: { id: 'ws-1', name: 'Workspace', role: 'owner' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const challenge: HostedChallenge = {
      challengeToken: 'challenge', challengeJwt: 'jwt', method: 'email_otp', destination: 'n***@example.com',
    };

    const result = await hostedAuth.verifyTwoFactor('https://auth.example.com', challenge, '123456');

    expect(result.workspace.id).toBe('ws-1');
    expect(fetchMock).toHaveBeenCalledWith('https://auth.example.com/v1/auth/verify-2fa', expect.objectContaining({
      credentials: 'include',
      headers: expect.objectContaining({ Accept: BROWSER_SESSION_ACCEPT }),
    }));
  });
});
