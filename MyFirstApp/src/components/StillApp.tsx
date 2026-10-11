import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  APP_NAME,
  ONBOARDING_STORAGE_KEY,
  TASKS_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from '@/constants/app';
import type {
  Priority,
  PriorityFilter,
  CompletionEvent,
  ProductivityStatistics,
  RecurrenceRule,
  StillBackup,
  Task,
  TaskStore,
  TaskStatusFilter,
  ThemePreference,
  Weekday,
} from '@/types/task';
import {
  addDays,
  calculateStatistics,
  createBackup,
  dateLabel,
  formatDate,
  mergeTaskStores,
  nextOccurrenceDate,
  parseDate,
  readTaskStore,
  serializeTaskStore,
  validateBackup,
} from '@/lib/taskData';

const pages = [
  {
    label: 'WELCOME TO STILL',
    title: 'A little more\nroom to think.',
    body: "Hi, I'm Erhan. Still is my first mobile app. I wanted to make everyday task management feel simple.",
    art: 'welcome',
  },
  {
    label: 'MAKE A PLAN',
    title: 'Give your day\na gentle shape.',
    body: 'Create tasks, set a priority, and gather what matters today in one calm, clear place.',
    art: 'plan',
  },
  {
    label: 'NOTICE YOUR PROGRESS',
    title: 'One thing\nat a time.',
    body: 'Mark tasks complete as you go. Your progress stays close, and completed tasks are always easy to find.',
    art: 'progress',
  },
] as const;

const palettes = {
  light: {
    background: '#FFFFFF',
    surface: '#F7F7F6',
    raised: '#FFFFFF',
    text: '#191919',
    secondary: '#777777',
    muted: '#A0A0A0',
    border: '#E9E9E7',
    strong: '#191919',
    strongText: '#FFFFFF',
    track: '#E7E7E5',
    completed: '#B3B3B3',
    scrim: 'rgba(0,0,0,0.34)',
  },
  dark: {
    background: '#111111',
    surface: '#1B1B1B',
    raised: '#222222',
    text: '#F4F4F2',
    secondary: '#A5A5A5',
    muted: '#777777',
    border: '#303030',
    strong: '#F0F0EE',
    strongText: '#161616',
    track: '#343434',
    completed: '#777777',
    scrim: 'rgba(0,0,0,0.66)',
  },
} as const;

type Palette = (typeof palettes)[keyof typeof palettes];

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const weekdayOrder: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

function recurrenceLabel(rule: RecurrenceRule | null | undefined): string | null {
  if (!rule) return null;
  if (rule.type === 'daily') return 'Daily';
  if (rule.type === 'weekly') return 'Weekly';
  return rule.days.map(day => weekdayLabels[day]).join(', ');
}

function showStorageError(action: string, error: unknown) {
  console.error(`Still could not ${action}.`, error);
  Alert.alert(
    'Could not save changes',
    'Your changes are on screen, but could not be saved on this device. Please try again.',
  );
}

function SectionTitle({
  title,
  count,
  palette,
}: {
  title: string;
  count: number;
  palette: Palette;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text>
      <Text style={[styles.sectionCount, { color: palette.muted }]}>
        {`${count}`.padStart(2, '0')}
      </Text>
    </View>
  );
}

