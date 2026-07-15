export const EDGE_API_VERSION = '2026-07-15';

export const EDGE_EVENT_TYPES = [
  'verifone.site.snapshot',
  'verifone.department.snapshot',
  'verifone.item.snapshot',
  'verifone.price.snapshot',
  'verifone.shift.closed',
  'verifone.transaction.completed',
  'verifone.fuel.sale',
  'verifone.fuel.price',
  'verifone.report.raw',
  'verifone.connector.error',
] as const;

export type EdgeEventType = (typeof EDGE_EVENT_TYPES)[number];

export interface ActivationRequest {
  activationCode: string;
  machineId: string;
  siteId: string;
  serviceVersion: string;
  connectorVersion: string;
  operatingSystem: string;
  architecture: string;
  commanderVersion?: string;
}

export interface HeartbeatRequest {
  serviceVersion: string;
  connectorVersion: string;
  commanderReachable: boolean;
  lastSuccessfulLogin?: string;
  lastReportReceived?: string;
  lastCloudUpload?: string;
  oldestQueuedAt?: string;
  queueDepth: number;
  diskUsageBytes: number;
  lastErrorCategory?: string;
  commanderVersion?: string;
  capabilities: string[];
}

export interface EdgeEvent {
  eventId: string;
  eventType: EdgeEventType;
  sourceTimestamp: string;
  sourceId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  rawPayloadRef?: string;
}

export interface EventBatchRequest {
  schemaVersion: '1.0';
  batchId: string;
  sequence: number;
  capturedAt: string;
  tenantId: string;
  storeId: string;
  deviceId: string;
  provider: 'verifone';
  events: EdgeEvent[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isNonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isIsoDate = (value: unknown): value is string => isNonEmpty(value) && !Number.isNaN(Date.parse(value));

export function validateActivation(value: unknown): value is ActivationRequest {
  if (!isObject(value)) return false;
  return ['activationCode', 'machineId', 'siteId', 'serviceVersion', 'connectorVersion', 'operatingSystem', 'architecture'].every((key) => isNonEmpty(value[key]));
}

export function validateHeartbeat(value: unknown): value is HeartbeatRequest {
  if (!isObject(value)) return false;
  return isNonEmpty(value.serviceVersion)
    && isNonEmpty(value.connectorVersion)
    && typeof value.commanderReachable === 'boolean'
    && Number.isInteger(value.queueDepth) && Number(value.queueDepth) >= 0
    && Number.isFinite(value.diskUsageBytes) && Number(value.diskUsageBytes) >= 0
    && Array.isArray(value.capabilities) && value.capabilities.every(isNonEmpty);
}

export function validateEventBatch(value: unknown): value is EventBatchRequest {
  if (!isObject(value) || value.schemaVersion !== '1.0' || !isNonEmpty(value.batchId)
    || !isNonEmpty(value.tenantId) || !isNonEmpty(value.storeId) || !isNonEmpty(value.deviceId) || value.provider !== 'verifone'
    || !Number.isInteger(value.sequence) || Number(value.sequence) < 0 || !isIsoDate(value.capturedAt)
    || !Array.isArray(value.events) || value.events.length < 1 || value.events.length > 500) return false;
  return value.events.every((event) => isObject(event)
    && isNonEmpty(event.eventId)
    && EDGE_EVENT_TYPES.includes(event.eventType as EdgeEventType)
    && isIsoDate(event.sourceTimestamp)
    && isNonEmpty(event.sourceId)
    && isNonEmpty(event.idempotencyKey)
    && isObject(event.payload));
}
