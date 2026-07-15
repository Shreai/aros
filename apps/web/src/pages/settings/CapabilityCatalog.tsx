import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

type Kind = 'channels' | 'agents' | 'skills';
type ApiKind = 'channel' | 'agent' | 'skill';
type Template = { name: string; copy: string; tag: string; provider: string; capabilities: string[] };
type Resource = { id: string; name: string; status: 'inactive' | 'configuring' | 'active' | 'degraded' | 'failed'; provider: string | null; capabilities: string[] };

const DATA: Record<Kind, { apiKind: ApiKind; title: string; copy: string; items: Template[] }> = {
  channels: { apiKind: 'channel', title: 'Message channels', copy: 'Choose where people reach the Shreai router. Each channel inherits workspace identity, permissions, and audit policy.', items: [
    { name: 'AROS Chat', copy: 'Native workspace chat and command surface.', tag: 'Native', provider: 'aros', capabilities: ['message.receive', 'message.send'] },
    { name: 'WhatsApp', copy: 'Messaging through a verified business account.', tag: 'Messaging', provider: 'whatsapp', capabilities: ['message.receive', 'message.send'] },
    { name: 'Slack', copy: 'Commands, alerts, and approval workflows.', tag: 'Collaboration', provider: 'slack', capabilities: ['message.receive', 'message.send', 'approval.request'] },
    { name: 'Microsoft Teams', copy: 'Enterprise chat and approval cards.', tag: 'Collaboration', provider: 'teams', capabilities: ['message.receive', 'message.send', 'approval.request'] },
    { name: 'AI clients', copy: 'Claude, Codex, Gemini, Sia, and compatible clients.', tag: 'Agent protocol', provider: 'mcp', capabilities: ['message.receive', 'tools.invoke'] },
  ]},
  agents: { apiKind: 'agent', title: 'Agents', copy: 'Agents coordinate goals and invoke approved skills. They cannot access tools outside their assigned scope.', items: [
    { name: 'Store Operations Agent', copy: 'Monitors daily operations, exceptions, and store health.', tag: 'Operations', provider: 'shreai', capabilities: ['operations.read', 'health.read'] },
    { name: 'Inventory Agent', copy: 'Tracks stock and drafts replenishment actions.', tag: 'Inventory', provider: 'shreai', capabilities: ['inventory.read', 'reorder.draft'] },
    { name: 'Pricing Agent', copy: 'Proposes approval-gated POS changes.', tag: 'Approval required', provider: 'shreai', capabilities: ['pricing.read', 'pricing.draft'] },
    { name: 'Customer Support Agent', copy: 'Handles support using connected systems.', tag: 'Support', provider: 'shreai', capabilities: ['support.read', 'support.draft'] },
    { name: 'Finance Agent', copy: 'Reconciles POS and accounting activity.', tag: 'Finance', provider: 'shreai', capabilities: ['finance.read', 'reconciliation.draft'] },
  ]},
  skills: { apiKind: 'skill', title: 'Skills', copy: 'Versioned, reusable procedures that agents invoke through policy-controlled tools.', items: [
    { name: 'Daily Sales Summary', copy: 'Queries mapped POS stores and produces a cited summary.', tag: 'Read only', provider: 'aros', capabilities: ['pos.sales.read'] },
    { name: 'Inventory Reorder', copy: 'Builds reorder recommendations from stock velocity.', tag: 'Draft action', provider: 'aros', capabilities: ['inventory.read', 'reorder.draft'] },
    { name: 'Price Update', copy: 'Submits a POS price change after approval.', tag: 'Write action', provider: 'aros', capabilities: ['pricing.write.approved'] },
    { name: 'Support Triage', copy: 'Classifies tickets and drafts responses.', tag: 'Draft action', provider: 'aros', capabilities: ['support.read', 'support.draft'] },
    { name: 'Store Closeout', copy: 'Runs end-of-day checks and reports exceptions.', tag: 'Workflow', provider: 'aros', capabilities: ['pos.closeout.read'] },
  ]},
};

export function CapabilityCatalog({ kind }: { kind: Kind }) {
  const { session, tenant } = useAuth();
  const data = DATA[kind];
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const headers = useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}`, 'X-AROS-Tenant-Id': tenant?.id || '' }), [session, tenant]);

  async function load() {
    if (!session?.access_token || !tenant?.id) return;
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/resources/${data.apiKind}`, { headers });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to load workspace resources');
      setResources(body.resources || []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load workspace resources'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [kind, session?.access_token, tenant?.id]);

  async function toggle(template: Template) {
    const current = resources.find(resource => resource.name === template.name);
    const nextStatus = current?.status === 'active' ? 'inactive' : 'active';
    setSaving(template.name); setError('');
    try {
      const response = await fetch(`/api/resources/${data.apiKind}${current ? `/${current.id}` : ''}`, {
        method: current ? 'PUT' : 'POST', headers,
        body: JSON.stringify({ name: template.name, provider: template.provider, status: nextStatus, capabilities: template.capabilities, config: {} }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to update resource');
      setResources(all => current ? all.map(item => item.id === current.id ? body.resource : item) : [...all, body.resource]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update resource'); }
    finally { setSaving(null); }
  }

  const activeCount = data.items.filter(item => resources.find(resource => resource.name === item.name)?.status === 'active').length;
  return <section className="setup-page">
    <header className="setup-header"><div><p className="setup-eyebrow">Shreai router</p><h1>{data.title}</h1><p>{data.copy}</p></div></header>
    <div className="setup-summary"><div><strong>{data.items.length}</strong><span>Available</span></div><div><strong>{activeCount}</strong><span>Active</span></div><div><strong>{data.items.length - activeCount}</strong><span>Inactive</span></div></div>
    {error && <div className="test-success" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}><strong>Workspace update failed</strong><span>{error}</span></div>}
    {loading ? <div className="setup-empty"><p>Loading workspace configuration…</p></div> : <div className="catalog-grid">{data.items.map(item => {
      const resource = resources.find(entry => entry.name === item.name);
      const active = resource?.status === 'active';
      return <article className="setup-panel catalog-card" key={item.name}><div className="catalog-card-head"><div className="provider-mark">{item.name.slice(0,2).toUpperCase()}</div><span className={`status-pill ${active ? 'connected' : 'inactive'}`}>{active ? 'Active' : 'Inactive'}</span></div><h2>{item.name}</h2><p>{item.copy}</p><div className="catalog-card-foot"><span>{item.tag}</span><button className="setup-secondary" disabled={saving === item.name} onClick={() => void toggle(item)}>{saving === item.name ? 'Saving…' : active ? 'Disable' : 'Enable'}</button></div></article>;
    })}</div>}
  </section>;
}
