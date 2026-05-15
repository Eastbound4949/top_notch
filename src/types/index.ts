// ── Activity types ─────────────────────────────────────────────────────────────

export type ActivityKind =
  | 'download'
  | 'upload'
  | 'music'
  | 'video'
  | 'cast'
  | 'sync'
  | 'call';

export type ActivityStatus =
  | 'idle'
  | 'active'
  | 'paused'
  | 'completed'
  | 'error';

export interface Activity {
  id: string;
  kind: ActivityKind;
  title: string;
  subtitle?: string;
  status: ActivityStatus;
  progress: number;        // 0–1
  durationMs?: number;
  elapsedMs?: number;
  totalBytes?: number;
  transferredBytes?: number;
  speed?: number;          // bytes/s
  accentColor?: string;
  appName?: string;
  appIcon?: string;
  createdAt: number;
  completedAt?: number;
}

// ── Legacy download types (kept for DownloadManager / DownloadCard compat) ─────

export type DownloadStatus = 'idle' | 'downloading' | 'paused' | 'completed' | 'error';

export interface DownloadJob {
  id: string;
  name: string;
  url: string;
  totalBytes: number;
  downloadedBytes: number;
  status: DownloadStatus;
  createdAt: number;
  completedAt?: number;
  errorMessage?: string;
  speed?: number;
}

// ── Overlay config ─────────────────────────────────────────────────────────────

export interface OverlayConfig {
  enabled: boolean;
  showAroundCamera: boolean;
  showInStatusBar: boolean;
  showInNotificationDrawer: boolean;
  accentColor: string;
  ringThickness: number;
  [key: string]: unknown;
}

// ── Progress event ─────────────────────────────────────────────────────────────

export interface DownloadProgress {
  jobId: string;
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  speed: number;
  status: ActivityStatus | DownloadStatus;
}
