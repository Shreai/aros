import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  listStores,
  listPlugins,
  confirmPlugin,
  type BuiltPlugin,
  type InstalledPlugin,
} from './api';

type InstalledItem = { id: string; name: string; detail: string; status: string };
const POS_TYPES = new Set(['rapidrms-api', 'verifone-commander', 'azure-db']);

// ── Connectors (unchanged: activated non-POS connectors for this workspace) ──
function ConnectorsInner({ onBrowse }: { onBrowse: () => void }) {
  const { session, tenant } = useAuth();
  const auth = useMemo(() => ({ accessToken: session?.access_token, tenantId: tenant?.id }), [session?.access_token, tenant?.id]);
  const [items, setItems] = useState<InstalledItem[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [query, setQuery] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const connectors = await listStores(auth) as Array<{ id: string; type: string; name: string; status: string; config?: { description?: string } }>;
      setItems(connectors.filter(item => !POS_TYPES.has(item.type) && item.status === 'connected').map(item => ({ id: item.id, name: item.name || item.type, detail: item.config?.description || item.type, status: item.status })));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load connectors'); }
    finally { setLoading(false); }
  }, [auth]);
  useEffect(() => { void load(); }, [load]);
  const visible = items.filter(item => `${item.name} ${item.detail}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="rsx-panel">
    <div className="rsx-panel__head"><div><div className="rsx-panel__eyebrow">Activated connectors</div><p className="rsx-panel__lead">Only connectors activated for this workspace appear here.</p></div><div className="rsx-section-actions"><button className="rsx-panel__cta" type="button" onClick={onBrowse}>Browse Marketplace</button></div></div>
    {error && <div className="rsx-note" role="alert"><div className="rsx-note__title">Connectors unavailable</div><div className="rsx-note__body">{error}</div><button className="rsx-row__btn" onClick={() => void load()}>Retry</button></div>}
    {loading ? <State title="Loading connectors…" /> : items.length === 0 ? <State title="No active connectors" detail="Browse Marketplace to activate connectors for this workspace." action={onBrowse} /> : <><div className="rsx-form"><label className="rsx-form__field"><span className="rsx-form__label">Search</span><input className="rsx-form__input" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search active connectors" /></label></div>{visible.length === 0 ? <State title="No matches" detail="Try another search term." /> : <div className="rsx-rows">{visible.map(item => <div className="rsx-row" key={item.id}><div className="rsx-row__mark">{item.name.slice(0, 2).toUpperCase()}</div><div className="rsx-row__info"><div className="rsx-row__title">{item.name}</div><div className="rsx-row__sub">{item.detail}</div></div><span className="rsx-pill rsx-pill--on">Active</span></div>)}</div>}</>}
  </div>;
}

// ── Plugins (unified) ────────────────────────────────────────────────────────
// Two groups in one view (DECIDED: unified):
//   * Built for your business — apps this tenant generated via the App Factory
//     (tenant_apps). Preview apps carry a "Confirm & publish" gate (→ live).
//   * Installed from marketplace — marketplace apps enabled with source=plugin.
type PillTone = 'on' | 'warn' | 'off';
const STATUS_PILL: Record<string, { label: string; tone: PillTone }> = {
  draft: { label: 'Draft', tone: 'off' },
  preview: { label: 'In preview', tone: 'warn' },
  live: { label: 'Live', tone: 'on' },
};

function PluginsInner({ onBrowse }: { onBrowse: () => void }) {
  const { session, tenant, memberships } = useAuth();
  const auth = useMemo(() => ({ accessToken: session?.access_token, tenantId: tenant?.id }), [session?.access_token, tenant?.id]);
  const canManage = useMemo(() => {
    const role = memberships.find(m => m.tenant.id === tenant?.id)?.role;
    return role === 'owner' || role === 'admin';
  }, [memberships, tenant?.id]);

  const [built, setBuilt] = useState<BuiltPlugin[]>([]);
  const [installed, setInstalled] = useState<InstalledPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await listPlugins(auth);
      setBuilt(data.built);
      setInstalled(data.installed);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load plugins'); }
    finally { setLoading(false); }
  }, [auth]);
  useEffect(() => { void load(); }, [load]);

  const onConfirm = useCallback(async (plugin: BuiltPlugin) => {
    setBusyId(plugin.id); setActionError('');
    try {
      await confirmPlugin(auth, plugin.id);
      await load();
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Could not publish plugin'); }
    finally { setBusyId(null); }
  }, [auth, load]);

  const q = query.toLowerCase();
  const builtVisible = built.filter(p => `${p.name} ${p.description ?? ''} ${p.slug}`.toLowerCase().includes(q));
  const installedVisible = installed.filter(p => p.name.toLowerCase().includes(q));
  const isEmpty = built.length === 0 && installed.length === 0;

  return <div className="rsx-panel">
    <div className="rsx-panel__head"><div><div className="rsx-panel__eyebrow">Plugins</div><p className="rsx-panel__lead">Apps built for your business, plus plugins you’ve installed from the marketplace.</p></div><div className="rsx-section-actions"><button className="rsx-panel__cta" type="button" onClick={onBrowse}>Browse Marketplace</button></div></div>

    {error && <div className="rsx-note" role="alert"><div className="rsx-note__title">Plugins unavailable</div><div className="rsx-note__body">{error}</div><button className="rsx-row__btn" onClick={() => void load()}>Retry</button></div>}
    {actionError && <div className="rsx-note" role="alert"><div className="rsx-note__title">Couldn’t publish</div><div className="rsx-note__body">{actionError}</div></div>}

    {loading ? <State title="Loading plugins…" /> : isEmpty ? (
      <State title="No plugins yet" detail="Build an internal app for your business, or browse the marketplace to install one." action={onBrowse} />
    ) : (<>
      <div className="rsx-form"><label className="rsx-form__field"><span className="rsx-form__label">Search</span><input className="rsx-form__input" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search plugins" /></label></div>

      <div className="rsx-group__label">Built for your business</div>
      {builtVisible.length === 0 ? <State title="Nothing built yet" detail="Apps you build for your business show up here — through preview, then live." /> : (
        <div className="rsx-rows">{builtVisible.map(p => {
          const pill = STATUS_PILL[p.status] ?? { label: p.status, tone: 'off' as PillTone };
          return <div className="rsx-row" key={p.id}>
            <div className="rsx-row__mark">{p.name.slice(0, 2).toUpperCase()}</div>
            <div className="rsx-row__info">
              <div className="rsx-row__title">{p.name}</div>
              <div className="rsx-row__sub">{p.description || `${p.subdomain}.apps.aros.live`}</div>
            </div>
            {p.url && p.status === 'live' && <a className="rsx-row__btn" href={p.url} target="_blank" rel="noreferrer">Open</a>}
            {p.confirmable && canManage && <button className="rsx-row__btn rsx-row__btn--primary" disabled={busyId === p.id} onClick={() => void onConfirm(p)}>{busyId === p.id ? 'Publishing…' : 'Confirm & publish'}</button>}
            <span className={`rsx-pill rsx-pill--${pill.tone}`}>{pill.label}</span>
          </div>;
        })}</div>
      )}

      <div className="rsx-group__label">Installed from marketplace</div>
      {installedVisible.length === 0 ? <State title="No installed plugins" detail="Browse the marketplace to install a plugin." action={onBrowse} /> : (
        <div className="rsx-rows">{installedVisible.map(p => <div className="rsx-row" key={p.app_key}>
          <div className="rsx-row__mark">{p.name.slice(0, 2).toUpperCase()}</div>
          <div className="rsx-row__info"><div className="rsx-row__title">{p.name}</div><div className="rsx-row__sub">Marketplace plugin</div></div>
          <span className="rsx-pill rsx-pill--on">Active</span>
        </div>)}</div>
      )}
    </>)}
  </div>;
}

function State({ title, detail, action }: { title: string; detail?: string; action?: () => void }) { return <div className="rsx2-empty"><div className="rsx2-empty__title">{title}</div>{detail && <div className="rsx2-empty__text">{detail}</div>}{action && <button className="rsx-panel__cta" type="button" onClick={action}>Browse Marketplace</button>}</div>; }

export const ConnectorsPage = ({ onBrowse }: { onBrowse: () => void }) => <ConnectorsInner onBrowse={onBrowse} />;
export const PluginsPage = ({ onBrowse }: { onBrowse: () => void }) => <PluginsInner onBrowse={onBrowse} />;
