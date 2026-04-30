import type { Task } from '../tasks/types.js';
import { listHumanGoals, listHumanProjects, type HumanGoalRecord, type HumanProjectRecord } from './human-state.js';

export type HumanConnectorStatus = 'active' | 'available' | 'needs_credentials';

export interface HumanConnector {
  id: string;
  name: string;
  domain: 'communication' | 'time' | 'execution' | 'projects' | 'goals' | 'knowledge' | 'relationship';
  status: HumanConnectorStatus;
  description: string;
  connectsTo: string[];
}

export interface HumanTaskSummary {
  id: string;
  title: string;
  priority: Task['priority'];
  status: Task['status'];
  project: string;
  nextAction: string;
  updatedAt: string;
}

export interface HumanProjectSummary {
  id: string;
  name: string;
  description?: string;
  status: 'on_track' | 'watch' | 'stalled';
  progress: number;
  openTasks: number;
  completedTasks: number;
  blockers: string[];
}

export interface HumanGoalSummary {
  id: string;
  name: string;
  description?: string;
  status: 'on_track' | 'at_risk' | 'done';
  progress: number;
  metric: string;
  target: string;
}

export interface DailyBriefing {
  date: string;
  generatedAt: string;
  executiveSummary: string;
  focus: string;
  topPriorities: HumanTaskSummary[];
  decisionsNeeded: string[];
  waitingOn: string[];
  followUps: string[];
  alerts: string[];
}

export interface HumanLayerSnapshot {
  briefing: DailyBriefing;
  tasks: {
    total: number;
    open: number;
    overdue: number;
    urgent: number;
    items: HumanTaskSummary[];
  };
  projects: HumanProjectSummary[];
  goals: HumanGoalSummary[];
  connectors: HumanConnector[];
  importantInfo: {
    unreadMessages: number;
    missedCalls: number;
    pendingDecisions: number;
    pendingFollowUps: number;
  };
}

const CONNECTOR_CATALOG: Omit<HumanConnector, 'status'>[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    domain: 'communication',
    description: 'Triages inbox items into briefing, tasks, and follow-ups.',
    connectsTo: ['email', 'tasks', 'projects', 'goals'],
  },
  {
    id: 'outlook',
    name: 'Outlook Mail',
    domain: 'communication',
    description: 'Supports Microsoft inbox triage and reply drafting.',
    connectsTo: ['email', 'tasks', 'projects'],
  },
  {
    id: 'exchange',
    name: 'Microsoft Exchange',
    domain: 'communication',
    description: 'Handles enterprise mail routing and compliance-aware triage.',
    connectsTo: ['email', 'tasks', 'knowledge'],
  },
  {
    id: 'calendar-google',
    name: 'Google Calendar',
    domain: 'time',
    description: 'Feeds meetings, focus blocks, and callback windows.',
    connectsTo: ['briefing', 'projects', 'goals'],
  },
  {
    id: 'calendar-outlook',
    name: 'Outlook Calendar',
    domain: 'time',
    description: 'Keeps scheduling, prep, and reminders in sync.',
    connectsTo: ['briefing', 'tasks', 'projects'],
  },
  {
    id: 'calendar-apple',
    name: 'Apple Calendar',
    domain: 'time',
    description: 'Captures personal scheduling and time blocking.',
    connectsTo: ['briefing', 'tasks'],
  },
  {
    id: 'todoist',
    name: 'Todoist',
    domain: 'execution',
    description: 'Pulls personal and delegated tasks into one queue.',
    connectsTo: ['tasks', 'briefing'],
  },
  {
    id: 'asana',
    name: 'Asana',
    domain: 'projects',
    description: 'Tracks project milestones and dependencies.',
    connectsTo: ['projects', 'tasks', 'goals'],
  },
  {
    id: 'monday',
    name: 'monday.com',
    domain: 'projects',
    description: 'Syncs project boards, owners, and statuses.',
    connectsTo: ['projects', 'tasks'],
  },
  {
    id: 'jira',
    name: 'Jira',
    domain: 'projects',
    description: 'Brings engineering work into the human operating system.',
    connectsTo: ['projects', 'tasks'],
  },
  {
    id: 'notion',
    name: 'Notion',
    domain: 'knowledge',
    description: 'Stores notes, decisions, and operating context.',
    connectsTo: ['knowledge', 'projects', 'goals'],
  },
  {
    id: 'google-docs',
    name: 'Google Docs',
    domain: 'knowledge',
    description: 'Surfaces working documents and decision drafts.',
    connectsTo: ['knowledge', 'projects'],
  },
  {
    id: 'contacts-google',
    name: 'Google Contacts',
    domain: 'relationship',
    description: 'Keeps relationship context and follow-up history aligned.',
    connectsTo: ['relationships', 'briefing'],
  },
  {
    id: 'contacts-outlook',
    name: 'Outlook Contacts',
    domain: 'relationship',
    description: 'Keeps Microsoft contacts and relationship records current.',
    connectsTo: ['relationships', 'briefing'],
  },
  {
    id: 'crm',
    name: 'CRM',
    domain: 'relationship',
    description: 'Tracks commitments, touchpoints, and account ownership.',
    connectsTo: ['relationships', 'tasks', 'briefing'],
  },
  {
    id: 'phone',
    name: 'Phone System',
    domain: 'communication',
    description: 'Captures calls, voicemails, and missed-call follow-ups.',
    connectsTo: ['communication', 'relationships', 'tasks'],
  },
  {
    id: 'slack',
    name: 'Slack',
    domain: 'communication',
    description: 'Routes urgent messages into task and briefing context.',
    connectsTo: ['communication', 'tasks', 'projects'],
  },
  {
    id: 'zoom',
    name: 'Zoom',
    domain: 'time',
    description: 'Feeds meeting prep and post-call action capture.',
    connectsTo: ['time', 'projects', 'tasks'],
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    domain: 'communication',
    description: 'Captures meeting context and team coordination signals.',
    connectsTo: ['communication', 'tasks', 'projects'],
  },
  {
    id: 'reminders',
    name: 'Apple Reminders',
    domain: 'execution',
    description: 'Feeds quick capture and personal action reminders.',
    connectsTo: ['tasks', 'briefing'],
  },
];

