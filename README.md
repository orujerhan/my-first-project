# Still

*A calmer way to keep track of what matters.*

Still is a minimalist task manager with a calm visual style, a cloud mascot, and
gentle motivation for making progress. It is an early-stage Expo React Native
app, being developed as a public project for learning, customization, and
community contributions.

## Preview

> **Screenshot placeholder:** Real Still screenshots are not currently
> available in this repository. Replace this note with genuine app screenshots
> when they are ready.

## Features

- Create, edit, complete, reopen, search, filter, and delete tasks.
- Add task descriptions, due dates, and low, medium, or high priority.
- Set tasks to repeat daily, weekly, or on selected weekdays.
- Browse task dates and completion history, and review completion counts,
  rates, and streaks.
- Earn Still Points (SP) and experience points (XP) for task completion,
  progress through five levels, and unlock and choose app themes.
- Choose light, dark, or system appearance.
- Export and restore a versioned JSON backup.
- Preview a compact task widget inside the app. This is a preview only, not an
  iOS or Android home-screen widget.

Tasks and progress are stored locally on the device. Still does not currently
provide account-based sync or a cloud backend.

## Technology

- Expo SDK 57 and Expo Router
- React Native 0.86 and React 19
- TypeScript 6
- AsyncStorage for local persistence
- Expo file-system, document-picker, and sharing modules for backup workflows

## Prerequisites

- Node.js and npm
- An Expo-compatible development device or simulator for mobile, or a web
  browser for web development

The repository does not specify a minimum Node.js version. These instructions
run the development app; they are not instructions for installing a public App
Store release.

## Run locally

From the repository root:

```sh
cd MyFirstApp
npm install
npm run start
```

Follow the Expo CLI prompts to open the development app on a supported target.
The package also provides these platform-specific development commands:

```sh
npm run web
npm run android
npm run ios
```

The Android and iOS commands require the corresponding development target to be
available on your machine.

## Project structure

```text
MyFirstApp/
├── assets/                 App icons, mascot, and other image assets
├── scripts/                Project utility scripts
├── src/
│   ├── app/                 Expo Router entry and routes
│   ├── components/          Still app UI and reusable components
│   ├── constants/           App and appearance constants
│   ├── hooks/               React hooks
│   ├── lib/                 Task, statistics, backup, and motivation logic
│   └── types/               TypeScript task and backup types
├── app.json                 Expo app configuration
├── package.json             Dependencies and available scripts
└── tsconfig.json            TypeScript configuration
```

## Status and limitations

Still is a work in progress and is not published in an app store. It is not
presented as ready for ordinary iPhone installation; use the local development
setup above to explore the project. The widget shown in the app is only a
preview. Task data is local rather than synced to a cloud service, and no
automated test runner is configured in `package.json`.

The repository currently has no project-wide license for Still. The MIT license
in `MyFirstApp/LICENSE` applies to Expo and does not automatically apply to
Still's original code or assets.

## Contributions

Still is being built for learning and customization, and community ideas and
contributions are welcome. Feel free to open an issue or propose a pull request
with improvements, fixes, or thoughtful customizations. Please note that the
repository-level license for Still is still to be decided.

## Credits

Created by Erhan.