function OnboardingIllustration({
  page,
  palette,
}: {
  page: (typeof pages)[number];
  palette: Palette;
}) {
  const card = [styles.illustrationCard, { backgroundColor: palette.surface, borderColor: palette.border }];
  const line = [styles.illustrationLine, { backgroundColor: palette.border }];
  return (
    <View style={styles.illustration}>
      <View style={[styles.illustrationOrbit, { borderColor: palette.border }]}>
        <View style={[styles.illustrationCore, { backgroundColor: palette.strong }]}>
          <Text style={[styles.illustrationMark, { color: palette.strongText }]}>
            {page.art === 'welcome' ? 's.' : page.art === 'plan' ? '+' : '✓'}
          </Text>
        </View>
        {page.art !== 'welcome' && (
          <View style={[styles.illustrationDot, { backgroundColor: palette.secondary }]} />
        )}
      </View>
      {page.art !== 'welcome' && (
        <View style={card}>
          {[0, 1, 2].map(index => (
            <View key={index} style={styles.illustrationRow}>
              <View
                style={[
                  styles.illustrationCheck,
                  {
                    borderColor:
                      page.art === 'progress' && index === 0
                        ? palette.strong
                        : palette.muted,
                    backgroundColor:
                      page.art === 'progress' && index === 0
                        ? palette.strong
                        : 'transparent',
                  },
                ]}
              >
                {page.art === 'progress' && index === 0 && (
                  <Text style={[styles.illustrationTick, { color: palette.strongText }]}>
                    ✓
                  </Text>
                )}
              </View>
              <View
                style={[
                  line,
                  {
                    width: index === 1 ? '44%' : '62%',
                    opacity: page.art === 'progress' && index === 0 ? 0.45 : 1,
                  },
                ]}
              />
              {page.art === 'plan' && index === 1 && (
                <View style={[styles.illustrationPriority, { backgroundColor: palette.border }]} />
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function TaskRow({
  task,
  palette,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  palette: Palette;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const priorityColor =
    task.priority === 'high'
      ? palette.text
      : task.priority === 'medium'
        ? palette.secondary
        : palette.muted;
  const dueLabel = task.dueDate
    ? !task.completed && task.dueDate < formatDate(new Date())
      ? 'Overdue'
      : dateLabel(task.dueDate)
    : 'No date';
  const repeatLabel = recurrenceLabel(task.recurrence);
  return (
    <View style={[styles.taskRow, { borderBottomColor: palette.border }]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.completed }}
        accessibilityLabel={`${task.completed ? 'Reopen' : 'Complete'} ${task.title}`}
        hitSlop={8}
        style={[
          styles.checkbox,
          {
            borderColor: task.completed ? palette.strong : palette.muted,
            backgroundColor: task.completed ? palette.strong : 'transparent',
          },
        ]}
      >
        {task.completed && (
          <Text style={[styles.checkmark, { color: palette.strongText }]}>✓</Text>
        )}
      </Pressable>

      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${task.title}`}
        style={styles.taskContent}
      >
        <Text
          style={[
            styles.taskTitle,
            {
              color: task.completed ? palette.completed : palette.text,
              textDecorationLine: task.completed ? 'line-through' : 'none',
            },
          ]}
        >
          {task.title}
        </Text>
        {!!task.description && (
          <Text
            numberOfLines={2}
            style={[styles.taskDescription, { color: palette.secondary }]}
          >
            {task.description}
          </Text>
        )}
        <View style={styles.taskMeta}>
          <Text style={[styles.taskMetaText, { color: palette.secondary }]}>
            {dueLabel}
          </Text>
          <View style={[styles.metaDot, { backgroundColor: palette.muted }]} />
          <Text style={[styles.taskMetaText, { color: priorityColor }]}>
            {task.priority}
          </Text>
          {repeatLabel && (
            <>
              <View style={[styles.metaDot, { backgroundColor: palette.muted }]} />
              <Text style={[styles.taskMetaText, { color: palette.secondary }]}>
                {repeatLabel}
              </Text>
            </>
          )}
        </View>
      </Pressable>

      <Pressable
        onPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${task.title}`}
        hitSlop={10}
        style={styles.deleteButton}
      >
        <Text style={[styles.deleteGlyph, { color: palette.muted }]}>×</Text>
      </Pressable>
    </View>
  );
}

export default function StillApp() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [page, setPage] = useState(0);
  const [today, setToday] = useState(() => formatDate(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completionHistory, setCompletionHistory] = useState<CompletionEvent[]>([]);
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');
  const [tab, setTab] = useState<'tasks' | 'calendar' | 'statistics' | 'settings'>('tasks');
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(formatDate(new Date()));
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(formatDate(new Date()));
  const [customDateDraft, setCustomDateDraft] = useState('');
  const [priorityDraft, setPriorityDraft] = useState<Priority>('medium');
  const [recurrenceDraft, setRecurrenceDraft] = useState<RecurrenceRule | null>(null);
  const [taskStorageWritable, setTaskStorageWritable] = useState(true);
  const tasksDirty = useRef(false);
  const preservedTasks = useRef<unknown[]>([]);
  const persistQueue = useRef<Promise<void>>(Promise.resolve());

  const colorScheme = useColorScheme();
  const effectiveTheme =
    themePreference === 'system' ? (colorScheme === 'dark' ? 'dark' : 'light') : themePreference;
  const palette = palettes[effectiveTheme];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowValue = formatDate(tomorrow);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentDate = formatDate(new Date());
      setToday(previous => (previous === currentDate ? previous : currentDate));
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function loadSavedData() {
      try {
        const savedValues = await AsyncStorage.multiGet([
          TASKS_STORAGE_KEY,
          ONBOARDING_STORAGE_KEY,
          THEME_STORAGE_KEY,
        ]);
        const saved = new Map(savedValues);
        setOnboarded(saved.get(ONBOARDING_STORAGE_KEY) === 'yes');
        const savedTheme = saved.get(THEME_STORAGE_KEY);
        if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
          setThemePreference(savedTheme);
        }
        const taskStore = readTaskStore(saved.get(TASKS_STORAGE_KEY) ?? null);
        setTasks(taskStore.tasks);
        setCompletionHistory(taskStore.completionHistory);
        preservedTasks.current = taskStore.preservedTasks ?? [];
        if (preservedTasks.current.length) {
          Alert.alert(
            'Some saved tasks could not be shown',
            'Those entries are being kept in local storage while the readable tasks remain available.',
          );
        }
      } catch (error) {
        console.error('Still could not load saved data.', error);
        Alert.alert(
          'Could not load saved data',
          'Still could not safely read the saved task list. The original data has not been overwritten, and task changes are disabled until you restore a valid backup.',
        );
        setTaskStorageWritable(false);
      } finally {
        setReady(true);
      }
    }
    void loadSavedData();
  }, []);

  useEffect(() => {
    if (!ready || !tasksDirty.current || !taskStorageWritable) return;
    tasksDirty.current = false;
    const store: TaskStore = {
      version: 2,
      tasks,
      completionHistory,
      ...(preservedTasks.current.length
        ? { preservedTasks: preservedTasks.current }
        : {}),
    };
    persistQueue.current = persistQueue.current
      .then(() => AsyncStorage.setItem(TASKS_STORAGE_KEY, serializeTaskStore(store)))
      .catch(error => showStorageError('save your tasks', error));
  }, [completionHistory, ready, taskStorageWritable, tasks]);

  async function updatePreference(key: string, value: string, action: string) {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      showStorageError(action, error);
      return false;
    }
    return true;
  }

  async function finishOnboarding() {
    if (!(await updatePreference(ONBOARDING_STORAGE_KEY, 'yes', 'save onboarding status'))) {
      return;
    }
    setOnboarded(true);
    setPage(0);
    setTab('tasks');
  }

  async function replayOnboarding() {
    if (!(await updatePreference(ONBOARDING_STORAGE_KEY, 'no', 'replay the introduction'))) {
      return;
    }
    setPage(0);
    setOnboarded(false);
  }

  function ensureTaskStorageWritable() {
    if (taskStorageWritable) return true;
    Alert.alert(
      'Tasks are read-only',
      'Saved task data could not be read safely. Restore a valid Still backup before making task changes.',
    );
    return false;
  }

  function openNewTask() {
    if (!ensureTaskStorageWritable()) return;
    setEditingId(null);
    setTitleDraft('');
    setDescriptionDraft('');
    setSelectedDate(today);
    setCustomDateDraft('');
    setPriorityDraft('medium');
    setRecurrenceDraft(null);
    setModalVisible(true);
  }

  function openEditTask(task: Task) {
    if (!ensureTaskStorageWritable()) return;
    setEditingId(task.id);
    setTitleDraft(task.title);
    setDescriptionDraft(task.description);
    setSelectedDate(task.dueDate);
    setCustomDateDraft(
      task.dueDate && task.dueDate !== today && task.dueDate !== tomorrowValue
        ? task.dueDate
        : '',
    );
    setPriorityDraft(task.priority);
    setRecurrenceDraft(task.recurrence ?? null);
    setModalVisible(true);
  }

  function saveTask() {
    if (!ensureTaskStorageWritable()) return;
    const cleanTitle = titleDraft.trim();
    if (!cleanTitle) {
      Alert.alert('A title is needed', 'Enter a task name before saving.');
      return;
    }

    const cleanCustomDate = customDateDraft.trim();
    if (cleanCustomDate && !parseDate(cleanCustomDate)) {
      Alert.alert('Check the date', 'Use a valid date in YYYY-MM-DD format.');
      return;
    }
    const dueDate = cleanCustomDate || selectedDate;

    const description = descriptionDraft.trim();
    if (editingId) {
      setTasks(current =>
        current.map(task =>
          task.id === editingId
            ? {
                ...task,
                title: cleanTitle,
                description,
                dueDate,
                priority: priorityDraft,
                recurrence: recurrenceDraft,
                ...(!task.recurrence && recurrenceDraft
                  ? { completed: false, completedAt: null }
                  : {}),
              }
            : task,
        ),
      );
    } else {
      const newTask: Task = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: cleanTitle,
        description,
        dueDate,
        priority: priorityDraft,
        completed: false,
        createdAt: new Date().toISOString(),
        recurrence: recurrenceDraft,
        completedAt: null,
      };
      setTasks(current => [newTask, ...current]);
    }
    tasksDirty.current = true;
    setModalVisible(false);
  }

  function toggleTask(id: string) {
    if (!ensureTaskStorageWritable()) return;
    const task = tasks.find(item => item.id === id);
    if (!task) return;
    if (task.completed) {
      setTasks(current =>
        current.map(item =>
          item.id === id ? { ...item, completed: false, completedAt: null } : item,
        ),
      );
    } else {
      const completedAt = new Date().toISOString();
      const occurrenceDate = task.dueDate ?? today;
      const recurring = task.recurrence !== null && task.recurrence !== undefined;
      const event: CompletionEvent = {
        id: recurring
          ? `repeat:${task.id}:${occurrenceDate}`
          : `once:${task.id}:${completedAt}:${Math.random().toString(36).slice(2)}`,
        taskId: task.id,
        title: task.title,
        occurrenceDate,
        completionDate: today,
        completedAt,
        recurring,
      };
      const recurrence = task.recurrence;
      setCompletionHistory(current => {
        if (
          current.some(
            item =>
              item.id === event.id ||
              (recurring &&
                item.recurring &&
                item.taskId === task.id &&
                item.occurrenceDate === occurrenceDate),
          )
        ) {
          return current;
        }
        return [...current, event];
      });
      if (recurrence) {
        setTasks(current =>
          current.map(item =>
            item.id === id
              ? {
                  ...item,
                  dueDate: nextOccurrenceDate(task.dueDate, recurrence, today),
                  completed: false,
                  completedAt: null,
                }
              : item,
          ),
        );
      } else {
        setTasks(current =>
          current.map(item =>
            item.id === id
              ? { ...item, completed: true, completedAt }
              : item,
          ),
        );
      }
    }
    tasksDirty.current = true;
  }

  function confirmDelete(task: Task) {
    if (!ensureTaskStorageWritable()) return;
    Alert.alert('Delete this task?', `"${task.title}" will be removed from Still.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setTasks(current => current.filter(item => item.id !== task.id));
          tasksDirty.current = true;
        },
      },
    ]);
  }

  async function changeTheme(value: ThemePreference) {
    if (!(await updatePreference(THEME_STORAGE_KEY, value, 'save your appearance setting'))) {
      return;
    }
    setThemePreference(value);
  }

  function currentTaskStore(): TaskStore {
    return {
      version: 2,
      tasks,
      completionHistory,
      ...(preservedTasks.current.length
        ? { preservedTasks: preservedTasks.current }
        : {}),
    };
  }

  async function exportBackup(): Promise<boolean> {
    try {
      if (!taskStorageWritable) {
        throw new Error(
          'Still could not read the saved tasks. No backup was created so unreadable data is not mistaken for an empty list.',
        );
      }
      const backup = createBackup(
        currentTaskStore(),
        themePreference,
        onboarded,
      );
      const fileName = `still-backup-${Date.now()}.json`;
      const content = `${JSON.stringify(backup, null, 2)}\n`;
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(
          new Blob([content], { type: 'application/json' }),
        );
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        Alert.alert('Backup ready', 'Still downloaded a local JSON backup file.');
        return true;
      }
      const file = new File(Paths.cache, fileName);
      file.write(content);
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('File sharing is not available on this device or browser.');
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Export Still backup',
      });
      Alert.alert(
        'Backup ready',
        'Still prepared a local JSON backup. Save or share it from the system sheet to keep a copy.',
      );
      return true;
    } catch (error) {
      console.error('Still could not export a backup.', error);
      Alert.alert(
        'Could not export backup',
        error instanceof Error
          ? error.message
          : 'Still could not create or share the backup file.',
      );
      return false;
    }
  }

  async function restoreBackup(backup: StillBackup, mode: 'merge' | 'replace') {
    const current = currentTaskStore();
    const nextStore =
      mode === 'merge'
        ? mergeTaskStores(current, backup)
        : {
            version: 2 as const,
            tasks: backup.tasks,
            completionHistory: backup.completionHistory,
            ...(backup.preservedTasks?.length
              ? { preservedTasks: backup.preservedTasks }
              : {}),
          };
    const values: [string, string][] = [
      [TASKS_STORAGE_KEY, serializeTaskStore(nextStore)],
    ];
    if (mode === 'replace') {
      values.push(
        [THEME_STORAGE_KEY, backup.preferences.themePreference],
        [ONBOARDING_STORAGE_KEY, backup.preferences.onboarded ? 'yes' : 'no'],
      );
    }
    const write = persistQueue.current.then(() => AsyncStorage.multiSet(values));
    persistQueue.current = write.catch(error => {
      console.error('Still could not restore the backup.', error);
      Alert.alert(
        'Could not restore backup',
        'Still could not save the selected backup. The in-memory data was not replaced.',
      );
    });
    try {
      await write;
    } catch {
      return;
    }
    preservedTasks.current = nextStore.preservedTasks ?? [];
    tasksDirty.current = false;
    setTaskStorageWritable(true);
    setTasks(nextStore.tasks);
    setCompletionHistory(nextStore.completionHistory);
    if (mode === 'replace') {
      setThemePreference(backup.preferences.themePreference);
      setOnboarded(backup.preferences.onboarded);
    }
    Alert.alert(
      'Backup restored',
      mode === 'merge'
        ? 'Tasks with new IDs and any new completion events were added. Existing tasks and preferences were kept.'
        : 'The backup replaced the local tasks, completion history, and preferences.',
    );
  }

  async function pickBackupToRestore() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json'],
        copyToCacheDirectory: true,
        multiple: false,
        base64: false,
      });
      if (result.canceled || !result.assets.length) return;
      const selected = result.assets[0];
      const content =
        Platform.OS === 'web'
          ? await selected.file?.text()
          : new File(selected.uri).textSync();
      if (content === undefined) {
        throw new Error('The selected file could not be read.');
      }
      const backup = validateBackup(JSON.parse(content) as unknown);
      if (!taskStorageWritable) {
        Alert.alert(
          'Saved data could not be read',
          'Still cannot safely merge with the current task data. Replacing it will overwrite the unreadable local value.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Replace',
              style: 'destructive',
              onPress: () => void restoreBackup(backup, 'replace'),
            },
          ],
        );
        return;
      }
      Alert.alert(
        'Restore this backup?',
        'Choose how to combine its tasks, recurrence rules, completion history, and preferences with this device.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Merge',
            onPress: () => void restoreBackup(backup, 'merge'),
          },
          {
            text: 'Replace…',
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                'Replace local data?',
                'This replaces all local tasks and completion history. Export a copy of the current data first if you may need it later.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Export first',
                    onPress: () => {
                      void (async () => {
                        if (await exportBackup()) {
                          Alert.alert(
                            'Confirm replacement',
                            'Your current data has been offered for export. Replace it with the selected backup?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Replace',
                                style: 'destructive',
                                onPress: () => void restoreBackup(backup, 'replace'),
                              },
                            ],
                          );
                        }
                      })();
                    },
                  },
                  {
                    text: 'Replace anyway',
                    style: 'destructive',
                    onPress: () => void restoreBackup(backup, 'replace'),
                  },
                ],
              );
            },
          },
        ],
      );
    } catch (error) {
      console.error('Still could not read a backup file.', error);
      Alert.alert(
        'Could not restore backup',
        error instanceof Error
          ? error.message
          : 'Still could not read that file. Choose a valid Still JSON backup.',
      );
    }
  }

  const activeCount = tasks.filter(task => !task.completed).length;
  const completedCount = tasks.length - activeCount;
  const statistics = useMemo(
    () => calculateStatistics(tasks, completionHistory, today),
    [completionHistory, tasks, today],
  );
  const matchingTasks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return tasks.filter(task => {
      if (statusFilter === 'active' && task.completed) return false;
      if (statusFilter === 'completed' && !task.completed) return false;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      return (
        !query ||
        task.title.toLocaleLowerCase().includes(query) ||
        task.description.toLocaleLowerCase().includes(query)
      );
    });
  }, [priorityFilter, search, statusFilter, tasks]);

  if (!ready) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
        <StatusBar barStyle={effectiveTheme === 'dark' ? 'light-content' : 'dark-content'} />
        <View style={styles.loading}>
          <Text style={[styles.wordmark, { color: palette.text }]}>{APP_NAME}</Text>
          <Text style={[styles.loadingCaption, { color: palette.secondary }]}>
            A little space for your day.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!onboarded) {
    const currentPage = pages[page];
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
        <StatusBar barStyle={effectiveTheme === 'dark' ? 'light-content' : 'dark-content'} />
        <View style={styles.onboardingScreen}>
          <View style={styles.onboardingTop}>
            <Text style={[styles.wordmark, { color: palette.text }]}>{APP_NAME}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void finishOnboarding()}
              hitSlop={10}
            >
              <Text style={[styles.skipText, { color: palette.secondary }]}>Skip</Text>
            </Pressable>
          </View>

          <OnboardingIllustration page={currentPage} palette={palette} />

          <View style={styles.onboardingCopy}>
            <Text style={[styles.eyebrow, { color: palette.secondary }]}>
              {currentPage.label}
            </Text>
            <Text style={[styles.onboardingTitle, { color: palette.text }]}>
              {currentPage.title}
            </Text>
            <Text style={[styles.onboardingBody, { color: palette.secondary }]}>
              {currentPage.body}
            </Text>
          </View>

          <View style={styles.onboardingFooter}>
            <View style={styles.progressDots}>
              {pages.map((item, index) => (
                <View
                  key={item.label}
                  style={[
                    styles.progressDot,
                    {
                      width: index === page ? 23 : 6,
                      backgroundColor: index === page ? palette.strong : palette.track,
                    },
                  ]}
                />
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              style={[styles.primaryButton, { backgroundColor: palette.strong }]}
              onPress={() =>
                page < pages.length - 1 ? setPage(page + 1) : void finishOnboarding()
              }
            >
              <Text style={[styles.primaryButtonText, { color: palette.strongText }]}>
                {page < pages.length - 1 ? 'Continue' : 'Get started'}
              </Text>
              <Text style={[styles.buttonArrow, { color: palette.strongText }]}>→</Text>
            </Pressable>
            <Text style={[styles.onboardingFootnote, { color: palette.muted }]}>
              MADE BY ERHAN, FOR EVERYDAY
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const todayTasks = matchingTasks.filter(
    task => !task.completed && (!task.dueDate || task.dueDate === today),
  );
  const overdueTasks = matchingTasks.filter(
    task => !task.completed && task.dueDate !== null && task.dueDate < today,
  );
  const upcomingTasks = matchingTasks.filter(
    task => !task.completed && task.dueDate !== null && task.dueDate > today,
  );
  const completedTasks = matchingTasks.filter(task => task.completed);
  const hasSearchOrPriorityFilter =
    Boolean(search.trim()) || priorityFilter !== 'all';
  const showToday = statusFilter !== 'completed';
  const showUpcoming = statusFilter !== 'completed';
  const showCompleted = statusFilter !== 'active';
  const progress = tasks.length ? completedCount / tasks.length : 0;
  const widgetTasks = tasks.filter(
    task => !task.completed && (!task.dueDate || task.dueDate === today),
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <StatusBar barStyle={effectiveTheme === 'dark' ? 'light-content' : 'dark-content'} />
      <View style={styles.appScreen}>
        {tab === 'tasks' ? (
          <>
            <View style={styles.topBar}>
              <Text style={[styles.wordmark, { color: palette.text }]}>{APP_NAME}</Text>
              <Text style={[styles.topBarLabel, { color: palette.secondary }]}>YOUR SPACE</Text>
            </View>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.dateText, { color: palette.secondary }]}>
                {new Date().toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                }).toUpperCase()}
              </Text>
              <Text style={[styles.pageTitle, { color: palette.text }]}>Your day</Text>
              <Text style={[styles.pageSubtitle, { color: palette.secondary }]}>
                {activeCount
                  ? `${activeCount} ${activeCount === 1 ? 'task' : 'tasks'} still to do.`
                  : tasks.length
                    ? 'You have made it through your list.'
                    : 'A fresh page, whenever you are ready.'}
              </Text>

              <View style={[styles.progressCard, { backgroundColor: palette.surface }]}>
                <View style={styles.progressCardTop}>
                  <Text style={[styles.progressLabel, { color: palette.secondary }]}>
                    TASK PROGRESS
                  </Text>
                  <Text style={[styles.progressValue, { color: palette.text }]}>
                    {completedCount} / {tasks.length}
                  </Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: palette.track }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.round(progress * 100)}%`,
                        backgroundColor: palette.strong,
                      },
                    ]}
                  />
                </View>
              </View>

              <View
                style={[
                  styles.widgetPreview,
                  { backgroundColor: palette.surface, borderColor: palette.border },
                ]}
                accessibilityLabel={`In-app widget preview. ${widgetTasks.length} tasks for today.`}
              >
                <View style={styles.widgetPreviewTop}>
                  <View>
                    <Text style={[styles.widgetPreviewEyebrow, { color: palette.secondary }]}>
                      WIDGET PREVIEW · IN APP
                    </Text>
                    <Text style={[styles.widgetPreviewTitle, { color: palette.text }]}>
                      Today
                    </Text>
                  </View>
                  <Text style={[styles.widgetPreviewCount, { color: palette.text }]}>
                    {widgetTasks.length}
                  </Text>
                </View>
                {widgetTasks.length ? (
                  widgetTasks.slice(0, 3).map(task => (
                    <Text
                      key={task.id}
                      numberOfLines={1}
                      style={[styles.widgetPreviewTask, { color: palette.secondary }]}
                    >
                      □  {task.title}
                    </Text>
                  ))
                ) : (
                  <Text style={[styles.widgetPreviewTask, { color: palette.muted }]}>
                    No incomplete tasks for today.
                  </Text>
                )}
                <Text style={[styles.widgetPreviewNote, { color: palette.muted }]}>
                  Preview only · not an OS home-screen widget
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                style={[styles.addButton, { borderColor: palette.border }]}
                onPress={openNewTask}
              >
                <Text style={[styles.addGlyph, { color: palette.text }]}>+</Text>
                <Text style={[styles.addLabel, { color: palette.secondary }]}>
                  Add a task
                </Text>
              </Pressable>

              <View style={[styles.searchBox, { borderColor: palette.border }]}>
                <Text style={[styles.searchGlyph, { color: palette.secondary }]}>⌕</Text>
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search your tasks"
                  placeholderTextColor={palette.muted}
                  returnKeyType="search"
                  accessibilityLabel="Search tasks"
                  style={[styles.searchInput, { color: palette.text }]}
                />
                {!!search && (
                  <Pressable
                    onPress={() => setSearch('')}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                  >
                    <Text style={[styles.clearSearch, { color: palette.secondary }]}>×</Text>
                  </Pressable>
                )}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                {(
                  [
                    ['all', 'All'],
                    ['active', 'To do'],
                    ['completed', 'Completed'],
                  ] as const
                ).map(([value, label]) => (
                  <FilterChip
                    key={value}
                    label={label}
                    selected={statusFilter === value}
                    palette={palette}
                    onPress={() => setStatusFilter(value)}
                  />
                ))}
                <View style={[styles.filterDivider, { backgroundColor: palette.border }]} />
                {(
                  [
                    ['all', 'Any priority'],
                    ['high', 'High'],
                    ['medium', 'Medium'],
                    ['low', 'Low'],
                  ] as const
                ).map(([value, label]) => (
                  <FilterChip
                    key={value}
                    label={label}
                    selected={priorityFilter === value}
                    palette={palette}
                    onPress={() => setPriorityFilter(value)}
                  />
                ))}
              </ScrollView>

              {!matchingTasks.length ? (
                <View style={styles.emptyState}>
                  <View style={[styles.emptyMark, { borderColor: palette.border }]}>
                    <Text style={[styles.emptyMarkText, { color: palette.secondary }]}>
                      {search || statusFilter !== 'all' || priorityFilter !== 'all' ? '⌕' : '+'}
                    </Text>
                  </View>
                  <Text style={[styles.emptyTitle, { color: palette.text }]}>
                    {hasSearchOrPriorityFilter
                      ? 'No matching tasks'
                      : statusFilter === 'completed'
                        ? 'Nothing completed yet'
                        : statusFilter === 'active'
                          ? 'All caught up'
                          : 'Nothing on your list'}
                  </Text>
                  <Text style={[styles.emptyBody, { color: palette.secondary }]}>
                    {hasSearchOrPriorityFilter
                      ? 'Try another search or adjust your filters.'
                      : statusFilter === 'completed'
                        ? 'Finished tasks will appear here.'
                        : statusFilter === 'active'
                          ? 'There are no active tasks right now.'
                          : 'Add one small thing to begin.'}
                  </Text>
                  {!search && statusFilter === 'all' && priorityFilter === 'all' && (
                    <Pressable onPress={openNewTask} style={styles.emptyAction}>
                      <Text style={[styles.emptyActionText, { color: palette.text }]}>
                        Create your first task →
                      </Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                <>
                  {showToday && (
                    <TaskSection
                      title="Overdue"
                      tasks={overdueTasks}
                      palette={palette}
                      onToggle={toggleTask}
                      onEdit={openEditTask}
                      onDelete={confirmDelete}
                      emptyText="Nothing overdue."
                    />
                  )}
                  {showToday && (
                    <TaskSection
                      title="Today"
                      tasks={todayTasks}
                      palette={palette}
                      onToggle={toggleTask}
                      onEdit={openEditTask}
                      onDelete={confirmDelete}
                      emptyText={
                        statusFilter === 'all' && !search && priorityFilter === 'all'
                          ? 'Nothing planned for today.'
                          : 'No tasks match here.'
                      }
                    />
                  )}
                  {showUpcoming && (
                    <TaskSection
                      title="Upcoming"
                      tasks={upcomingTasks}
                      palette={palette}
                      onToggle={toggleTask}
                      onEdit={openEditTask}
                      onDelete={confirmDelete}
                      emptyText="Nothing scheduled ahead."
                    />
                  )}
                  {showCompleted && (
                    <TaskSection
                      title="Completed"
                      tasks={completedTasks}
                      palette={palette}
                      onToggle={toggleTask}
                      onEdit={openEditTask}
                      onDelete={confirmDelete}
                      emptyText="Finished tasks will find a home here."
                    />
                  )}
                </>
              )}
              <View style={styles.bottomNote}>
                <View style={[styles.noteLine, { backgroundColor: palette.border }]} />
                <Text style={[styles.noteText, { color: palette.muted }]}>
                  ONE THING AT A TIME
                </Text>
                <View style={[styles.noteLine, { backgroundColor: palette.border }]} />
              </View>
            </ScrollView>
          </>
        ) : tab === 'calendar' ? (
          <CalendarScreen
            tasks={tasks}
            completionHistory={completionHistory}
            selectedDate={selectedCalendarDate}
            today={today}
            palette={palette}
            onDateChange={setSelectedCalendarDate}
            onToggle={toggleTask}
            onEdit={openEditTask}
            onDelete={confirmDelete}
          />
        ) : tab === 'statistics' ? (
          <StatisticsScreen
            statistics={statistics}
            hasHistory={completionHistory.length > 0}
            palette={palette}
          />
        ) : (
          <SettingsScreen
            palette={palette}
            themePreference={themePreference}
            onThemeChange={changeTheme}
            onReplayOnboarding={replayOnboarding}
            onExportBackup={() => void exportBackup()}
            onRestoreBackup={() => void pickBackupToRestore()}
          />
        )}

        <View style={[styles.bottomTabs, { borderTopColor: palette.border, backgroundColor: palette.background }]}>
          <TabButton
            label="Tasks"
            mark="□"
            selected={tab === 'tasks'}
            palette={palette}
            onPress={() => setTab('tasks')}
          />
          <TabButton
            label="Calendar"
            mark="▦"
            selected={tab === 'calendar'}
            palette={palette}
            onPress={() => setTab('calendar')}
          />
          <TabButton
            label="Stats"
            mark="↗"
            selected={tab === 'statistics'}
            palette={palette}
            onPress={() => setTab('statistics')}
          />
          <TabButton
            label="Settings"
            mark="···"
            selected={tab === 'settings'}
            palette={palette}
            onPress={() => setTab('settings')}
          />
        </View>
      </View>

      <TaskEditor
        visible={modalVisible}
        editing={editingId !== null}
        title={titleDraft}
        description={descriptionDraft}
        selectedDate={selectedDate}
        customDate={customDateDraft}
        priority={priorityDraft}
        recurrence={recurrenceDraft}
        palette={palette}
        onChangeTitle={setTitleDraft}
        onChangeDescription={setDescriptionDraft}
        onSelectDate={value => {
          setSelectedDate(value);
          setCustomDateDraft('');
        }}
        onChangeCustomDate={value => {
          setCustomDateDraft(value);
          setSelectedDate(null);
        }}
        onSelectPriority={setPriorityDraft}
        onSelectRecurrence={setRecurrenceDraft}
        onSave={saveTask}
        onClose={() => setModalVisible(false)}
      />
    </SafeAreaView>
  );
}

function FilterChip({
  label,
  selected,
  palette,
  onPress,
}: {
  label: string;
  selected: boolean;
  palette: Palette;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.filterChip,
        {
          backgroundColor: selected ? palette.strong : palette.surface,
          borderColor: selected ? palette.strong : palette.border,
        },
      ]}
    >
      <Text
        style={[
          styles.filterChipText,
          { color: selected ? palette.strongText : palette.secondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function TaskSection({
  title,
  tasks,
  palette,
  onToggle,
  onEdit,
  onDelete,
  emptyText,
}: {
  title: string;
  tasks: Task[];
  palette: Palette;
  onToggle: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  emptyText: string;
}) {
  return (
    <View style={styles.taskSection}>
      <SectionTitle title={title} count={tasks.length} palette={palette} />
      {tasks.length ? (
        tasks.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            palette={palette}
            onToggle={() => onToggle(task.id)}
            onEdit={() => onEdit(task)}
            onDelete={() => onDelete(task)}
          />
        ))
      ) : (
        <Text style={[styles.sectionEmpty, { color: palette.muted }]}>{emptyText}</Text>
      )}
    </View>
  );
}

function CalendarScreen({
  tasks,
  completionHistory,
  selectedDate,
  today,
  palette,
  onDateChange,
  onToggle,
  onEdit,
  onDelete,
}: {
  tasks: Task[];
  completionHistory: CompletionEvent[];
  selectedDate: string;
  today: string;
  palette: Palette;
  onDateChange: (value: string) => void;
  onToggle: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const selected = parseDate(selectedDate) ?? new Date();
  const mondayOffset = (selected.getDay() + 6) % 7;
  const weekStart = parseDate(addDays(selectedDate, -mondayOffset)) ?? selected;
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + index);
    return day;
  });
  const events = completionHistory.filter(
    event => event.occurrenceDate === selectedDate,
  );
  const eventTaskIds = new Set(events.map(event => event.taskId));
  const datedTasks = tasks.filter(
    task =>
      task.dueDate === selectedDate &&
      !(task.completed && eventTaskIds.has(task.id)),
  );

  return (
    <>
      <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
        <Text style={[styles.wordmark, { color: palette.text }]}>{APP_NAME}</Text>
        <Text style={[styles.topBarLabel, { color: palette.secondary }]}>AGENDA</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.calendarContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.dateText, { color: palette.secondary }]}>
          PLAN AHEAD
        </Text>
        <Text style={[styles.pageTitle, { color: palette.text }]}>Calendar</Text>
        <Text style={[styles.pageSubtitle, { color: palette.secondary }]}>
          A simple agenda of dated tasks and completed occurrences.
        </Text>

        <View style={styles.calendarControls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous week"
            onPress={() => onDateChange(addDays(selectedDate, -7))}
            style={[styles.calendarArrow, { borderColor: palette.border }]}
          >
            <Text style={[styles.calendarArrowText, { color: palette.text }]}>‹</Text>
          </Pressable>
          <Text style={[styles.calendarMonth, { color: palette.text }]}>
            {selected.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next week"
            onPress={() => onDateChange(addDays(selectedDate, 7))}
            style={[styles.calendarArrow, { borderColor: palette.border }]}
          >
            <Text style={[styles.calendarArrowText, { color: palette.text }]}>›</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go to today"
            onPress={() => onDateChange(today)}
            style={[styles.todayButton, { borderColor: palette.border }]}
          >
            <Text style={[styles.todayButtonText, { color: palette.secondary }]}>
              Today
            </Text>
          </Pressable>
        </View>

        <View style={styles.calendarWeek}>
          {week.map(day => {
            const value = formatDate(day);
            const isSelected = value === selectedDate;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={day.toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
                accessibilityState={{ selected: isSelected }}
                onPress={() => onDateChange(value)}
                style={[
                  styles.calendarDay,
                  {
                    backgroundColor: isSelected ? palette.strong : palette.surface,
                    borderColor: isSelected ? palette.strong : palette.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.calendarDayLabel,
                    { color: isSelected ? palette.strongText : palette.secondary },
                  ]}
                >
                  {day.toLocaleDateString(undefined, { weekday: 'short' })}
                </Text>
                <Text
                  style={[
                    styles.calendarDayNumber,
                    { color: isSelected ? palette.strongText : palette.text },
                  ]}
                >
                  {day.getDate()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.agendaHeading}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            {selectedDate === today ? 'Today’s agenda' : dateLabel(selectedDate, today)}
          </Text>
          <Text style={[styles.sectionCount, { color: palette.muted }]}>
            {`${datedTasks.length + events.length}`.padStart(2, '0')}
          </Text>
        </View>

        {!datedTasks.length && !events.length ? (
          <View style={[styles.agendaEmpty, { borderColor: palette.border }]}>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>
              Nothing planned
            </Text>
            <Text style={[styles.emptyBody, { color: palette.secondary }]}>
              Tasks with this due date will appear here, including completed occurrences.
            </Text>
          </View>
        ) : (
          <>
            {events.map(event => {
              const completedTime = new Date(event.completedAt).toLocaleTimeString(
                undefined,
                { hour: 'numeric', minute: '2-digit' },
              );
              return (
                <View
                  key={event.id}
                  style={[styles.agendaEvent, { borderBottomColor: palette.border }]}
                >
                  <View
                    style={[
                      styles.agendaCheck,
                      { borderColor: palette.strong, backgroundColor: palette.strong },
                    ]}
                  >
                    <Text style={[styles.checkmark, { color: palette.strongText }]}>
                      ✓
                    </Text>
                  </View>
                  <View style={styles.taskContent}>
                    <Text
                      style={[
                        styles.taskTitle,
                        {
                          color: palette.completed,
                          textDecorationLine: 'line-through',
                        },
                      ]}
                    >
                      {event.title}
                    </Text>
                    <Text style={[styles.taskMetaText, { color: palette.secondary }]}>
                      Completed · {completedTime}
                    </Text>
                  </View>
                </View>
              );
            })}
            {datedTasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                palette={palette}
                onToggle={() => onToggle(task.id)}
                onEdit={() => onEdit(task)}
                onDelete={() => onDelete(task)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </>
  );
}

function StatisticsScreen({
  statistics,
  hasHistory,
  palette,
}: {
  statistics: ProductivityStatistics;
  hasHistory: boolean;
  palette: Palette;
}) {
  return (
    <>
      <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
        <Text style={[styles.wordmark, { color: palette.text }]}>{APP_NAME}</Text>
        <Text style={[styles.topBarLabel, { color: palette.secondary }]}>REFLECT</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.statisticsContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.dateText, { color: palette.secondary }]}>
          YOUR PROGRESS
        </Text>
        <Text style={[styles.pageTitle, { color: palette.text }]}>Statistics</Text>
        <Text style={[styles.pageSubtitle, { color: palette.secondary }]}>
          A small, honest look at the work you have finished.
        </Text>

        {!hasHistory && (
          <View style={[styles.statisticsEmpty, { borderColor: palette.border }]}>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>
              Your history starts with a completion
            </Text>
            <Text style={[styles.emptyBody, { color: palette.secondary }]}>
              Still does not estimate completions made before this history was introduced.
            </Text>
          </View>
        )}

        <View style={styles.statisticsGrid}>
          <StatisticCard label="TODAY" value={statistics.completedToday} palette={palette} />
          <StatisticCard
            label="LAST 7 DAYS"
            value={statistics.completedLastSevenDays}
            palette={palette}
          />
          <StatisticCard label="TOTAL COMPLETED" value={statistics.totalCompleted} palette={palette} />
          <StatisticCard
            label="CURRENT STREAK"
            value={statistics.currentStreak === null ? '—' : `${statistics.currentStreak}d`}
            palette={palette}
          />
        </View>

        <View
          style={[
            styles.rateCard,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.progressLabel, { color: palette.secondary }]}>
            COMPLETION RATE
          </Text>
          <Text style={[styles.rateValue, { color: palette.text }]}>
            {statistics.completionRate === null
              ? '—'
              : `${Math.round(statistics.completionRate * 100)}%`}
          </Text>
          <Text style={[styles.settingDescription, { color: palette.secondary }]}>
            Recorded completed occurrences ÷ completed occurrences plus currently due or
            overdue incomplete tasks. Undated tasks are not in this calculation.
          </Text>
          <Text style={[styles.statisticsFootnote, { color: palette.muted }]}>
            A streak day has at least one recorded completion. Today or yesterday may be
            the latest active day; earlier completions are not inferred.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

function StatisticCard({
  label,
  value,
  palette,
}: {
  label: string;
  value: number | string;
  palette: Palette;
}) {
  return (
    <View
      style={[
        styles.statisticCard,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.statisticLabel, { color: palette.secondary }]}>{label}</Text>
      <Text style={[styles.statisticValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

function TabButton({
  label,
  mark,
  selected,
  palette,
  onPress,
}: {
  label: string;
  mark: string;
  selected: boolean;
  palette: Palette;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={styles.tabButton}
    >
      <Text
        style={[
          styles.tabMark,
          { color: selected ? palette.text : palette.muted },
        ]}
      >
        {mark}
      </Text>
      <Text
        style={[
          styles.tabLabel,
          { color: selected ? palette.text : palette.muted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SettingsScreen({
  palette,
  themePreference,
  onThemeChange,
  onReplayOnboarding,
  onExportBackup,
  onRestoreBackup,
}: {
  palette: Palette;
  themePreference: ThemePreference;
  onThemeChange: (value: ThemePreference) => void;
  onReplayOnboarding: () => void;
  onExportBackup: () => void;
  onRestoreBackup: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.settingsContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.dateText, { color: palette.secondary }]}>MAKE IT YOURS</Text>
      <Text style={[styles.pageTitle, { color: palette.text }]}>Settings</Text>
      <Text style={[styles.pageSubtitle, { color: palette.secondary }]}>
        A few quiet choices for your space.
      </Text>

      <Text style={[styles.settingsSectionLabel, { color: palette.secondary }]}>
        APPEARANCE
      </Text>
      <View style={[styles.settingsGroup, { borderColor: palette.border }]}>
        <Text style={[styles.settingTitle, { color: palette.text }]}>Theme</Text>
        <Text style={[styles.settingDescription, { color: palette.secondary }]}>
          Choose a look or follow your device.
        </Text>
        <View style={styles.themeOptions}>
          {(['light', 'dark', 'system'] as const).map(option => (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked: themePreference === option }}
              onPress={() => void onThemeChange(option)}
              style={[
                styles.themeOption,
                {
                  backgroundColor:
                    themePreference === option ? palette.strong : palette.surface,
                  borderColor:
                    themePreference === option ? palette.strong : palette.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.themeOptionText,
                  {
                    color:
                      themePreference === option ? palette.strongText : palette.secondary,
                  },
                ]}
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text style={[styles.settingsSectionLabel, { color: palette.secondary }]}>
        YOUR DATA
      </Text>
      <View style={styles.backupActions}>
        <Pressable
          accessibilityRole="button"
          onPress={onExportBackup}
          style={[styles.settingsAction, { borderColor: palette.border }]}
        >
          <View>
            <Text style={[styles.settingTitle, { color: palette.text }]}>
              Export backup
            </Text>
            <Text style={[styles.settingDescription, { color: palette.secondary }]}>
              Prepare a versioned JSON file to save or share locally.
            </Text>
          </View>
          <Text style={[styles.actionArrow, { color: palette.secondary }]}>↓</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onRestoreBackup}
          style={[styles.settingsAction, { borderColor: palette.border }]}
        >
          <View>
            <Text style={[styles.settingTitle, { color: palette.text }]}>
              Restore backup
            </Text>
            <Text style={[styles.settingDescription, { color: palette.secondary }]}>
              Select a Still JSON backup to merge or replace.
            </Text>
          </View>
          <Text style={[styles.actionArrow, { color: palette.secondary }]}>↑</Text>
        </Pressable>
      </View>

      <Text style={[styles.settingsSectionLabel, { color: palette.secondary }]}>
        ABOUT
      </Text>
      <View style={[styles.settingsGroup, { borderColor: palette.border }]}>
        <Text style={[styles.settingTitle, { color: palette.text }]}>
          A note from Erhan
        </Text>
        <Text style={[styles.aboutText, { color: palette.secondary }]}>
          I made Still as my first mobile app. The goal is simple: make everyday
          task management feel a little easier.
        </Text>
        <View style={[styles.settingsDivider, { backgroundColor: palette.border }]} />
        <Text style={[styles.appVersion, { color: palette.muted }]}>
          {APP_NAME.toUpperCase()} · MADE FOR EVERYDAY
        </Text>
      </View>

      <Text style={[styles.settingsSectionLabel, { color: palette.secondary }]}>
        GETTING STARTED
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onReplayOnboarding}
        style={[styles.settingsAction, { borderColor: palette.border }]}
      >
        <View>
          <Text style={[styles.settingTitle, { color: palette.text }]}>
            Replay the introduction
          </Text>
          <Text style={[styles.settingDescription, { color: palette.secondary }]}>
            Take another look at how Still works.
          </Text>
        </View>
        <Text style={[styles.actionArrow, { color: palette.secondary }]}>→</Text>
      </Pressable>
    </ScrollView>
  );
}

function TaskEditor({
  visible,
  editing,
  title,
  description,
  selectedDate,
  customDate,
  priority,
  recurrence,
  palette,
  onChangeTitle,
  onChangeDescription,
  onSelectDate,
  onChangeCustomDate,
  onSelectPriority,
  onSelectRecurrence,
  onSave,
  onClose,
}: {
  visible: boolean;
  editing: boolean;
  title: string;
  description: string;
  selectedDate: string | null;
  customDate: string;
  priority: Priority;
  recurrence: RecurrenceRule | null;
  palette: Palette;
  onChangeTitle: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onSelectDate: (value: string | null) => void;
  onChangeCustomDate: (value: string) => void;
  onSelectPriority: (value: Priority) => void;
  onSelectRecurrence: (value: RecurrenceRule | null) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const today = formatDate(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowValue = formatDate(tomorrow);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={[styles.modalBackdrop, { backgroundColor: palette.scrim }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.modalCard, { backgroundColor: palette.background }]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.editorContent}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: palette.text }]}>
                  {editing ? 'Edit task' : 'A new task'}
                </Text>
                <Text style={[styles.modalSubtitle, { color: palette.secondary }]}>
                  Small steps count.
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close task editor"
                hitSlop={10}
              >
                <Text style={[styles.closeGlyph, { color: palette.secondary }]}>×</Text>
              </Pressable>
            </View>

            <Text style={[styles.fieldLabel, { color: palette.secondary }]}>TITLE</Text>
            <TextInput
              value={title}
              onChangeText={onChangeTitle}
              placeholder="What needs doing?"
              placeholderTextColor={palette.muted}
              style={[
                styles.titleInput,
                { borderColor: palette.border, color: palette.text },
              ]}
              autoFocus
              maxLength={160}
              returnKeyType="next"
              accessibilityLabel="Task title"
            />

            <Text style={[styles.fieldLabel, { color: palette.secondary }]}>
              NOTES · OPTIONAL
            </Text>
            <TextInput
              value={description}
              onChangeText={onChangeDescription}
              placeholder="Add a little more detail"
              placeholderTextColor={palette.muted}
              style={[
                styles.descriptionInput,
                { borderColor: palette.border, color: palette.text },
              ]}
              multiline
              maxLength={500}
              textAlignVertical="top"
              accessibilityLabel="Task notes"
            />

            <Text style={[styles.fieldLabel, { color: palette.secondary }]}>
              DUE DATE
            </Text>
            <View style={styles.choiceRow}>
              {(
                [
                  [null, 'No date'],
                  [today, 'Today'],
                  [tomorrowValue, 'Tomorrow'],
                ] as const
              ).map(([value, label]) => (
                <FilterChip
                  key={label}
                  label={label}
                  selected={!customDate && selectedDate === value}
                  palette={palette}
                  onPress={() => onSelectDate(value)}
                />
              ))}
            </View>
            <TextInput
              value={customDate}
              onChangeText={onChangeCustomDate}
              placeholder="Or enter a date: YYYY-MM-DD"
              placeholderTextColor={palette.muted}
              style={[
                styles.dateInput,
                { borderColor: palette.border, color: palette.text },
              ]}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              accessibilityLabel="Custom due date in year month day format"
            />

            <Text style={[styles.fieldLabel, { color: palette.secondary }]}>
              PRIORITY
            </Text>
            <View style={styles.choiceRow}>
              {(['low', 'medium', 'high'] as const).map(value => (
                <FilterChip
                  key={value}
                  label={value.charAt(0).toUpperCase() + value.slice(1)}
                  selected={priority === value}
                  palette={palette}
                  onPress={() => onSelectPriority(value)}
                />
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: palette.secondary }]}>
              REPEAT
            </Text>
            <View style={styles.choiceRow}>
              <FilterChip
                label="Never"
                selected={!recurrence}
                palette={palette}
                onPress={() => onSelectRecurrence(null)}
              />
              <FilterChip
                label="Daily"
                selected={recurrence?.type === 'daily'}
                palette={palette}
                onPress={() => onSelectRecurrence({ type: 'daily' })}
              />
              <FilterChip
                label="Weekly"
                selected={recurrence?.type === 'weekly'}
                palette={palette}
                onPress={() => onSelectRecurrence({ type: 'weekly' })}
              />
              <FilterChip
                label="Custom days"
                selected={recurrence?.type === 'weekdays'}
                palette={palette}
                onPress={() => {
                  if (recurrence?.type === 'weekdays') return;
                  const anchor =
                    (customDate.trim() && parseDate(customDate.trim())
                      ? customDate.trim()
                      : selectedDate) ?? today;
                  const defaultDay = parseDate(anchor)?.getDay() ?? new Date().getDay();
                  onSelectRecurrence({
                    type: 'weekdays',
                    days: [defaultDay as Weekday],
                  });
                }}
              />
            </View>
            {recurrence?.type === 'weekdays' && (
              <View style={[styles.choiceRow, styles.weekdayOptions]}>
                {weekdayLabels.map((label, day) => {
                  const selected = recurrence.days.includes(day as Weekday);
                  return (
                    <FilterChip
                      key={label}
                      label={label}
                      selected={selected}
                      palette={palette}
                      onPress={() => {
                        if (selected && recurrence.days.length === 1) return;
                        const days = selected
                          ? recurrence.days.filter(item => item !== day)
                          : [...recurrence.days, day as Weekday];
                        onSelectRecurrence({
                          type: 'weekdays',
                          days: weekdayOrder.filter(day => days.includes(day)),
                        });
                      }}
                    />
                  );
                })}
              </View>
            )}
            <Text style={[styles.recurrenceHint, { color: palette.muted }]}>
              Missed dates are skipped. Completing an overdue repeat schedules the next date
              after today.
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                style={[styles.cancelButton, { borderColor: palette.border }]}
                onPress={onClose}
              >
                <Text style={[styles.cancelText, { color: palette.secondary }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[styles.saveButton, { backgroundColor: palette.strong }]}
                onPress={onSave}
              >
                <Text style={[styles.saveText, { color: palette.strongText }]}>
                  {editing ? 'Save changes' : 'Add task'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = {
  safeArea: { flex: 1 },
  appScreen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wordmark: { fontSize: 25, fontWeight: '700', letterSpacing: -1.3 },
  loadingCaption: { marginTop: 8, fontSize: 13 },
  onboardingScreen: { flex: 1, paddingHorizontal: 26 },
  onboardingTop: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipText: { fontSize: 14, paddingVertical: 10, paddingLeft: 10 },
  illustration: {
    flex: 1,
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  illustrationOrbit: {
    width: 174,
    height: 174,
    borderRadius: 87,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustrationCore: {
    width: 76,
    height: 76,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustrationMark: { fontSize: 35, fontWeight: '600', letterSpacing: -2 },
  illustrationDot: {
    position: 'absolute',
    right: 14,
    top: 26,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  illustrationCard: {
    position: 'absolute',
    width: '74%',
    maxWidth: 275,
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderRadius: 13,
    bottom: 5,
  },
  illustrationRow: { flexDirection: 'row', alignItems: 'center', height: 28, gap: 10 },
  illustrationCheck: {
    width: 13,
    height: 13,
    borderWidth: 1,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustrationTick: { fontSize: 9, lineHeight: 11, fontWeight: '700' },
  illustrationLine: { height: 4, borderRadius: 2 },
  illustrationPriority: { width: 18, height: 5, borderRadius: 3, marginLeft: 'auto' },
  onboardingCopy: { paddingTop: 16, paddingBottom: 20 },
  eyebrow: { fontSize: 10, letterSpacing: 1.8, fontWeight: '600', marginBottom: 15 },
  onboardingTitle: { fontSize: 43, lineHeight: 48, letterSpacing: -2, fontWeight: '600' },
  onboardingBody: { fontSize: 15, lineHeight: 23, marginTop: 15, maxWidth: 330 },
  onboardingFooter: { paddingTop: 10, paddingBottom: 16 },
  progressDots: { flexDirection: 'row', gap: 7, marginBottom: 20 },
  progressDot: { height: 6, borderRadius: 3 },
  primaryButton: {
    height: 56,
    borderRadius: 10,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  primaryButtonText: { fontSize: 15, fontWeight: '600' },
  buttonArrow: { fontSize: 21 },
  onboardingFootnote: {
    textAlign: 'center',
    marginTop: 19,
    fontSize: 9,
    letterSpacing: 1.6,
  },
  topBar: {
    minHeight: 60,
    paddingHorizontal: 23,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarLabel: { fontSize: 9, letterSpacing: 1.7, fontWeight: '600' },
  scrollContent: { paddingHorizontal: 23, paddingTop: 28, paddingBottom: 35 },
  calendarContent: { paddingHorizontal: 23, paddingTop: 28, paddingBottom: 35 },
  statisticsContent: { paddingHorizontal: 23, paddingTop: 28, paddingBottom: 35 },
  dateText: { fontSize: 9, letterSpacing: 1.7, fontWeight: '600' },
  pageTitle: { fontSize: 37, lineHeight: 43, letterSpacing: -1.7, fontWeight: '600', marginTop: 9 },
  pageSubtitle: { fontSize: 14, marginTop: 6, marginBottom: 21, lineHeight: 20 },
  progressCard: { paddingHorizontal: 15, paddingVertical: 14, borderRadius: 10, marginBottom: 13 },
  progressCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 },
  progressLabel: { fontSize: 9, letterSpacing: 1.5, fontWeight: '600' },
  progressValue: { fontSize: 12, fontWeight: '600' },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  widgetPreview: { borderWidth: 1, borderRadius: 10, padding: 13, marginBottom: 12 },
  widgetPreviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  widgetPreviewEyebrow: { fontSize: 8, letterSpacing: 1.2, fontWeight: '600' },
  widgetPreviewTitle: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  widgetPreviewCount: { fontSize: 22, fontWeight: '600' },
  widgetPreviewTask: { fontSize: 11, lineHeight: 19 },
  widgetPreviewNote: { fontSize: 9, marginTop: 5 },
  addButton: {
    height: 50,
    borderWidth: 1,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  addGlyph: { fontSize: 21, lineHeight: 24, marginRight: 10, fontWeight: '300' },
  addLabel: { fontSize: 13 },
  searchBox: {
    height: 45,
    borderWidth: 1,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchGlyph: { fontSize: 21, marginRight: 8, transform: [{ rotate: '-20deg' }] },
  searchInput: { flex: 1, height: '100%', fontSize: 13, paddingVertical: 0 },
  clearSearch: { fontSize: 21, paddingHorizontal: 3 },
  filterRow: { alignItems: 'center', gap: 7, paddingBottom: 10 },
  filterChip: {
    minHeight: 30,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: { fontSize: 11, fontWeight: '500' },
  filterDivider: { height: 18, width: 1, marginHorizontal: 2 },
  taskSection: { marginTop: 17 },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
  sectionCount: { fontSize: 10, letterSpacing: 1 },
  sectionEmpty: { fontSize: 12, paddingVertical: 13 },
  taskRow: {
    minHeight: 69,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 11,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkmark: { fontSize: 12, fontWeight: '700', lineHeight: 15 },
  taskContent: { flex: 1, paddingVertical: 2 },
  taskTitle: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  taskDescription: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  taskMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  taskMetaText: { fontSize: 10, textTransform: 'capitalize' },
  metaDot: { width: 3, height: 3, borderRadius: 2 },
  deleteButton: { minWidth: 30, minHeight: 40, alignItems: 'flex-end', justifyContent: 'center', paddingLeft: 10 },
  deleteGlyph: { fontSize: 22, lineHeight: 26, fontWeight: '300' },
  emptyState: { alignItems: 'center', paddingTop: 45, paddingBottom: 40, paddingHorizontal: 20 },
  emptyMark: {
    width: 47,
    height: 47,
    borderWidth: 1,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  emptyMarkText: { fontSize: 24 },
  emptyTitle: { fontSize: 15, fontWeight: '600' },
  emptyBody: { fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  emptyAction: { paddingVertical: 12, paddingHorizontal: 8, marginTop: 4 },
  emptyActionText: { fontSize: 12, fontWeight: '600' },
  bottomNote: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 37 },
  noteLine: { height: StyleSheet.hairlineWidth, flex: 1 },
  noteText: { fontSize: 8, letterSpacing: 1.4 },
  bottomTabs: {
    height: 58,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  tabButton: { flex: 1, height: '100%', justifyContent: 'center', alignItems: 'center', gap: 3 },
  tabMark: { fontSize: 17, lineHeight: 19, fontWeight: '500' },
  tabLabel: { fontSize: 10, fontWeight: '500' },
  calendarControls: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 13 },
  calendarArrow: { width: 34, height: 34, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  calendarArrowText: { fontSize: 23, lineHeight: 27 },
  calendarMonth: { flex: 1, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  todayButton: { minHeight: 34, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  todayButtonText: { fontSize: 11, fontWeight: '500' },
  calendarWeek: { flexDirection: 'row', gap: 5, marginBottom: 23 },
  calendarDay: { flex: 1, minHeight: 61, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 5 },
  calendarDayLabel: { fontSize: 9 },
  calendarDayNumber: { fontSize: 13, fontWeight: '600' },
  agendaHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 },
  agendaEmpty: { borderWidth: 1, borderRadius: 10, padding: 18, alignItems: 'center' },
  agendaEvent: { minHeight: 60, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  agendaCheck: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.4, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  statisticsEmpty: { borderWidth: 1, borderRadius: 10, padding: 16, marginBottom: 13 },
  statisticsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  statisticCard: { width: '48%', minHeight: 94, borderWidth: 1, borderRadius: 10, padding: 13, justifyContent: 'space-between', flexGrow: 1 },
  statisticLabel: { fontSize: 8, letterSpacing: 1, fontWeight: '600' },
  statisticValue: { fontSize: 25, fontWeight: '600', letterSpacing: -0.6 },
  rateCard: { borderWidth: 1, borderRadius: 10, padding: 15, marginTop: 11 },
  rateValue: { fontSize: 29, fontWeight: '600', marginTop: 6, marginBottom: 2 },
  statisticsFootnote: { fontSize: 10, lineHeight: 15, marginTop: 13 },
  settingsContent: { paddingHorizontal: 23, paddingTop: 34, paddingBottom: 35 },
  settingsSectionLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 1.6, marginTop: 27, marginBottom: 10 },
  settingsGroup: { borderWidth: 1, borderRadius: 10, padding: 15 },
  settingTitle: { fontSize: 14, fontWeight: '600' },
  settingDescription: { fontSize: 12, marginTop: 5, lineHeight: 18 },
  themeOptions: { flexDirection: 'row', gap: 7, marginTop: 14 },
  themeOption: { flex: 1, minHeight: 35, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  themeOptionText: { fontSize: 11, fontWeight: '500' },
  aboutText: { fontSize: 13, lineHeight: 21, marginTop: 10 },
  settingsDivider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  appVersion: { fontSize: 9, letterSpacing: 1.2 },
  settingsAction: {
    minHeight: 68,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backupActions: { gap: 8 },
  actionArrow: { fontSize: 19, marginLeft: 10 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', maxWidth: 480, maxHeight: '90%', alignSelf: 'center', borderRadius: 16, overflow: 'hidden' },
  editorContent: { padding: 21, paddingBottom: 23 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalTitle: { fontSize: 23, fontWeight: '600', letterSpacing: -0.7 },
  modalSubtitle: { fontSize: 12, marginTop: 5 },
  closeGlyph: { fontSize: 25, lineHeight: 27, paddingLeft: 12 },
  fieldLabel: { fontSize: 9, letterSpacing: 1.4, fontWeight: '600', marginBottom: 8, marginTop: 15 },
  titleInput: { minHeight: 47, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 14 },
  descriptionInput: { minHeight: 67, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingTop: 11, fontSize: 13 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  weekdayOptions: { marginTop: 8 },
  recurrenceHint: { fontSize: 10, lineHeight: 15, marginTop: 8 },
  dateInput: { minHeight: 43, borderWidth: 1, borderRadius: 8, paddingHorizontal: 11, fontSize: 12, marginTop: 9 },
  modalActions: { flexDirection: 'row', gap: 9, marginTop: 23 },
  cancelButton: { flex: 1, minHeight: 47, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 13, fontWeight: '500' },
  saveButton: { flex: 1, minHeight: 47, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 13, fontWeight: '600' },
} as const;
