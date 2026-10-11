import type { CompletionEvent, Task } from '@/types/task';
import { TASKS_STORAGE_KEY, THEME_STORAGE_KEY } from '@/constants/app';

export const MOTIVATION_STORAGE_KEY = 'still.motivation.v1';
export const MOTIVATION_TRANSACTION_STORAGE_KEY = 'still.motivation.transaction.v1';

export const appearanceThemes = ['default', 'calm-light', 'midnight', 'blue-hour'] as const;
export type AppearanceTheme = (typeof appearanceThemes)[number];

export type MotivationState = {
  version: 1;
  sp: number;
  xp: number;
  rewardedOccurrenceIds: string[];
  firstCompletionBonusDates: string[];
  completedDayBonusDates: string[];
  dailyEligibleOccurrenceIds: Record<string, string[]>;
  unlockedThemes: AppearanceTheme[];
  selectedTheme: AppearanceTheme;
};

export const defaultMotivationState: MotivationState = {
  version: 1,
  sp: 0,
  xp: 0,
  rewardedOccurrenceIds: [],
  firstCompletionBonusDates: [],
  completedDayBonusDates: [],
  dailyEligibleOccurrenceIds: {},
  unlockedThemes: ['default'],
  selectedTheme: 'default',
};

const validDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

function uniqueStrings(value: unknown, field: string): string[] {
  if (
    !Array.isArray(value) ||
    value.some(item => typeof item !== 'string' || item.length === 0)
  ) {
    throw new Error(`Saved motivation data has an invalid ${field} list.`);
  }
  return [...new Set(value)];
}

function validTheme(value: unknown): value is AppearanceTheme {
  return appearanceThemes.includes(value as AppearanceTheme);
}

export function readMotivationState(value: string | null): MotivationState {
  if (value === null) return { ...defaultMotivationState };

  const parsed: unknown = JSON.parse(value);
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    (parsed as { version?: unknown }).version !== 1
  ) {
    throw new Error('Saved motivation data uses an unsupported format.');
  }
  const data = parsed as Record<string, unknown>;
  if (
    !Number.isSafeInteger(data.sp) ||
    (data.sp as number) < 0 ||
    !Number.isSafeInteger(data.xp) ||
    (data.xp as number) < 0
  ) {
    throw new Error('Saved motivation data has an invalid SP or XP balance.');
  }

  const rewardedOccurrenceIds = uniqueStrings(
    data.rewardedOccurrenceIds,
    'rewarded occurrence',
  );
  const firstCompletionBonusDates = uniqueStrings(
    data.firstCompletionBonusDates,
    'first-completion bonus date',
  );
  const completedDayBonusDates = uniqueStrings(
    data.completedDayBonusDates,
    'completed-day bonus date',
  );
  if (
    firstCompletionBonusDates.some(date => !validDate(date)) ||
    completedDayBonusDates.some(date => !validDate(date)) ||
    !data.dailyEligibleOccurrenceIds ||
    typeof data.dailyEligibleOccurrenceIds !== 'object' ||
    Array.isArray(data.dailyEligibleOccurrenceIds)
  ) {
    throw new Error('Saved motivation data has invalid daily bonus claims.');
  }

  const dailyEligibleOccurrenceIds: Record<string, string[]> = {};
  for (const [date, ids] of Object.entries(data.dailyEligibleOccurrenceIds)) {
    if (!validDate(date)) throw new Error('Saved motivation data has an invalid date.');
    dailyEligibleOccurrenceIds[date] = uniqueStrings(ids, 'daily eligible occurrence');
  }

  const unlockedThemes = uniqueStrings(data.unlockedThemes, 'unlocked theme');
  if (
    unlockedThemes.some(theme => !validTheme(theme)) ||
    !unlockedThemes.includes('default') ||
    !validTheme(data.selectedTheme) ||
    !unlockedThemes.includes(data.selectedTheme)
  ) {
    throw new Error('Saved motivation data has invalid theme ownership.');
  }

  return {
    version: 1,
    sp: data.sp as number,
    xp: data.xp as number,
    rewardedOccurrenceIds,
    firstCompletionBonusDates,
    completedDayBonusDates,
    dailyEligibleOccurrenceIds,
    unlockedThemes: unlockedThemes as AppearanceTheme[],
    selectedTheme: data.selectedTheme,
  };
}

