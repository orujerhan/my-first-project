import type {
  CompletionEvent,
  ProductivityStatistics,
  RecurrenceRule,
  StillBackup,
  Task,
  TaskStore,
  ThemePreference,
  Weekday,
} from '@/types/task';

const STORE_VERSION = 2;
const BACKUP_FORMAT = 'still-backup';
const BACKUP_VERSION = 1;
const weekdayOrder: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function addDays(value: string, amount: number): string {
  const date = parseDate(value);
  if (!date) throw new Error('Cannot move an invalid calendar date.');
  date.setDate(date.getDate() + amount);
  return formatDate(date);
}

export function dateLabel(value: string, today = formatDate(new Date())): string {
  const date = parseDate(value);
  if (!date) return value;
  if (value === today) return 'Today';
  if (value === addDays(today, 1)) return 'Tomorrow';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isPriority(value: unknown): value is Task['priority'] {
  return value === 'low' || value === 'medium' || value === 'high';
}

function normalizeRecurrence(value: unknown): RecurrenceRule | null | undefined {
  if (value === undefined) return null;
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  if (value.type === 'daily' || value.type === 'weekly') {
    return { type: value.type };
  }
  if (value.type !== 'weekdays' || !Array.isArray(value.days)) return undefined;
  const days: unknown[] = value.days;
  if (
    days.length === 0 ||
    days.some(day => !weekdayOrder.includes(day as Weekday))
  ) {
    return undefined;
  }
  return {
    type: 'weekdays',
    days: weekdayOrder.filter(day => days.includes(day)),
  };
}

function normalizeTask(value: unknown): Task | null {
  if (!isRecord(value)) return null;
  const recurrence = normalizeRecurrence(value.recurrence);
  if (
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    typeof value.title !== 'string' ||
    value.title.trim().length === 0 ||
    typeof value.description !== 'string' ||
    (value.dueDate !== null && parseDate(value.dueDate) === null) ||
    !isPriority(value.priority) ||
    typeof value.completed !== 'boolean' ||
    !isTimestamp(value.createdAt) ||
    recurrence === undefined ||
    (value.completedAt !== undefined &&
      value.completedAt !== null &&
      !isTimestamp(value.completedAt))
  ) {
    return null;
  }
  return {
    id: value.id,
    title: value.title,
    description: value.description,
    dueDate: value.dueDate as string | null,
    priority: value.priority,
    completed: value.completed,
    createdAt: value.createdAt,
    recurrence,
    completedAt:
      typeof value.completedAt === 'string' ? value.completedAt : null,
  };
}

function normalizeCompletionEvent(value: unknown): CompletionEvent | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    typeof value.taskId !== 'string' ||
    value.taskId.length === 0 ||
    typeof value.title !== 'string' ||
    (value.occurrenceDate !== null && parseDate(value.occurrenceDate) === null) ||
    (value.completionDate !== undefined &&
      parseDate(value.completionDate) === null) ||
    !isTimestamp(value.completedAt) ||
    typeof value.recurring !== 'boolean'
  ) {
    return null;
  }
  return {
    id: value.id,
    taskId: value.taskId,
    title: value.title,
    occurrenceDate: value.occurrenceDate as string | null,
    completionDate:
      typeof value.completionDate === 'string'
        ? value.completionDate
        : formatDate(new Date(value.completedAt)),
    completedAt: value.completedAt,
    recurring: value.recurring,
  };
}

function normalizeEvents(value: unknown): CompletionEvent[] {
  if (!Array.isArray(value)) {
    throw new Error('Saved completion history is not a list.');
  }
  const events: CompletionEvent[] = [];
  const ids = new Set<string>();
  const occurrences = new Set<string>();
  for (const item of value) {
    const event = normalizeCompletionEvent(item);
    if (!event) throw new Error('Saved completion history contains invalid data.');
    const occurrenceKey =
      event.recurring && event.occurrenceDate
        ? `${event.taskId}:${event.occurrenceDate}`
        : null;
    if (ids.has(event.id)) continue;
    ids.add(event.id);
    if (occurrenceKey && occurrences.has(occurrenceKey)) continue;
    if (occurrenceKey) occurrences.add(occurrenceKey);
    events.push(event);
  }
  return events;
}

