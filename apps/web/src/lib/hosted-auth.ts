export type HostedWorkspace = { id: string; name: string; role: string; isDefault?: boolean };

export type HostedChallenge = {
  challengeToken: string;
  challengeJwt: string;
  method: 'email_otp' | 'sms_otp';
  destination: string;
};

export const BROWSER_SESSION_ACCEPT = 'application/vnd.aros.browser-session+json';

export type HostedSessionResult = {
  user: { id: string; username: string; email: string; name: string; isSuperAdmin: boolean };
  workspace: HostedWorkspace;
};

export type HostedLoginResult =
  | ({ requiresWorkspaceSelection: true; tempToken: string; workspaces: HostedWorkspace[] })
  | ({ requiresTwoFactor: true } & HostedChallenge);

export function safeIssuerReturnTo(value: string | null): string | null {
  if (!value || value.includes('\\') || value.startsWith('//')) return null;
  try {
    const parsed = new URL(value, 'https://id.aros.live');
    if (parsed.origin !== 'https://id.aros.live' || parsed.pathname !== '/oauth/authorize') return null;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

async function postJson<T>(baseUrl: string, path: string, body: unknown, accept = 'application/json'): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: accept },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || 'Authentication failed');
  return data;
}

export const hostedAuth = {
  signup: (baseUrl: string, body: { email: string; password: string; name: string; workspaceName: string; phoneNumber?: string }) =>
    postJson<{ requiresTwoFactor: true } & HostedChallenge>(baseUrl, '/v1/auth/signup', body),
  login: (baseUrl: string, username: string, password: string) =>
    postJson<HostedLoginResult>(baseUrl, '/v1/auth/login', { username, password }),
  selectWorkspace: (baseUrl: string, tempToken: string, workspaceId: string) =>
    postJson<HostedChallenge>(baseUrl, '/v1/auth/select-workspace', { tempToken, workspaceId }),
  verifyTwoFactor: (baseUrl: string, challenge: HostedChallenge, code: string) =>
    postJson<HostedSessionResult>(baseUrl, '/v1/auth/verify-2fa', {
      challengeToken: challenge.challengeToken,
      challengeJwt: challenge.challengeJwt,
      code,
    }, BROWSER_SESSION_ACCEPT),
};
