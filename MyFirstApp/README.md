# Still

A small, local-first to-do app by Erhan. Still keeps everyday tasks simple and
stores task data on the device with AsyncStorage. It does not require an
account, backend, or network connection for task management.

## Run with Expo

From this directory:

```bash
npm install
npx expo start
```

Run the available project checks with:

```bash
npx tsc --noEmit
npm run lint
```

There is no automated test runner configured in this project. A practical
device/manual checklist is included below.

## Features

- Create, edit, complete, reopen, search, filter, and delete tasks.
- Add optional notes, due dates, and low, medium, or high priority.
- Repeat tasks daily, weekly, or on selected weekdays.
- Browse a week-at-a-time agenda, select a date, and see due and completed
  occurrences for that local date.
- Review completion activity and productivity statistics.
- Choose light, dark, or system appearance and replay the introduction.
- Preview a compact, today's-task widget layout inside the app.
- Export and restore a versioned JSON backup using the device's file picker and
  share sheet.

## Task data and recurrence

Still keeps the existing `still.tasks.v1` AsyncStorage key and can read the
earlier array of tasks. On the next task change, it writes the compatible tasks
into a version 2 store with recurrence rules and a separate completion history.
Old task fields are preserved; old completed tasks are not assigned invented
completion times. If part of a valid task list cannot be interpreted, Still
keeps those raw entries when saving the readable tasks. If the store itself
cannot be read, task editing is blocked instead of replacing it with an empty
list; restore a valid backup to resume editing.

Completing a recurring task records one event for that scheduled occurrence,
then advances its due date and leaves the next occurrence active. The
occurrence date is a local calendar date (`YYYY-MM-DD`), while the completion
time is stored as a timestamp. Reopening a one-time task changes its current
state but does not erase the fact that it was previously completed.

Missed occurrences are skipped rather than generated as a backlog. When a
recurring task is completed late, its next date is calculated after today (or
after its future due date if it was completed early). Weekly tasks retain their
weekday; custom tasks use the next selected weekday. Editing a recurrence rule
keeps existing completion history. Changing a completed one-time task into a
recurring task starts it as an active occurrence. Deleting a task removes the
task itself but leaves its recorded completion events available to statistics
and the agenda.

Date-only values are parsed and advanced using local calendar fields, not UTC
midnight timestamps. This avoids date shifts and handles daylight-saving
transitions without adding a date library.

## Statistics definitions

- **Today** and **Last 7 days** count recorded completion events by the local
  calendar date saved when they were completed; the seven-day range includes
  today. This date remains stable if the device later changes time zones.
- **Total completed** counts unique persisted completion events, including
  events from tasks that were later deleted. A recurring task occurrence is
  keyed by task ID and scheduled date to avoid double-counting it.
- **Completion rate** is recorded completed occurrences divided by those
  occurrences plus current incomplete tasks that are due today or overdue.
  Undated and future-due tasks are excluded. An em dash means there are no
  counted occurrences yet.
- A **streak day** has at least one recorded completion event. The current
  streak can start today or yesterday so it remains visible earlier in the
  current day; otherwise it is zero/not established.

No completions from before Still began recording history are inferred.

## Backup and restore

Export creates a version 1 `still-backup-<timestamp>.json` file in the app's
cache and opens the platform share sheet. The backup contains tasks, recurrence
rules, completion history, and appearance/onboarding preferences. Save the file
to a location you control from the share sheet; Still does not upload it or
keep a permanent second copy.

Restore accepts supported Still JSON backups and validates the version and
task/event fields before changing local data. Users choose **Merge** or
**Replace** after selecting a valid file. Merge adds tasks with new IDs and
completion events that are not already present; existing same-ID task fields
and current preferences take precedence. Replace requires confirmation and
offers an export of current readable data first. If the current local store is
unreadable, merge is disabled and replacement warns that the unreadable stored
value will be overwritten. Invalid files and unsupported versions are rejected.

File sharing is provided by Expo's SDK 57-compatible file-system, sharing, and
document-picker modules on native platforms. On web, export downloads a JSON
file through the browser and restore reads the selected browser file. Task
storage remains local to the running app on every platform.

## Home-screen widget preparation

The **Widget preview · In app** card on the Tasks screen is only a React Native
preview. It is not an iOS or Android home-screen widget.

The current project uses Expo SDK 57 and Continuous Native Generation (there
are no committed `ios/` or `android/` folders). A real widget is intentionally
not included:

- iOS requires a WidgetKit extension target, a shared App Group container and
  an app-to-extension data handoff. WidgetKit timeline entries also need a
  refresh policy and a deep link back into Still.
- Android requires an App Widget provider/receiver, manifest and widget
  metadata, plus a data handoff the widget process can read and a refresh
  strategy.
- Both platforms need native/config-plugin work and development/production
  builds. Expo Go alone cannot run custom home-screen widget extensions.
- AsyncStorage is app-local and cannot directly serve as a cross-process widget
  store. Any future widget work must define the shared native storage and
  refresh behavior first.

Suggested compact widget contract: show a task count and up to three incomplete
tasks due today (including undated tasks shown on the home screen), use the
system's monochrome widget styling, and open Still when tapped. Adding this
native setup requires a separate implementation decision and approval.

## Manual verification checklist

- [ ] Complete onboarding, replay it from Settings, and confirm the existing
      task, search, filter, notes, priority, appearance, edit, reopen, and delete
      flows still work.
- [ ] Create a task, restart the app, and confirm it and its due date persist.
- [ ] Try daily, weekly, and custom weekday recurrence; complete an occurrence,
      restart, and verify there is one history event and one next active date.
- [ ] Complete an overdue recurring task and verify missed dates are skipped;
      complete a future occurrence early and verify its schedule advances after
      that occurrence.
- [ ] Edit and clear due dates; navigate calendar weeks, select dates, and
      confirm completed occurrence history and overdue/upcoming states.
- [ ] Complete one-time and recurring tasks and compare Today, Last 7 Days,
      Total, rate, and streak with the definitions above. Delete a task and
      confirm its recorded history remains.
- [ ] Export a backup, restore it by merge and by confirmed replacement, then
      try malformed JSON and an unsupported version.
- [ ] Check empty task, agenda, and statistics states in light, dark, and system
      appearance.
- [ ] Use device-local dates around a daylight-saving transition and confirm
      date labels and recurrence scheduling do not shift a day.