const connectorState = new Map<string, HumanConnector[]>();

function titleCase(input: string): string {
  return input
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getProjectKey(task: Task): string {
  const ctx = task.context ?? {};
  const projectCandidate =
    (ctx.projectId as string | undefined) ||
    (ctx.project as string | undefined) ||
    (ctx.projectName as string | undefined) ||
    task.tags.find((tag) => tag.startsWith('project:'))?.slice('project:'.length);
  return projectCandidate?.trim() || 'operations';
}

function getNextAction(task: Task): string {
  const ctx = task.context ?? {};
  const nextAction = ctx.nextAction || ctx.next_action || ctx.action;
  if (typeof nextAction === 'string' && nextAction.trim()) return nextAction.trim();
  if (task.description.trim()) return task.description.split(/\n+/)[0].trim();
  return 'Define the next physical action';
}

function getConnectorState(tenantId: string): HumanConnector[] {
  if (!connectorState.has(tenantId)) {
    connectorState.set(
      tenantId,
      CONNECTOR_CATALOG.map((connector) => ({
        ...connector,
        status: 'active' as const,
      })),
    );
  }
  return connectorState.get(tenantId) ?? [];
}

function summarizeProject(project: HumanProjectRecord): HumanProjectSummary {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    progress: project.progress,
    openTasks: project.openTasks,
    completedTasks: project.completedTasks,
    blockers: project.blockers,
  };
}

function summarizeGoal(goal: HumanGoalRecord): HumanGoalSummary {
  return {
    id: goal.id,
    name: goal.name,
    description: goal.linkedProjectIds.length > 0 ? `Linked to ${goal.linkedProjectIds.length} project(s)` : undefined,
    status: goal.status,
    progress: goal.progress,
    metric: goal.metric,
    target: goal.target,
  };
}

export function activateAllHumanConnectors(tenantId: string): HumanConnector[] {
  const activated = CONNECTOR_CATALOG.map((connector) => ({
    ...connector,
    status: 'active' as const,
  }));
  connectorState.set(tenantId, activated);
  return activated;
}

export function getHumanConnectors(tenantId: string): HumanConnector[] {
  return getConnectorState(tenantId);
}

