// ── StorePulse Connector Link ───────────────────────────────────
// Links Azure DB + RapidRMS connectors to the StorePulse node.

import { getConnector } from './manager.js';
import type { ConnectorConfig } from './types.js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

// ── Storage ─────────────────────────────────────────────────────

interface StorePulseLinks {
  azureConnectorId?: string;
  rapidRmsConnectorId?: string;
}

const STOREPULSE_LINKS_PATH =
  process.env.STOREPULSE_LINKS_PATH || join(homedir(), '.shre', 'storepulse-links.json');

const links = new Map<string, StorePulseLinks>();

function loadPersistedLinks(): void {
  try {
    const raw = readFileSync(STOREPULSE_LINKS_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, StorePulseLinks>;
    for (const [tenantId, value] of Object.entries(parsed)) {
      if (!tenantId || !value || typeof value !== 'object') continue;
      links.set(tenantId, {
        azureConnectorId:
          typeof value.azureConnectorId === 'string' ? value.azureConnectorId : undefined,
        rapidRmsConnectorId:
          typeof value.rapidRmsConnectorId === 'string' ? value.rapidRmsConnectorId : undefined,
      });
    }
  } catch {
    // Best-effort hydration only; missing file is expected on first run.
  }
}

function persistLinks(): void {
  try {
    mkdirSync(dirname(STOREPULSE_LINKS_PATH), { recursive: true });
    const payload = Object.fromEntries(links.entries());
    writeFileSync(STOREPULSE_LINKS_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  } catch {
    // Best-effort persistence only; in-memory fallback remains usable.
  }
}

loadPersistedLinks();

// ── Public API ──────────────────────────────────────────────────

/** Link Azure DB and/or RapidRMS connectors to StorePulse for a tenant. */
export function linkToStorePulse(
  tenantId: string,
  azureConnectorId?: string,
  rapidRmsConnectorId?: string,
): void {
  const existing = links.get(tenantId) ?? {};
  links.set(tenantId, {
    azureConnectorId: azureConnectorId ?? existing.azureConnectorId,
    rapidRmsConnectorId: rapidRmsConnectorId ?? existing.rapidRmsConnectorId,
  });
  persistLinks();
}

/** Get the connectors linked to StorePulse for a tenant. */
export function getStorePulseConnectors(tenantId: string): {
  azureDb?: ConnectorConfig;
  rapidRms?: ConnectorConfig;
} {
  const linked = links.get(tenantId);
  if (!linked) return {};

  return {
    azureDb: linked.azureConnectorId
      ? (getConnector(tenantId, linked.azureConnectorId) ?? undefined)
      : undefined,
    rapidRms: linked.rapidRmsConnectorId
      ? (getConnector(tenantId, linked.rapidRmsConnectorId) ?? undefined)
      : undefined,
  };
}