function normalizeTasks(value: unknown[]): {
  tasks: Task[];
  preservedTasks: unknown[];
} {
  const tasks: Task[] = [];
  const preservedTasks: unknown[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    const task = normalizeTask(item);
    if (!task || ids.has(task.id)) {
      preservedTasks.push(item);
      continue;
    }
    ids.add(task.id);
    tasks.push(task);
  }
  return { tasks, preservedTasks };
}

function ensureCompletionEvents(
  tasks: Task[],
  completionHistory: CompletionEvent[],
): CompletionEvent[] {
  const events = [...completionHistory];
  for (const task of tasks) {
    if (!task.completed || !task.completedAt || task.recurrence) continue;
    const exists = events.some(
      event =>
        event.taskId === task.id &&
        !event.recurring &&
        event.completedAt === task.completedAt,
    );
    if (!exists) {
      events.push({
        id: `once:${task.id}:${task.completedAt}`,
        taskId: task.id,
        title: task.title,
        occurrenceDate: task.dueDate,
        completionDate: formatDate(new Date(task.completedAt)),
        completedAt: task.completedAt,
        recurring: false,
      });
    }
  }
  return events;
}

export function readTaskStore(value: string | null): TaskStore {
  if (!value) {
    return { version: STORE_VERSION, tasks: [], completionHistory: [] };
  }
  const parsed: unknown = JSON.parse(value);
  if (Array.isArray(parsed)) {
    const normalized = normalizeTasks(parsed);
    return {
      version: STORE_VERSION,
      tasks: normalized.tasks,
      completionHistory: ensureCompletionEvents(normalized.tasks, []),
      ...(normalized.preservedTasks.length
        ? { preservedTasks: normalized.preservedTasks }
        : {}),
    };
  }
  if (
    !isRecord(parsed) ||
    parsed.version !== STORE_VERSION ||
    !Array.isArray(parsed.tasks) ||
    (parsed.preservedTasks !== undefined && !Array.isArray(parsed.preservedTasks))
  ) {
    throw new Error('Saved task data uses an unsupported format.');
  }
  const normalized = normalizeTasks(parsed.tasks);
  const preservedTasks = [
    ...(Array.isArray(parsed.preservedTasks) ? parsed.preservedTasks : []),
    ...normalized.preservedTasks,
  ];
  return {
    version: STORE_VERSION,
    tasks: normalized.tasks,
    completionHistory: ensureCompletionEvents(
      normalized.tasks,
      normalizeEvents(parsed.completionHistory),
    ),
    ...(preservedTasks.length ? { preservedTasks } : {}),
  };
}

export function serializeTaskStore(store: TaskStore): string {
  return JSON.stringify({
    version: STORE_VERSION,
    tasks: store.tasks,
    completionHistory: store.completionHistory,
    ...(store.preservedTasks?.length
      ? { preservedTasks: store.preservedTasks }
      : {}),
  });
}

export function nextOccurrenceDate(
  occurrenceDate: string | null,
  rule: RecurrenceRule,
  today = formatDate(new Date()),
): string {
  const base = occurrenceDate && occurrenceDate > today ? occurrenceDate : today;
  if (rule.type === 'daily') return addDays(base, 1);
  if (rule.type === 'weekly') {
    const anchor = occurrenceDate ?? today;
    let candidate = addDays(base, 1);
    while (parseDate(candidate)?.getDay() !== parseDate(anchor)?.getDay()) {
      candidate = addDays(candidate, 1);
    }
    return candidate;
  }
  let candidate = addDays(base, 1);
  while (!rule.days.includes(parseDate(candidate)!.getDay() as Weekday)) {
    candidate = addDays(candidate, 1);
  }
  return candidate;
}

function eventOccurrenceKey(event: CompletionEvent): string {
  return event.recurring && event.occurrenceDate
    ? `${event.taskId}:${event.occurrenceDate}`
    : event.id;
}

