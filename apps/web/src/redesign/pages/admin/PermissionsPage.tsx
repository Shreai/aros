import { AdminPage, Gap, State } from './AdminPrimitives';
import { useAuth } from '../../../contexts/AuthContext';

export function PermissionsPage() {
  const { tenant, memberships } = useAuth(); const role = memberships.find(item => item.tenant_id === tenant?.id)?.role;
  return <AdminPage eyebrow="Governance · Permissions" lead="Least-privilege access for workspace people, agents, stores, and actions.">{!tenant ? <State title="No workspace selected" detail="Choose a workspace to review access." /> : <><State title={`Your role: ${role || 'member'}`} detail="This role is read from your verified workspace membership." /><Gap>AROS does not currently expose a tenant-scoped role catalog, grants list, or grant mutation API. A safe implementation needs server-side authorization, approval gates for privileged writes, and immutable audit events before the permission editor can be enabled.</Gap></>}</AdminPage>;
}
