import AsyncStorage from '@react-native-async-storage/async-storage';
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
  Task,
  TaskStatusFilter,
  ThemePreference,
} from '@/types/task';

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

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function dateLabel(value: string) {
  const date = parseDate(value);
  if (!date) return value;
  const today = formatDate(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  if (value === today) return 'Today';
  if (value === formatDate(tomorrowDate)) return 'Tomorrow';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

function isPriority(value: unknown): value is Priority {
  return value === 'low' || value === 'medium' || value === 'high';
}

function readTasks(value: string | null): Task[] {
  if (!value) return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error('Saved task data is not a list.');
  }

  const validTasks = parsed.filter((item): item is Task => {
    if (!item || typeof item !== 'object') return false;
    const candidate = item as Record<string, unknown>;
    return (
      typeof candidate.id === 'string' &&
      typeof candidate.title === 'string' &&
      typeof candidate.description === 'string' &&
      (candidate.dueDate === null ||
        (typeof candidate.dueDate === 'string' &&
          parseDate(candidate.dueDate) !== null)) &&
      isPriority(candidate.priority) &&
      typeof candidate.completed === 'boolean' &&
      typeof candidate.createdAt === 'string'
    );
  });

  if (validTasks.length !== parsed.length) {
    Alert.alert(
      'Some tasks could not be restored',
      'A few saved entries were incomplete or invalid and were left out.',
    );
  }
  return validTasks;
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
            {task.dueDate ? dateLabel(task.dueDate) : 'No date'}
          </Text>
          <View style={[styles.metaDot, { backgroundColor: palette.muted }]} />
          <Text style={[styles.taskMetaText, { color: priorityColor }]}>
            {task.priority}
          </Text>
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');
  const [tab, setTab] = useState<'tasks' | 'settings'>('tasks');
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(formatDate(new Date()));
  const [customDateDraft, setCustomDateDraft] = useState('');
  const [priorityDraft, setPriorityDraft] = useState<Priority>('medium');
  const tasksDirty = useRef(false);

  const colorScheme = useColorScheme();
  const effectiveTheme =
    themePreference === 'system' ? (colorScheme === 'dark' ? 'dark' : 'light') : themePreference;
  const palette = palettes[effectiveTheme];
  const today = formatDate(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowValue = formatDate(tomorrow);

  useEffect(() => {
    async function loadSavedData() {
      try {
        const savedValues = await AsyncStorage.multiGet([
          TASKS_STORAGE_KEY,
          ONBOARDING_STORAGE_KEY,
          THEME_STORAGE_KEY,
        ]);
        const saved = new Map(savedValues);
        setTasks(readTasks(saved.get(TASKS_STORAGE_KEY) ?? null));
        setOnboarded(saved.get(ONBOARDING_STORAGE_KEY) === 'yes');
        const savedTheme = saved.get(THEME_STORAGE_KEY);
        if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
          setThemePreference(savedTheme);
        }
      } catch (error) {
        console.error('Still could not load saved data.', error);
        Alert.alert(
          'Could not load saved data',
          'Still will open with an empty task list. Your existing saved data has not been intentionally cleared.',
        );
      } finally {
        setReady(true);
      }
    }
    void loadSavedData();
  }, []);

  useEffect(() => {
    if (!ready || !tasksDirty.current) return;
    tasksDirty.current = false;
    void AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks)).catch(error =>
      showStorageError('save your tasks', error),
    );
  }, [ready, tasks]);

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

  function openNewTask() {
    setEditingId(null);
    setTitleDraft('');
    setDescriptionDraft('');
    setSelectedDate(today);
    setCustomDateDraft('');
    setPriorityDraft('medium');
    setModalVisible(true);
  }

  function openEditTask(task: Task) {
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
    setModalVisible(true);
  }

  function saveTask() {
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
            ? { ...task, title: cleanTitle, description, dueDate, priority: priorityDraft }
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
      };
      setTasks(current => [newTask, ...current]);
    }
    tasksDirty.current = true;
    setModalVisible(false);
  }

  function toggleTask(id: string) {
    setTasks(current =>
      current.map(task =>
        task.id === id ? { ...task, completed: !task.completed } : task,
      ),
    );
    tasksDirty.current = true;
  }

  function confirmDelete(task: Task) {
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

  const activeCount = tasks.filter(task => !task.completed).length;
  const completedCount = tasks.length - activeCount;
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
    task => !task.completed && (!task.dueDate || task.dueDate <= today),
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
        ) : (
          <SettingsScreen
            palette={palette}
            themePreference={themePreference}
            onThemeChange={changeTheme}
            onReplayOnboarding={replayOnboarding}
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
}: {
  palette: Palette;
  themePreference: ThemePreference;
  onThemeChange: (value: ThemePreference) => void;
  onReplayOnboarding: () => void;
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
  palette,
  onChangeTitle,
  onChangeDescription,
  onSelectDate,
  onChangeCustomDate,
  onSelectPriority,
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
  palette: Palette;
  onChangeTitle: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onSelectDate: (value: string | null) => void;
  onChangeCustomDate: (value: string) => void;
  onSelectPriority: (value: Priority) => void;
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
  dateText: { fontSize: 9, letterSpacing: 1.7, fontWeight: '600' },
  pageTitle: { fontSize: 37, lineHeight: 43, letterSpacing: -1.7, fontWeight: '600', marginTop: 9 },
  pageSubtitle: { fontSize: 14, marginTop: 6, marginBottom: 21, lineHeight: 20 },
  progressCard: { paddingHorizontal: 15, paddingVertical: 14, borderRadius: 10, marginBottom: 13 },
  progressCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 },
  progressLabel: { fontSize: 9, letterSpacing: 1.5, fontWeight: '600' },
  progressValue: { fontSize: 12, fontWeight: '600' },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
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
  dateInput: { minHeight: 43, borderWidth: 1, borderRadius: 8, paddingHorizontal: 11, fontSize: 12, marginTop: 9 },
  modalActions: { flexDirection: 'row', gap: 9, marginTop: 23 },
  cancelButton: { flex: 1, minHeight: 47, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 13, fontWeight: '500' },
  saveButton: { flex: 1, minHeight: 47, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 13, fontWeight: '600' },
} as const;