export function calculateStatistics(
  tasks: Task[],
  completionHistory: CompletionEvent[],
  today = formatDate(new Date()),
): ProductivityStatistics {
  const uniqueEvents = new Map<string, CompletionEvent>();
  for (const event of completionHistory) {
    uniqueEvents.set(eventOccurrenceKey(event), event);
  }
  const events = [...uniqueEvents.values()];
  const activityDays = new Set(
    events.map(event => event.completionDate),
  );
  const sevenDaysAgo = addDays(today, -6);
  const completedToday = events.filter(
    event => event.completionDate === today,
  ).length;
  const completedLastSevenDays = events.filter(event => {
    const day = event.completionDate;
    return day >= sevenDaysAgo && day <= today;
  }).length;

  let streakStart = today;
  if (!activityDays.has(streakStart)) streakStart = addDays(today, -1);
  let currentStreak: number | null = null;
  if (activityDays.has(streakStart)) {
    currentStreak = 0;
    while (activityDays.has(streakStart)) {
      currentStreak += 1;
      streakStart = addDays(streakStart, -1);
    }
  }

  const dueOccurrences = new Set(events.map(eventOccurrenceKey));
  for (const task of tasks) {
    if (!task.completed && task.dueDate && task.dueDate <= today) {
      dueOccurrences.add(`${task.id}:${task.dueDate}`);
    }
  }
  const completionRate =
    dueOccurrences.size === 0 ? null : events.length / dueOccurrences.size;

  return {
    completedToday,
    completedLastSevenDays,
    totalCompleted: events.length,
    completionRate:
      completionRate === null ? null : Math.min(1, completionRate),
    currentStreak,
  };
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function validateBackup(value: unknown): StillBackup {
  if (
    !isRecord(value) ||
    value.format !== BACKUP_FORMAT ||
    value.version !== BACKUP_VERSION ||
    !isTimestamp(value.exportedAt) ||
    !Array.isArray(value.tasks) ||
    !Array.isArray(value.completionHistory) ||
    !isRecord(value.preferences) ||
    !isThemePreference(value.preferences.themePreference) ||
    typeof value.preferences.onboarded !== 'boolean'
  ) {
    throw new Error(
      'This file is not a supported Still backup. Choose a version 1 Still JSON backup.',
    );
  }
  const tasks: Task[] = [];
  const taskIds = new Set<string>();
  for (const valueTask of value.tasks) {
    const task = normalizeTask(valueTask);
    if (!task || taskIds.has(task.id)) {
      throw new Error('The backup contains an invalid or duplicate task.');
    }
    taskIds.add(task.id);
    tasks.push(task);
  }
  const normalizedHistory = normalizeEvents(value.completionHistory);
  if (normalizedHistory.length !== value.completionHistory.length) {
    throw new Error('The backup contains duplicate completion events.');
  }
  const completionHistory = ensureCompletionEvents(tasks, normalizedHistory);
  if (
    value.preservedTasks !== undefined &&
    !Array.isArray(value.preservedTasks)
  ) {
    throw new Error('The backup contains an invalid preserved task list.');
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: value.exportedAt,
    tasks,
    completionHistory,
    preferences: {
      themePreference: value.preferences.themePreference,
      onboarded: value.preferences.onboarded,
    },
    ...(Array.isArray(value.preservedTasks) && value.preservedTasks.length
      ? { preservedTasks: value.preservedTasks }
      : {}),
  };
}

export function createBackup(
  store: TaskStore,
  themePreference: ThemePreference,
  onboarded: boolean,
  exportedAt = new Date().toISOString(),
): StillBackup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    tasks: store.tasks,
    completionHistory: store.completionHistory,
    preferences: { themePreference, onboarded },
    ...(store.preservedTasks?.length
      ? { preservedTasks: store.preservedTasks }
      : {}),
  };
}

export function mergeTaskStores(current: TaskStore, incoming: StillBackup): TaskStore {
  const tasks = [...current.tasks];
  const taskIds = new Set(tasks.map(task => task.id));
  for (const task of incoming.tasks) {
    if (!taskIds.has(task.id)) {
      taskIds.add(task.id);
      tasks.push(task);
    }
  }
  const events = new Map(
    current.completionHistory.map(event => [eventOccurrenceKey(event), event]),
  );
  for (const event of incoming.completionHistory) {
    const key = eventOccurrenceKey(event);
    if (!events.has(key)) events.set(key, event);
  }
  return {
    version: STORE_VERSION,
    tasks,
    completionHistory: [...events.values()],
    preservedTasks: [
      ...(current.preservedTasks ?? []),
      ...(incoming.preservedTasks ?? []),
    ],
  };
}
