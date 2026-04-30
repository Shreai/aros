import { describe, expect, it } from 'vitest';
import { activateAllHumanConnectors, buildHumanLayerSnapshot } from '../human-layer.js';
import type { Task } from '../../tasks/types.js';

function makeTask(overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString();
  return {
    id: 'task-1',
    title: 'Review overnight inbox',
    description: 'Triage urgent messages and extract follow-ups',
    status: 'pending',
    priority: 'critical',
    agentId: 'human-tasks-001',
    tenantId: 'tenant-1',
    createdAt: now,
    updatedAt: now,
    createdBy: 'user-1',
    tags: ['operations'],
    context: { project: 'operations', nextAction: 'Review the inbox' },
    logs: [],
    ...overrides,
  };
}

describe('human layer snapshot', () => {
  it('activates connectors and summarizes tasks into briefing data', () => {
    const connectors = activateAllHumanConnectors('tenant-1');
    expect(connectors).toHaveLength(20);
    expect(connectors.every((connector) => connector.status === 'active')).toBe(true);

    const snapshot = buildHumanLayerSnapshot({
      tenantId: 'tenant-1',
      tenantName: 'Demo Store',
      tasks: [makeTask()],
      recentActivity: [
        { action: 'lead.captured', created_at: new Date().toISOString(), detail: { email: 'lead@example.com' } },
      ],
    });

    expect(snapshot.connectors).toHaveLength(20);
    expect(snapshot.briefing.focus).toBe('Review overnight inbox');
    expect(snapshot.tasks.open).toBe(1);
    expect(snapshot.projects.length).toBeGreaterThanOrEqual(1);
    expect(snapshot.goals.length).toBeGreaterThanOrEqual(2);
    expect(snapshot.importantInfo.pendingDecisions).toBe(1);
  });
});
