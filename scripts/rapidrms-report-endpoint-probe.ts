import { createHash } from 'node:crypto';
import { createSupabaseAdmin } from '../src/supabase.js';
import { decryptValue, setEncryptionKey } from '../security/input-handler.js';
import { setTenantSecret, storeCredential, deleteCredential } from '../connectors/vault-ref.js';
import { authenticate, request } from '../connectors/rapidrms-api.js';
import { invoiceDayBounds } from '../connectors/data-service.js';

type Probe = {
  name: string;
  method: 'GET' | 'POST';
  path: string;
  params: Record<string, unknown>;
};

function probeDate(): string {
  return process.env.RAPIDRMS_PROBE_DATE || new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

function boolEnv(name: string): boolean {
  return ['1', 'true', 'yes'].includes(String(process.env[name] || '').toLowerCase());
}

function preview(payload: unknown): { bytes: number; empty: boolean; preview: string } {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return {
    bytes: text.length,
    empty: text === '[]' || /No Data available/i.test(text),
    preview: text.slice(0, 160),
  };
}

const day = probeDate();
const bounds = invoiceDayBounds(day, day);
const candidateProbes: Probe[] = [
  { name: 'invoiceReport', method: 'GET', path: '/api/InvoiceReport', params: bounds },
  { name: 'itemCatalog', method: 'GET', path: '/api/Item', params: {} },
  { name: 'salesDetail', method: 'POST', path: '/api/SalesDetail/Get', params: { ...bounds, fromDate: bounds.FromDate, toDate: bounds.ToDate } },
  { name: 'promotions', method: 'POST', path: '/api/Promotion/Get', params: {} },
  { name: 'timeStampPageCandidate', method: 'GET', path: '/api/TimeStamp', params: bounds },
  { name: 'timeStampGetCandidate', method: 'GET', path: '/api/TimeStamp/Get', params: bounds },
  { name: 'timeStampEmployeeCandidate', method: 'GET', path: '/api/TimeStamp/Employee', params: bounds },
  { name: 'tenderReport', method: 'GET', path: '/api/TenderReport', params: bounds },
  { name: 'hourlyReport', method: 'GET', path: '/api/HourlyReport', params: bounds },
  { name: 'fuelReport', method: 'GET', path: '/api/FuelReport', params: bounds },
  { name: 'fuelDetailsReport', method: 'GET', path: '/api/FuelDetailsReport', params: bounds },
  { name: 'salesByPromotion', method: 'GET', path: '/api/Discount/SalesByPromotion', params: bounds },
  { name: 'taxReportCandidate', method: 'GET', path: '/api/ReportItemSold/Tax', params: bounds },
  { name: 'departmentReportCandidate', method: 'GET', path: '/api/ReportItemSold/Department', params: bounds },
  { name: 'vendorReportCandidate', method: 'GET', path: '/api/ReportItemSold/Vendor', params: bounds },
  { name: 'giftCardInventory', method: 'GET', path: '/api/GiftCardInventory', params: {} },
  { name: 'dropAmountReport', method: 'GET', path: '/api/DropAmountReport', params: bounds },
];

const secret = process.env.AROS_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (secret) setEncryptionKey(createHash('sha256').update(secret).digest());

const supabase = createSupabaseAdmin();
const connectorId = process.env.RAPIDRMS_PROBE_CONNECTOR_ID;
let query = supabase
  .from('tenant_connectors')
  .select('id,tenant_id,type,name,config,status,credentials_encrypted')
  .eq('type', 'rapidrms-api')
  .eq('status', 'connected')
  .limit(1);
if (connectorId) query = query.eq('id', connectorId);
const { data, error } = await query;
if (error) throw error;

const row = (data || [])[0];
if (!row) {
  console.log(JSON.stringify({ connectedRapidRmsStores: 0, reportDate: day, results: [] }, null, 2));
  process.exit(0);
}

const secrets = JSON.parse(decryptValue(row.credentials_encrypted)) as Record<string, string>;
const vaultSecret = `${row.tenant_id}:${process.env.AROS_ENCRYPTION_KEY || 'aros-dev'}`;
setTenantSecret(vaultSecret);
const refs: string[] = [];

try {
  const emailRef = await storeCredential(`${row.id}:report-probe-email`, secrets.email || '', vaultSecret);
  const passwordRef = await storeCredential(`${row.id}:report-probe-password`, secrets.password || '', vaultSecret);
  refs.push(emailRef, passwordRef);
  const session = await authenticate(
    {
      baseUrl: String(row.config?.baseUrl || 'https://rapidrmsapi.azurewebsites.net'),
      clientId: String(row.config?.clientId || ''),
      sessionTimeout: Number(row.config?.sessionTimeout) || 420,
    },
    emailRef,
    passwordRef,
  );

  const results = [];
  for (const probe of candidateProbes) {
    try {
      const payload = await request(session, probe.method, probe.path, probe.params);
      results.push({ ...probe, ok: true, ...preview(payload) });
    } catch (err) {
      results.push({
        ...probe,
        ok: false,
        error: String((err as Error)?.message || err).slice(0, 220),
      });
    }
  }
  console.log(JSON.stringify({
    store: row.name,
    tenant: boolEnv('RAPIDRMS_PROBE_INCLUDE_TENANT') ? row.tenant_id : 'redacted',
    reportDate: day,
    results,
  }, null, 2));
} finally {
  await Promise.all(refs.map((ref) => deleteCredential(ref).catch(() => {})));
}
