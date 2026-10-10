# Still

A small, local-first to-do app by Erhan. Still is his first mobile app, built to
make everyday task management feel simple.

## Run with Expo Go

From this directory, install dependencies and start Expo:

```bash
npm install
npx expo start
```

Open Expo Go on your iPhone and scan the QR code shown in the terminal. Keep
your iPhone and computer on the same Wi-Fi network.

If the devices cannot connect over the local network, start the tunnel instead:

```bash
npx expo start --tunnel
```

## Features

- Create, edit, complete, reopen, search, filter, and delete tasks.
- Add an optional note, due date, and low, medium, or high priority.
- Keep tasks, onboarding completion, and appearance preferences on the device.
- Choose light, dark, or system appearance and replay the introduction in Settings.

Task data is stored locally with AsyncStorage; Still does not require an account
or a network connection.