export function buildHumanLayerSnapshot(input: {
  tenantId: string;
  tenantName: string;
  createdAt?: string;
  tasks: Task[];
  recentActivity: Array<{ action: string; created_at: string; detail?: Record<string, unknown> | null }>;
}): HumanLayerSnapshot {
  const connectors = activateAllHumanConnectors(input.tenantId);
  const allTasks = [...input.tasks];
  const openTasks = allTasks.filter((task) => task.status === 'pending' || task.status === 'running');
  const urgentTasks = openTasks.filter((task) => task.priority === 'high' || task.priority === 'critical');
  const now = Date.now();
  const storedProjects = listHumanProjects(input.tenantId);
  const storedGoals = listHumanGoals(input.tenantId);

  const taskSummaries: HumanTaskSummary[] = openTasks
    .sort((a, b) => {
      const priorityScore: Record<Task['priority'], number> = { critical: 0, high: 1, normal: 2, low: 3 };
      const aScore = priorityScore[a.priority] ?? 9;
      const bScore = priorityScore[b.priority] ?? 9;
      if (aScore !== bScore) return aScore - bScore;
      return b.updatedAt.localeCompare(a.updatedAt);
    })
    .slice(0, 8)
    .map((task) => ({
      id: task.id,
      title: task.title,
      priority: task.priority,
      status: task.status,
      project: titleCase(getProjectKey(task)),
      nextAction: getNextAction(task),
      updatedAt: task.updatedAt,
    }));

  const projectMap = new Map<string, {
    name: string;
    total: number;
    open: number;
    complete: number;
    blockers: string[];
  }>();

  for (const task of allTasks) {
    const key = getProjectKey(task);
    const entry = projectMap.get(key) ?? {
      name: titleCase(key),
      total: 0,
      open: 0,
      complete: 0,
      blockers: [],
    };
    entry.total += 1;
    if (task.status === 'complete') entry.complete += 1;
    else entry.open += 1;
    if ((task.priority === 'high' || task.priority === 'critical') && task.status !== 'complete') {
      entry.blockers.push(task.title);
    }
    projectMap.set(key, entry);
  }

  const derivedProjects: HumanProjectSummary[] = [...projectMap.entries()]
    .map(([id, project]) => {
      const progress = project.total === 0 ? 0 : Math.round((project.complete / project.total) * 100);
      const status: HumanProjectSummary['status'] =
        project.open === 0 ? 'on_track' : project.blockers.length > 0 ? 'watch' : 'stalled';
      return {
        id,
        name: project.name,
        description: `Derived from ${project.total} task${project.total === 1 ? '' : 's'}`,
        status,
        progress,
        openTasks: project.open,
        completedTasks: project.complete,
        blockers: project.blockers.slice(0, 3),
      };
    })
    .sort((a, b) => b.progress - a.progress || a.name.localeCompare(b.name));

  const projects: HumanProjectSummary[] = [
    ...storedProjects.map(summarizeProject),
    ...derivedProjects.filter((project) => !storedProjects.some((stored) => stored.name === project.name)),
  ].sort((a, b) => b.progress - a.progress || a.name.localeCompare(b.name));

  const derivedGoals: HumanGoalSummary[] = projects.length > 0
    ? projects.map((project) => ({
        id: `goal-${project.id}`,
        name: `Advance ${project.name}`,
        description: project.description,
        progress: project.progress,
        metric: `${project.completedTasks}/${project.completedTasks + project.openTasks || 1} tasks complete`,
        target: '100% project completion',
        status: project.status === 'watch' || project.status === 'stalled'
          ? 'at_risk'
          : project.progress === 100
            ? 'done'
            : 'on_track',
      }))
    : [{
        id: 'goal-focus',
        name: 'Keep the day aligned',
        progress: Math.min(100, openTasks.length * 10),
        metric: `${openTasks.length} open tasks`,
        target: 'Three must-dos completed',
        status: openTasks.length > 6 ? 'at_risk' : 'on_track',
      }];

  const goals: HumanGoalSummary[] = [
    ...storedGoals.map(summarizeGoal),
    ...derivedGoals.filter((goal) => !storedGoals.some((stored) => stored.name === goal.name)),
  ].sort((a, b) => b.progress - a.progress || a.name.localeCompare(b.name));

  const alerts: string[] = [];
  if (urgentTasks.length > 0) {
    alerts.push(`${urgentTasks.length} urgent tasks need attention`);
  }
  if (projects.some((project) => project.status !== 'on_track')) {
    alerts.push(`${projects.filter((project) => project.status !== 'on_track').length} project(s) need a check-in`);
  }
  if (connectors.length > 0) {
    alerts.push(`${connectors.filter((connector) => connector.status === 'active').length}/${connectors.length} connectors active`);
  }

  const recentFollowUps = input.recentActivity.slice(0, 3).map((item) => {
    const action = item.action.replace(/\./g, ' ').replace(/_/g, ' ');
    return `${action}${item.detail?.email ? ` for ${String(item.detail.email)}` : ''}`;
  });

  return {
    briefing: {
      date: new Date(now).toISOString().slice(0, 10),
      generatedAt: new Date(now).toISOString(),
      executiveSummary: `${input.tenantName} has ${openTasks.length} open task${openTasks.length === 1 ? '' : 's'} across ${projects.length || 1} project${projects.length === 1 ? '' : 's'}. ${urgentTasks.length > 0 ? 'Focus on the urgent queue first.' : 'The day is balanced and ready for execution.'}`,
      focus: urgentTasks[0]?.title || taskSummaries[0]?.title || 'Clear the first meaningful task',
      topPriorities: taskSummaries.slice(0, 3),
      decisionsNeeded: urgentTasks.slice(0, 3).map((task) => `${task.title} (${task.priority})`),
      waitingOn: allTasks
        .filter((task) => typeof task.assignedTo === 'string' && task.assignedTo.length > 0 && task.status !== 'complete')
        .slice(0, 3)
        .map((task) => `${task.title} from ${task.assignedTo}`),
      followUps: recentFollowUps,
      alerts,
    },
    tasks: {
      total: allTasks.length,
      open: openTasks.length,
      overdue: openTasks.filter((task) => {
        const deadline = task.context?.deadline as string | undefined;
        if (!deadline) return false;
        const ts = new Date(deadline).getTime();
        return Number.isFinite(ts) && ts < now;
      }).length,
      urgent: urgentTasks.length,
      items: taskSummaries,
    },
    projects,
    goals,
    connectors,
    importantInfo: {
      unreadMessages: Math.max(0, urgentTasks.length + Math.floor(openTasks.length / 3)),
      missedCalls: Math.max(0, input.recentActivity.filter((item) => item.action.includes('call') || item.action.includes('voicemail')).length),
      pendingDecisions: urgentTasks.length,
      pendingFollowUps: recentFollowUps.length,
    },
  };
}
