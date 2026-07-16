import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWhitelabel } from '../whitelabel/WhitelabelProvider';

const API_BASE = (window as any).__AROS_API_URL__
  || (window.location.hostname === 'localhost' ? 'http://localhost:5457' : '');

// Human-readable scope descriptions for the consent screen.
const SCOPE_LABELS: Record<string, string> = {
  'pos:read': 'Read your sales, inventory, and margins',
  'pos:write': 'Create orders and update prices (with your approval)',
  'fuel:read': 'Read your fuel sales and tank levels',
};

/**
 * OAuth consent screen for the AROS AI connector.
 *
 * When a store owner adds AROS to Claude / ChatGPT / Gemini, the connector's
 * OAuth /authorize redirects here (aros.live/authorize?...). Because this route
 * is wrapped in <ProtectedRoute>, an unauthenticated user is sent through the
 * SAME login as the web app — so the experience is one consistent AROS, whether
 * they signed up on the web or are connecting via an AI assistant.
 *
 * Backend contract (owned by the connector OAuth service — mib007
 * connector-oauth.ts): POST {authorizeEndpoint} with the OAuth params + the
 * user's session bearer → returns { redirectUrl } (redirect_uri + code + state).
 */
export function ConnectorConsent() {
  const { session, tenant, user } = useAuth();
  // Same white-label config the rest of the app uses — so a custom-domain
  // connector shows the customer's brand/logo/colors, not a separate theme.
  const { config } = useWhitelabel();
  const brandName = config.brand.name;
  const brandColor = config.theme.colors.primary || '#3b5bdb';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('client_id') || '';
  const clientName = params.get('client_name') || 'An AI assistant';
  const redirectUri = params.get('redirect_uri') || '';
  const scope = params.get('scope') || 'pos:read';
  const state = params.get('state') || '';
  const connector = params.get('connector') || 'aros';
  const codeChallenge = params.get('code_challenge') || '';
  const codeChallengeMethod = params.get('code_challenge_method') || 'S256';
  const scopes = scope.split(/[\s+]/).filter(Boolean);

  function denyAndReturn() {
    if (!redirectUri) return;
    const u = new URL(redirectUri);
    u.searchParams.set('error', 'access_denied');
    if (state) u.searchParams.set('state', state);
    window.location.href = u.toString();
  }

  async function allow() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/connector/oauth/authorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          clientId,
          redirectUri,
          scope,
          state,
          connector,
          codeChallenge,
          codeChallengeMethod,
          tenantId: tenant?.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not complete the connection.');
      const target = data.redirectUrl || data.redirect_url;
      if (!target) throw new Error('No redirect returned from the authorization server.');
      window.location.href = target;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete the connection.');
      setLoading(false);
    }
  }

  if (!redirectUri) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <h2 style={styles.title}>Invalid connection request</h2>
          <p style={styles.desc}>This link is missing required information. Please start again from your AI assistant.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.logo}>{brandName}</div>
        <h2 style={styles.title}>{clientName} wants to connect</h2>
        <p style={styles.desc}>
          Allow <strong>{clientName}</strong> to work with your store
          {tenant?.name ? <> — <strong>{tenant.name}</strong></> : ''} through {brandName}.
          You're signed in as {user?.email}.
        </p>

        <div style={styles.scopeBox}>
          <div style={styles.scopeHead}>This will let it:</div>
          <ul style={styles.scopeList}>
            {scopes.map((s) => (
              <li key={s} style={styles.scopeItem}>
                <span style={{ color: '#059669', marginRight: 8 }}>✓</span>
                {SCOPE_LABELS[s] || s}
              </li>
            ))}
          </ul>
        </div>

        <p style={styles.fine}>
          Your POS credentials never leave your store. You can revoke access anytime
          from your {brandName} dashboard.
        </p>

        {error && <div style={styles.error}>{error}</div>}

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button type="button" onClick={allow} disabled={loading} style={{ ...styles.button, flex: 1, background: brandColor }}>
            {loading ? 'Connecting…' : 'Allow'}
          </button>
          <button type="button" onClick={denyAndReturn} disabled={loading} style={{ ...styles.button, flex: 1, background: '#f3f4f6', color: '#374151' }}>
            Deny
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #f0f4ff 0%, #e8ecf8 50%, #f5f3ff 100%)', padding: '48px 24px',
  },
  card: {
    background: '#fff', borderRadius: 16, padding: '36px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    border: '1px solid #e5e7eb', maxWidth: 440, width: '100%',
  },
  logo: { fontSize: 24, fontWeight: 800, letterSpacing: -1, color: '#1a1a2e', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 800, color: '#1a1a2e', marginBottom: 8 },
  desc: { fontSize: 14, color: '#6b7280', marginBottom: 20, lineHeight: 1.5 },
  scopeBox: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16 },
  scopeHead: { fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 },
  scopeList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  scopeItem: { fontSize: 14, color: '#374151', display: 'flex', alignItems: 'flex-start' },
  fine: { fontSize: 12, color: '#9ca3af', marginBottom: 16, lineHeight: 1.5 },
  error: { padding: '10px 14px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, fontSize: 13, fontWeight: 500, marginBottom: 12 },
  button: {
    padding: '14px 0', background: '#3b5bdb', color: '#fff', border: 'none', borderRadius: 10,
    fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  },
};
