# Top Notch: Progress & Actions

A React Native / Expo Android app that displays **download progress** around your phone's hole-punch camera, in the status bar, and as quick-action pills in the notification drawer.

---

## Architecture

```
top-notch/
├── app/                        # Expo Router screens
│   ├── _layout.tsx             # Root navigation layout
│   ├── index.tsx               # Home screen (download queue)
│   └── settings.tsx            # Overlay settings
├── src/
│   ├── components/
│   │   ├── CircularProgress.tsx  # Animated SVG ring (in-app)
│   │   ├── DownloadCard.tsx      # Job card with progress bar
│   │   └── AddJobSheet.tsx       # Bottom sheet to add downloads
│   ├── hooks/
│   │   └── useDownloads.ts       # React hook for job state
│   ├── services/
│   │   ├── DownloadManager.ts    # Core job orchestration
│   │   └── OverlayBridge.ts      # JS → Native module bridge
│   └── types/index.ts            # TypeScript interfaces
├── android/app/src/main/java/com/topnotch/
│   ├── MainApplication.kt        # Registers TopNotchOverlayPackage
│   └── overlay/
│       ├── TopNotchOverlayModule.kt   # React Native native module
│       ├── TopNotchOverlayPackage.kt  # Package registration
│       ├── DownloadOverlayService.kt  # Foreground service + notifications
│       └── CameraRingView.kt          # Custom View: draws the camera arc
├── plugins/
│   └── withOverlayPermission.js  # Expo config plugin (manifest permissions)
├── app.json                      # Expo config
└── eas.json                      # EAS Build config
```

---

## How the Overlay Works

```
React Native (JS)
    │
    ▼
OverlayBridge.ts  ──── NativeModules.TopNotchOverlay
    │
    ▼
TopNotchOverlayModule.kt  (React Native Native Module)
    │
    ├── showCameraRing() ──────► CameraRingView.kt
    │                            WindowManager.addView()
    │                            Draws arc around camera cutout
    │
    └── startForegroundService() ──► DownloadOverlayService.kt
                                      Foreground notification
                                      Pause / Cancel action intents
                                         │
                                         ▼
                                      actionListener callback
                                         │
                                         ▼
                                      TopNotchOverlayModule
                                      sendEvent("TopNotch_NotificationAction")
                                         │
                                         ▼
                                      OverlayBridge.onNotificationAction()
                                         │
                                         ▼
                                      app/index.tsx  (pauseJob / cancelJob)
```

---

## Setup

### Prerequisites
- Node.js 20+
- EAS CLI: `npm install -g eas-cli`
- Android Studio (for local native builds)
- Expo account (free tier)

### Install dependencies
```bash
cd top-notch
npm install
```

### Build a dev client (required — SDK 54 is incompatible with Expo Go)
```bash
eas build --platform android --profile development
```
Install the resulting `.apk` on your device.

### Run locally
```bash
npx expo start --lan --port 8081
```
Then in the installed dev client, enter:
```
http://192.168.0.203:8081
```
(Same IP as your Daily Workout Tracker setup.)

---

## Android Permissions Required

| Permission | Purpose |
|---|---|
| `SYSTEM_ALERT_WINDOW` | Draw the camera ring overlay |
| `FOREGROUND_SERVICE` | Keep service alive while downloading |
| `FOREGROUND_SERVICE_DATA_SYNC` | Required for Android 14+ data sync services |
| `POST_NOTIFICATIONS` | Show the progress notification |
| `RECEIVE_BOOT_COMPLETED` | (Future) Resume downloads after reboot |

**On first launch**, the app will prompt you to grant "Display over other apps" — this takes you to Android Settings. Without it, the camera ring won't appear, but notifications still work.

---

## Key Files to Edit

| File | When to change |
|---|---|
| `src/services/DownloadManager.ts` | Add real HTTP download logic (replace simulation) |
| `android/.../CameraRingView.kt` | Adjust ring size, glow, stroke thickness |
| `android/.../DownloadOverlayService.kt` | Change notification layout or actions |
| `app/settings.tsx` | Add more overlay configuration options |
| `plugins/withOverlayPermission.js` | Add more Android manifest entries |

---

## Replacing Simulated Downloads with Real HTTP

In `DownloadManager.ts`, replace `simulateProgress()` with real download logic using Expo's `FileSystem` or the native Android `DownloadManager` API:

```typescript
import * as FileSystem from 'expo-file-system';

const downloadResumable = FileSystem.createDownloadResumable(
  job.url,
  FileSystem.documentDirectory + job.name,
  {},
  (downloadProgress) => {
    const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
    overlayBridge.showCameraOverlay(progress, '#7c5cbf');
    overlayBridge.updateProgress({ ... });
  }
);
await downloadResumable.downloadAsync();
```

---

## Camera Ring Positioning

The ring position is set in `DownloadOverlayService.kt`:

```kotlin
val params = WindowManager.LayoutParams(
    RING_SIZE_DP.dpToPx(),   // default 52dp — adjust to match your camera size
    RING_SIZE_DP.dpToPx(),
    ...
).apply {
    gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
    y = STATUS_BAR_OFFSET_DP.dpToPx()  // default 4dp from top
}
```

You may need to adjust `RING_SIZE_DP` (default: 52dp) and `STATUS_BAR_OFFSET_DP` (default: 4dp) to perfectly center the ring on your specific device's camera cutout.

---

## EAS Build Limits

Free plan: ~30 builds/month. Resets monthly.

Use `--profile development` for dev builds (APK), `--profile production` for store builds (AAB).

---

## Troubleshooting

**Ring doesn't appear:**
→ Check "Display over other apps" permission in Settings → Apps → Top Notch → Special app access

**Notification doesn't show:**
→ Grant notification permission (Android 13+) when prompted on first launch

**Camera ring is off-center:**
→ Adjust `RING_SIZE_DP` and `STATUS_BAR_OFFSET_DP` in `DownloadOverlayService.kt` for your device

**Build fails on native module:**
→ Confirm `TopNotchOverlayPackage` is added in `MainApplication.kt` and Kotlin files are in the correct `com.topnotch.overlay` package

**Dev client tunnel times out:**
→ Use `--lan` not `--tunnel`, same as your Daily Workout Tracker setup
