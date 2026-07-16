import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { disableApp, listApps, type AppGrant, type PlatformApp } from './api';

export function AppsPage({ onBrowse }: { onBrowse: () => void }) {
  const { session, tenant } = useAuth();
  const auth = useMemo(() => ({ accessToken: session?.access_token, tenantId: tenant?.id }), [session?.access_token, tenant?.id]);
  const [apps, setApps] = useState<PlatformApp[]>([]); const [grants, setGrants] = useState<AppGrant[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState(''); const [query, setQuery] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { const data = await listApps(auth); setApps(data.apps); setGrants(data.grants); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load apps'); } finally { setLoading(false); } }, [auth]);
  useEffect(() => { void load(); }, [load]);
  const active = new Set(grants.filter(grant => grant.status === 'active').map(grant => grant.app_key));
  const installed = apps.filter(app => active.has(app.id));
  const visible = installed.filter(app => `${app.name} ${app.description || ''}`.toLowerCase().includes(query.toLowerCase()));
  async function inactivate(app: PlatformApp) { setBusy(app.id); setError(''); try { await disableApp(auth, app.id); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'App update failed'); } finally { setBusy(''); } }
  return <div className="rsx-panel">
    <div className="rsx-panel__head"><div><div className="rsx-panel__eyebrow">Workspace apps</div><p className="rsx-panel__lead">Apps activated for this workspace appear here. Open their dashboard or manage their access.</p></div><div className="rsx-section-actions"><button className="rsx-panel__cta" type="button" onClick={onBrowse}>Browse Marketplace</button></div></div>
    {error && <div className="rsx-note" role="alert"><div className="rsx-note__title">Apps unavailable</div><div className="rsx-note__body">{error}</div><button className="rsx-row__btn" onClick={() => void load()}>Retry</button></div>}
    {loading ? <Empty title="Loading apps…" /> : installed.length === 0 ? <Empty title="No active apps" detail="Browse Marketplace to activate an app for this workspace." action={onBrowse} /> : <>
      <div className="rsx-stats"><div className="rsx-stat"><strong>{installed.length}</strong><span>Active</span></div></div>
      <div className="rsx-form"><label className="rsx-form__field"><span className="rsx-form__label">Find an app</span><input className="rsx-form__input" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search active apps" /></label></div>
      {visible.length === 0 ? <Empty title="No matching apps" detail="Try another name or keyword." /> : <div className="rsx-cards">{visible.map(app => <article className="rsx-card" key={app.id}><div className="rsx-card__top"><div className="rsx-card__icon">{app.icon || app.name.slice(0, 2).toUpperCase()}</div><div className="rsx-card__title">{app.name}</div></div><div className="rsx-card__desc">{app.description || 'AROS application'}</div><div className="rsx-card__foot"><span className="rsx-badge rsx-badge--on">Active</span>{app.url && <a className="rsx-card__btn" href={app.url} target="_blank" rel="noreferrer">Open dashboard</a>}<button className="rsx-card__btn" disabled={Boolean(busy)} onClick={() => void inactivate(app)}>{busy === app.id ? 'Updating…' : 'Inactivate'}</button></div></article>)}</div>}
    </>}
  </div>;
}

function Empty({ title, detail, action }: { title: string; detail?: string; action?: () => void }) {
  return <div className="rsx2-empty"><div className="rsx2-empty__title">{title}</div>{detail && <div className="rsx2-empty__text">{detail}</div>}{action && <button className="rsx-panel__cta" type="button" onClick={action}>Browse Marketplace</button>}</div>;
}
