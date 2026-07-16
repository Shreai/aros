import { useAuth } from '../../../contexts/AuthContext';
import { AdminPage, Button, Card, Grid, Loading, Pill, Row, Rows, State } from './AdminPrimitives';
import { useAdminRequest } from './adminApi';

type Connector = { id?: string; name?: string; type?: string; status?: string; last_error?: string; last_tested?: string };
type AppResource = { id?: string; name?: string; provider?: string; status?: string; health?: { detail?: string; state?: string } };
export function ConnectionHealthPage() {
  const { tenant } = useAuth();
  const { data, loading, error, retry } = useAdminRequest<{ connectors?: Connector[] }>(tenant ? '/api/connectors' : null);
  const appsRequest = useAdminRequest<{ resources?: AppResource[] }>(tenant ? '/api/resources/app' : null);
  if (!tenant) return <AdminPage eyebrow="Observability" lead="Monitor the services connected to this workspace."><State title="No workspace selected" detail="Choose a workspace to inspect its connections." /></AdminPage>;
  const connectors = Array.isArray(data?.connectors) ? data!.connectors! : [];
  const apps = Array.isArray(appsRequest.data?.resources) ? appsRequest.data.resources : [];
  const resources = [...connectors.map(item => ({ ...item, detail: item.last_error || item.last_tested || 'No check detail returned' })), ...apps.map(item => ({ ...item, type: item.provider, detail: item.health?.detail || 'No health detail returned' }))];
  const healthy = resources.filter(item => item.status === 'connected' || item.status === 'healthy' || item.status === 'active').length;
  const failed = resources.filter(item => item.status === 'error' || item.status === 'down' || item.status === 'failed').length;
  const isLoading = loading || appsRequest.loading; const combinedError = error || appsRequest.error;
  const retryAll = () => { retry(); appsRequest.retry(); };
  return <AdminPage eyebrow="Observability" lead="Live connector and workspace-app status, recent checks, and actionable failures." action={<Button onClick={retryAll} disabled={isLoading}>Refresh health</Button>}>
    {isLoading ? <Loading /> : combinedError ? <State title="Connection checks failed" detail={combinedError} retry={retryAll} /> : resources.length === 0 ? <State title="No connections yet" detail="Connect a register or app and its health will appear here." /> : <><Grid><Card title="Healthy" value={healthy} /><Card title="Needs attention" value={resources.length - healthy - failed} /><Card title="Failed" value={failed} /></Grid><Rows>{resources.map((item, i) => <Row key={item.id || `${item.type}-${i}`} mark={(item.name || item.type || '?').slice(0, 2).toUpperCase()} title={item.name || item.type || 'Unnamed connection'} detail={item.detail} end={<Pill>{item.status || 'unknown'}</Pill>} />)}</Rows></>}
  </AdminPage>;
}