export function readMotivationTransaction(
  value: string | null,
): [string, string][] | null {
  if (value === null) return null;
  const parsed: unknown = JSON.parse(value);
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    (parsed as { version?: unknown }).version !== 1 ||
    !Array.isArray((parsed as { values?: unknown }).values)
  ) {
    throw new Error('Saved progress transaction uses an unsupported format.');
  }
  const values = (parsed as { values: unknown[] }).values;
  const allowedKeys = [
    TASKS_STORAGE_KEY,
    THEME_STORAGE_KEY,
    MOTIVATION_STORAGE_KEY,
  ];
  if (
    values.some(
      entry =>
        !Array.isArray(entry) ||
        entry.length !== 2 ||
        typeof entry[0] !== 'string' ||
        typeof entry[1] !== 'string' ||
        !allowedKeys.includes(entry[0]),
    )
  ) {
    throw new Error('Saved progress transaction contains invalid data.');
  }
  return values as [string, string][];
}

export function occurrenceRewardId(
  taskId: string,
  recurring: boolean,
  occurrenceDate: string | null,
  completionDate: string,
): string {
  return recurring
    ? `occurrence:${taskId}:${occurrenceDate ?? completionDate}`
    : `task:${taskId}`;
}

export function rewardTaskCompletion(
  state: MotivationState,
  tasks: Task[],
  history: CompletionEvent[],
  event: CompletionEvent,
): MotivationState {
  // Existing task history is not eligible for retroactive rewards after migration.
  const hasEarlierCompletion = history.some(
    item =>
      item.taskId === event.taskId &&
      item.recurring === event.recurring &&
      (!event.recurring || item.occurrenceDate === event.occurrenceDate),
  );
  if (hasEarlierCompletion) return state;

  const occurrenceId = occurrenceRewardId(
    event.taskId,
    event.recurring,
    event.occurrenceDate,
    event.completionDate,
  );
  if (state.rewardedOccurrenceIds.includes(occurrenceId)) return state;

  const rewardedOccurrenceIds = [...state.rewardedOccurrenceIds, occurrenceId];
  const firstCompletion = !state.firstCompletionBonusDates.includes(event.completionDate);
  const next: MotivationState = {
    ...state,
    sp: state.sp + 10 + (firstCompletion ? 5 : 0),
    xp: state.xp + 10,
    rewardedOccurrenceIds,
    firstCompletionBonusDates: firstCompletion
      ? [...state.firstCompletionBonusDates, event.completionDate]
      : state.firstCompletionBonusDates,
    dailyEligibleOccurrenceIds: { ...state.dailyEligibleOccurrenceIds },
  };

  if (!Object.hasOwn(next.dailyEligibleOccurrenceIds, event.completionDate)) {
    // Freeze that day's schedule on its first rewarded completion; later-added tasks
    // cannot retroactively change a daily bonus claim.
    const eligible = new Set<string>();
    for (const task of tasks) {
      if (task.dueDate !== event.completionDate) continue;
      const id = occurrenceRewardId(
        task.id,
        Boolean(task.recurrence),
        task.dueDate,
        event.completionDate,
      );
      if (!task.completed || rewardedOccurrenceIds.includes(id)) eligible.add(id);
    }
    for (const completedEvent of [...history, event]) {
      if (
        completedEvent.completionDate !== event.completionDate ||
        completedEvent.occurrenceDate !== event.completionDate
      ) {
        continue;
      }
      const id = occurrenceRewardId(
        completedEvent.taskId,
        completedEvent.recurring,
        completedEvent.occurrenceDate,
        completedEvent.completionDate,
      );
      if (rewardedOccurrenceIds.includes(id)) eligible.add(id);
    }
    next.dailyEligibleOccurrenceIds[event.completionDate] = [...eligible];
  }

  const eligibleIds = next.dailyEligibleOccurrenceIds[event.completionDate];
  const allCompleted =
    eligibleIds.length > 0 &&
    eligibleIds.every(id => rewardedOccurrenceIds.includes(id)) &&
    !next.completedDayBonusDates.includes(event.completionDate);
  if (allCompleted) {
    next.sp += 10;
    next.completedDayBonusDates = [
      ...next.completedDayBonusDates,
      event.completionDate,
    ];
  }
  return next;
}

export function getLevelProgress(xp: number): {
  level: number;
  name: string;
  currentLevelXp: number;
  nextLevelXp: number | null;
} {
  const levels = [
    { level: 1, name: 'Starting', xp: 0 },
    { level: 2, name: 'Steady', xp: 100 },
    { level: 3, name: 'Focused', xp: 250 },
    { level: 4, name: 'Consistent', xp: 450 },
    { level: 5, name: 'Grounded', xp: 700 },
  ];
  const current = [...levels].reverse().find(item => xp >= item.xp) ?? levels[0];
  const next = levels.find(item => item.level === current.level + 1);
  return {
    level: current.level,
    name: current.name,
    currentLevelXp: current.xp,
    nextLevelXp: next?.xp ?? null,
  };
}
