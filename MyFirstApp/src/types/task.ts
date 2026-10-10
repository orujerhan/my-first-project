export type Priority = 'low' | 'medium' | 'high';
export type ThemePreference = 'light' | 'dark' | 'system';
export type TaskStatusFilter = 'all' | 'active' | 'completed';
export type PriorityFilter = 'all' | Priority;

export type Task = {
  id: string;
  title: string;
  description: string;
  dueDate: string | null;
  priority: Priority;
  completed: boolean;
  createdAt: string;
};
