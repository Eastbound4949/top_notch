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
  speed?: number; // bytes per second
}

export interface OverlayConfig {
  enabled: boolean;
  showAroundCamera: boolean;
  showInStatusBar: boolean;
  showInNotificationDrawer: boolean;
  accentColor: string;
  ringThickness: number;
}

export interface DownloadProgress {
  jobId: string;
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  speed: number;
  status: DownloadStatus;
}
