import { useAuth } from '../../../contexts/AuthContext';
import { AdminPage, Card, Gap, Grid, State } from './AdminPrimitives';

export function SettingsPage() {
  const { tenant } = useAuth();
  return <AdminPage eyebrow="Workspace · Settings" lead="Verified workspace defaults used throughout AROS.">{!tenant ? <State title="No workspace selected" detail="Choose a workspace to view settings." /> : <><Grid><Card title="Workspace" value={tenant.name} /><Card title="Plan" value={tenant.plan || '—'} /><Card title="Timezone" value={tenant.timezone || 'Not configured'} /><Card title="Currency" value={tenant.currency || 'Not configured'} /></Grid><Gap>Workspace name, locale, timezone, currency, notification, retention, and security-setting mutations do not have a documented AROS endpoint. Values are read-only until a tenant-scoped update API with validation and audit history is available.</Gap></>}</AdminPage>;
}
