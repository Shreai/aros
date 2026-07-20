import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE = (window as any).__AROS_API_URL__
  || (window.location.hostname === 'localhost' ? 'http://localhost:5457' : '');

type Overview = { tenants: number; activeMemberships: number; connectors: Record<string, number>; newestSnapshotAt: string | null };
type TenantRow = { id: string; name: string; plan?: string; status?: string; pos_system?: string; store_count?: number; onboarding_completed?: boolean; created_at: string; members: number; connectors: { total: number; connected: number } };
type TenantDetail = {
  tenant: Record<string, unknown> & { id: string; name: string };
  members: Array<{ id: string; email: string | null; name: string | null; role: string; status: string; joined_at: string }>;
  connectors: Array<{ id: string; name: string; type: string; status: string; last_tested: string | null; last_error: string | null }>;
  onboarding: { phase?: string } | null;
  recentAudit: Array<{ action: string; resource: string | null; created_at: string }>;
};

/**
 * Founder-only, read-only cross-tenant console (/platform). The server gates
 * by the PLATFORM_ADMIN_EMAILS allow-list and 404s for everyone else — this
 * page mirrors that: a 404 renders the same "not available" shell an unknown
 * route would, revealing nothing.
 */
export function PlatformConsole() {
  const { session, loading } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [openTenant, setOpenTenant] = useState('');
  const [state, setState] = useState<'loading' | 'denied' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  async function api<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}/api/platform${path}`, { headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} });
    if (res.status === 404) throw new Error('__denied__');
    const payload = await res.json().catch(() => null);
    if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`);
    return payload as T;
  }

  useEffect(() => {
    if (loading) return;
    if (!session) { setState('denied'); return; }
    (async () => {
      try {
        const [ov, tn] = await Promise.all([api<Overview>('/overview'), api<{ tenants: TenantRow[] }>('/tenants')]);
        setOverview(ov); setTenants(tn.tenants); setState('ready');
      } catch (e) {
        if (e instanceof Error && e.message === '__denied__') setState('denied');
        else { setError(e instanceof Error ? e.message : 'Failed to load'); setState('error'); }
      }
    })();
  }, [loading, session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleTenant(id: string) {
    if (openTenant === id) { setOpenTenant(''); setDetail(null); return; }
    setOpenTenant(id); setDetail(null);
    try { setDetail(await api<TenantDetail>(`/tenants/${id}`)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load tenant'); }
  }

  if (state === 'loading') return <div style={s.page}><p style={s.muted}>Loading…</p></div>;
  if (state === 'denied') return <div style={s.page}><h1 style={s.h1}>Not available</h1><p style={s.muted}>This page does not exist for this account.</p></div>;
  if (state === 'error') return <div style={s.page}><h1 style={s.h1}>Platform console</h1><p style={{ color: '#b91c1c' }}>{error}</p></div>;

  const conn = overview?.connectors || {};
  return (
    <div style={s.page}>
      <h1 style={s.h1}>Platform console</h1>
      <p style={s.muted}>Read-only operator view across every workspace. Access is allow-listed and audit-logged.</p>

      <div style={s.cards}>
        <div style={s.card}><div style={s.big}>{overview?.tenants ?? '—'}</div><div style={s.muted}>Workspaces</div></div>
        <div style={s.card}><div style={s.big}>{overview?.activeMemberships ?? '—'}</div><div style={s.muted}>Active memberships</div></div>
        <div style={s.card}><div style={s.big}>{conn.connected || 0}<span style={s.dim}>/{Object.values(conn).reduce((a, b) => a + b, 0)}</span></div><div style={s.muted}>Connectors connected</div></div>
        <div style={s.card}><div style={s.big}>{overview?.newestSnapshotAt ? `${Math.round((Date.now() - Date.parse(overview.newestSnapshotAt)) / 3600_000)}h` : '—'}</div><div style={s.muted}>Since last snapshot</div></div>
      </div>

      <h2 style={s.h2}>Workspaces</h2>
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead><tr>{['Name', 'Plan', 'POS', 'Members', 'Connectors', 'Onboarded', 'Created', ''].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {tenants.map(t => (
              <>
                <tr key={t.id}>
                  <td style={s.td}><strong>{t.name}</strong></td>
                  <td style={s.td}>{t.plan || '—'}</td>
                  <td style={s.td}>{t.pos_system || '—'}</td>
                  <td style={s.td}>{t.members}</td>
                  <td style={s.td}>{t.connectors.connected}/{t.connectors.total}</td>
                  <td style={s.td}>{t.onboarding_completed ? 'yes' : 'no'}</td>
                  <td style={s.td}>{t.created_at.slice(0, 10)}</td>
                  <td style={s.td}><button style={s.btn} onClick={() => void toggleTenant(t.id)}>{openTenant === t.id ? 'Hide' : 'Inspect'}</button></td>
                </tr>
                {openTenant === t.id && (
                  <tr key={`${t.id}-detail`}><td colSpan={8} style={{ ...s.td, background: '#f9fafb' }}>
                    {!detail ? <span style={s.muted}>Loading…</span> : (
                      <div style={{ display: 'grid', gap: 10 }}>
                        <div><strong>Members:</strong> {detail.members.length === 0 ? 'none' : detail.members.map(m => `${m.email || m.id} (${m.role}${m.status !== 'active' ? `, ${m.status}` : ''})`).join(' · ')}</div>
                        <div><strong>Connectors:</strong> {detail.connectors.length === 0 ? 'none' : detail.connectors.map(c => `${c.name} [${c.type}] ${c.status}${c.last_error ? ` — ${c.last_error}` : ''}`).join(' · ')}</div>
                        <div><strong>Journey:</strong> {detail.onboarding?.phase || 'no state row'}</div>
                        <div><strong>Recent activity:</strong> {detail.recentAudit.length === 0 ? 'none' : detail.recentAudit.slice(0, 8).map(a => `${a.created_at.slice(5, 16)} ${a.action}`).join(' · ')}</div>
                      </div>
                    )}
                  </td></tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1080, margin: '0 auto', padding: '32px 20px', fontSize: 14, color: '#111827' },
  h1: { fontSize: 24, fontWeight: 700, marginBottom: 4 },
  h2: { fontSize: 17, fontWeight: 600, margin: '28px 0 10px' },
  muted: { color: '#6b7280', fontSize: 13 },
  dim: { color: '#9ca3af', fontWeight: 400 },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 18 },
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 },
  big: { fontSize: 26, fontWeight: 700 },
  tableWrap: { overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #e5e7eb', fontSize: 12, textTransform: 'uppercase', color: '#6b7280' },
  td: { padding: '10px 12px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' },
  btn: { padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 12 },
};
