import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type HumanProjectStatus = 'on_track' | 'watch' | 'stalled';
export type HumanGoalStatus = 'on_track' | 'at_risk' | 'done';

export interface HumanProjectRecord {
  id: string;
  name: string;
  description: string;
  status: HumanProjectStatus;
  progress: number;
  openTasks: number;
  completedTasks: number;
  blockers: string[];
  createdAt: string;
  updatedAt: string;
}

export interface HumanGoalRecord {
  id: string;
  name: string;
  metric: string;
  target: string;
  status: HumanGoalStatus;
  progress: number;
  linkedProjectIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface HumanTenantState {
  projects: HumanProjectRecord[];
  goals: HumanGoalRecord[];
}

const DATA_DIR = join(process.cwd(), 'data', 'human-state');
const stateCache = new Map<string, HumanTenantState>();

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function statePath(tenantId: string): string {
  return join(DATA_DIR, `${tenantId}.json`);
}

function defaultState(): HumanTenantState {
  const now = new Date().toISOString();
  return {
    projects: [
      {
        id: randomUUID(),
        name: 'Operations',
        description: 'Keep the inbox, follow-ups, and daily execution flowing.',
        status: 'on_track',
        progress: 64,
        openTasks: 2,
        completedTasks: 4,
        blockers: ['Inbox triage'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        name: 'Growth',
        description: 'Turn the day’s work into measurable business momentum.',
        status: 'watch',
        progress: 41,
        openTasks: 3,
        completedTasks: 2,
        blockers: ['Decision pending'],
        createdAt: now,
        updatedAt: now,
      },
    ],
    goals: [
      {
        id: randomUUID(),
        name: 'Briefing readiness',
        metric: 'Briefing delivered before the day starts',
        target: '100% of business days',
        status: 'on_track',
        progress: 90,
        linkedProjectIds: [],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        name: 'Priority task closure',
        metric: 'Top tasks completed',
        target: 'At least 80% completion',
        status: 'at_risk',
        progress: 58,
        linkedProjectIds: [],
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

function persistState(tenantId: string, state: HumanTenantState): void {
  try {
    ensureDir(DATA_DIR);
    writeFileSync(statePath(tenantId), JSON.stringify(state, null, 2));
  } catch {
    // In-memory fallback only.
  }
}

function loadState(tenantId: string): HumanTenantState {
  const cached = stateCache.get(tenantId);
  if (cached) return cached;

  try {
    const raw = readFileSync(statePath(tenantId), 'utf8');
    const parsed = JSON.parse(raw) as HumanTenantState;
    const state = {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
    };
    stateCache.set(tenantId, state);
    return state;
  } catch {
    const state = defaultState();
    stateCache.set(tenantId, state);
    persistState(tenantId, state);
    return state;
  }
}

export function listHumanProjects(tenantId: string): HumanProjectRecord[] {
  return loadState(tenantId).projects;
}

export function createHumanProject(
  tenantId: string,
  input: Pick<HumanProjectRecord, 'name' | 'description'> & Partial<Pick<HumanProjectRecord, 'status' | 'progress' | 'openTasks' | 'completedTasks' | 'blockers'>>,
): HumanProjectRecord {
  const now = new Date().toISOString();
  const state = loadState(tenantId);
  const project: HumanProjectRecord = {
    id: randomUUID(),
    name: input.name.trim(),
    description: input.description.trim(),
    status: input.status ?? 'on_track',
    progress: input.progress ?? 0,
    openTasks: input.openTasks ?? 0,
    completedTasks: input.completedTasks ?? 0,
    blockers: input.blockers ?? [],
    createdAt: now,
    updatedAt: now,
  };
  state.projects.unshift(project);
  persistState(tenantId, state);
  return project;
}

export function listHumanGoals(tenantId: string): HumanGoalRecord[] {
  return loadState(tenantId).goals;
}

export function createHumanGoal(
  tenantId: string,
  input: Pick<HumanGoalRecord, 'name' | 'metric' | 'target'> & Partial<Pick<HumanGoalRecord, 'status' | 'progress' | 'linkedProjectIds'>>,
): HumanGoalRecord {
  const now = new Date().toISOString();
  const state = loadState(tenantId);
  const goal: HumanGoalRecord = {
    id: randomUUID(),
    name: input.name.trim(),
    metric: input.metric.trim(),
    target: input.target.trim(),
    status: input.status ?? 'on_track',
    progress: input.progress ?? 0,
    linkedProjectIds: input.linkedProjectIds ?? [],
    createdAt: now,
    updatedAt: now,
  };
  state.goals.unshift(goal);
  persistState(tenantId, state);
  return goal;
}

export function updateHumanProject(
  tenantId: string,
  projectId: string,
  patch: Partial<Omit<HumanProjectRecord, 'id' | 'createdAt'>>,
): HumanProjectRecord {
  const state = loadState(tenantId);
  const project = state.projects.find((entry) => entry.id === projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  Object.assign(project, patch, { updatedAt: new Date().toISOString() });
  persistState(tenantId, state);
  return project;
}

export function updateHumanGoal(
  tenantId: string,
  goalId: string,
  patch: Partial<Omit<HumanGoalRecord, 'id' | 'createdAt'>>,
): HumanGoalRecord {
  const state = loadState(tenantId);
  const goal = state.goals.find((entry) => entry.id === goalId);
  if (!goal) throw new Error(`Goal ${goalId} not found`);
  Object.assign(goal, patch, { updatedAt: new Date().toISOString() });
  persistState(tenantId, state);
  return goal;
}
