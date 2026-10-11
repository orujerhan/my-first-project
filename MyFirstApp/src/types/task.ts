export type Priority = 'low' | 'medium' | 'high';
export type ThemePreference = 'light' | 'dark' | 'system';
export type TaskStatusFilter = 'all' | 'active' | 'completed';
export type PriorityFilter = 'all' | Priority;
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type RecurrenceRule =
  | { type: 'daily' }
  | { type: 'weekly' }
  | { type: 'weekdays'; days: Weekday[] };

export type Task = {
  id: string;
  title: string;
  description: string;
  dueDate: string | null;
  priority: Priority;
  completed: boolean;
  createdAt: string;
  recurrence?: RecurrenceRule | null;
  completedAt?: string | null;
};

export type CompletionEvent = {
  id: string;
  taskId: string;
  title: string;
  occurrenceDate: string | null;
  completionDate: string;
  completedAt: string;
  recurring: boolean;
};

export type TaskStore = {
  version: 2;
  tasks: Task[];
  completionHistory: CompletionEvent[];
  preservedTasks?: unknown[];
};

export type BackupPreferences = {
  themePreference: ThemePreference;
  onboarded: boolean;
};

export type StillBackup = {
  format: 'still-backup';
  version: 1;
  exportedAt: string;
  tasks: Task[];
  completionHistory: CompletionEvent[];
  preferences: BackupPreferences;
  preservedTasks?: unknown[];
};

export type ProductivityStatistics = {
  completedToday: number;
  completedLastSevenDays: number;
  totalCompleted: number;
  completionRate: number | null;
  currentStreak: number | null;
};
