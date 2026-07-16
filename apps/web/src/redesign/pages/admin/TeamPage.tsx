import { useAuth } from '../../../contexts/AuthContext';
import { AdminPage, Gap, Pill, Row, Rows, State } from './AdminPrimitives';

export function TeamPage() {
  const { user, tenant, memberships } = useAuth();
  const membership = memberships.find(item => item.tenant_id === tenant?.id);
  if (!tenant || !user) return <AdminPage eyebrow="Workspace · Team" lead="People with access to this workspace."><State title="No workspace selected" detail="Choose a workspace to view its team." /></AdminPage>;
  const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'You';
  return <AdminPage eyebrow="Workspace · Team" lead="Your verified membership. A complete roster requires a tenant-scoped members endpoint."><Rows><Row mark={name.split(/\s+/).map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()} title={name} detail={user.email || 'No email returned'} end={<Pill>{membership?.role || 'member'}</Pill>} /></Rows><Gap>Invite, list-all-members, suspend-member, and change-role endpoints are not exposed by AROS yet. These actions stay unavailable until the server enforces tenant-scoped authorization and audit logging.</Gap></AdminPage>;
}
