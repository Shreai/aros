import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { listMarketplaceEntitlements, listStores, type AppGrant } from './api';

type InstalledItem = { id: string; name: string; detail: string; status: string };
const POS_TYPES = new Set(['rapidrms-api', 'verifone-commander', 'azure-db']);

function InstalledPage({ kind, onBrowse }: { kind: 'Connectors' | 'Plugins'; onBrowse: () => void }) {
  const { session, tenant } = useAuth();
  const auth = useMemo(() => ({ accessToken: session?.access_token, tenantId: tenant?.id }), [session?.access_token, tenant?.id]);
  const [items, setItems] = useState<InstalledItem[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [query, setQuery] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (kind === 'Connectors') {
        const connectors = await listStores(auth) as Array<{ id: string; type: string; name: string; status: string; config?: { description?: string } }>;
        setItems(connectors.filter(item => !POS_TYPES.has(item.type) && item.status === 'connected').map(item => ({ id: item.id, name: item.name || item.type, detail: item.config?.description || item.type, status: item.status })));
      } else {
        const grants = await listMarketplaceEntitlements(auth);
        setItems(grants.filter((item: AppGrant) => item.status === 'active' && item.source === 'plugin').map(item => ({ id: item.app_key, name: label(item.app_key), detail: 'Marketplace plugin', status: item.status })));
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : `Could not load ${kind.toLowerCase()}`); }
    finally { setLoading(false); }
  }, [auth, kind]);
  useEffect(() => { void load(); }, [load]);
  const visible = items.filter(item => `${item.name} ${item.detail}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="rsx-panel">
    <div className="rsx-panel__head"><div><div className="rsx-panel__eyebrow">Activated {kind.toLowerCase()}</div><p className="rsx-panel__lead">Only {kind.toLowerCase()} activated for this workspace appear here.</p></div><div className="rsx-section-actions"><button className="rsx-panel__cta" type="button" onClick={onBrowse}>Browse Marketplace</button></div></div>
    {error && <div className="rsx-note" role="alert"><div className="rsx-note__title">{kind} unavailable</div><div className="rsx-note__body">{error}</div><button className="rsx-row__btn" onClick={() => void load()}>Retry</button></div>}
    {loading ? <State title={`Loading ${kind.toLowerCase()}…`} /> : items.length === 0 ? <State title={`No active ${kind.toLowerCase()}`} detail={`Browse Marketplace to activate ${kind.toLowerCase()} for this workspace.`} action={onBrowse} /> : <><div className="rsx-form"><label className="rsx-form__field"><span className="rsx-form__label">Search</span><input className="rsx-form__input" value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search active ${kind.toLowerCase()}`} /></label></div>{visible.length === 0 ? <State title="No matches" detail="Try another search term." /> : <div className="rsx-rows">{visible.map(item => <div className="rsx-row" key={item.id}><div className="rsx-row__mark">{item.name.slice(0, 2).toUpperCase()}</div><div className="rsx-row__info"><div className="rsx-row__title">{item.name}</div><div className="rsx-row__sub">{item.detail}</div></div><span className="rsx-pill rsx-pill--on">Active</span></div>)}</div>}</>}
  </div>;
}

const label = (key: string) => key.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
function State({ title, detail, action }: { title: string; detail?: string; action?: () => void }) { return <div className="rsx2-empty"><div className="rsx2-empty__title">{title}</div>{detail && <div className="rsx2-empty__text">{detail}</div>}{action && <button className="rsx-panel__cta" type="button" onClick={action}>Browse Marketplace</button>}</div>; }
export const ConnectorsPage = ({ onBrowse }: { onBrowse: () => void }) => <InstalledPage kind="Connectors" onBrowse={onBrowse} />;
export const PluginsPage = ({ onBrowse }: { onBrowse: () => void }) => <InstalledPage kind="Plugins" onBrowse={onBrowse} />;
