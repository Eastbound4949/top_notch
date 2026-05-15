import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import type { DownloadProgress, OverlayConfig } from '../types';

const { TopNotchOverlay } = NativeModules;

export interface ProgressEvent {
  jobId: string;
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  speed: number;
  status: string;
}

export interface NotificationActionEvent {
  jobId: string;
  action: 'pause' | 'cancel' | 'resume';
}

export interface GestureEvent {
  gestureType: 'single' | 'long' | 'double' | 'swipeRL' | 'swipeLR';
}

class OverlayServiceBridge {
  private emitter: NativeEventEmitter | null = null;

  constructor() {
    if (Platform.OS === 'android' && TopNotchOverlay) {
      this.emitter = new NativeEventEmitter(TopNotchOverlay);
    }
  }

  // ── Permissions ──────────────────────────────────────────────────────────────

  async hasOverlayPermission(): Promise<boolean> {
    if (Platform.OS !== 'android' || !TopNotchOverlay) return false;
    return TopNotchOverlay.hasOverlayPermission();
  }

  async requestOverlayPermission(): Promise<boolean> {
    if (Platform.OS !== 'android' || !TopNotchOverlay) return false;
    return TopNotchOverlay.requestOverlayPermission();
  }

  async hasNotificationPermission(): Promise<boolean> {
    if (Platform.OS !== 'android' || !TopNotchOverlay) return true;
    return TopNotchOverlay.hasNotificationPermission();
  }

  async requestNotificationPermission(): Promise<boolean> {
    if (Platform.OS !== 'android' || !TopNotchOverlay) return true;
    return TopNotchOverlay.requestNotificationPermission();
  }

  // ── Camera ring overlay ──────────────────────────────────────────────────────

  showCameraOverlay(progress: number, color: string = '#7c5cbf'): void {
    if (Platform.OS !== 'android' || !TopNotchOverlay) return;
    TopNotchOverlay.showCameraOverlay(progress, color);
  }

  hideCameraOverlay(): void {
    if (Platform.OS !== 'android' || !TopNotchOverlay) return;
    TopNotchOverlay.hideCameraOverlay();
  }

  showLinearOverlay(progress: number, color: string = '#7c5cbf'): void {
    if (Platform.OS !== 'android' || !TopNotchOverlay) return;
    TopNotchOverlay.showLinearOverlay(progress, color);
  }

  hideLinearOverlay(): void {
    if (Platform.OS !== 'android' || !TopNotchOverlay) return;
    TopNotchOverlay.hideLinearOverlay();
  }

  applyConfig(config: OverlayConfig & { glow?: boolean; matchColor?: boolean; blackBg?: boolean; rounded?: boolean }): void {
    if (Platform.OS !== 'android' || !TopNotchOverlay) return;
    TopNotchOverlay.applyConfig(JSON.stringify(config));
  }

  // ── Foreground service / notification ────────────────────────────────────────

  startForegroundService(jobId: string, jobName: string, totalBytes: number): void {
    if (Platform.OS !== 'android' || !TopNotchOverlay) return;
    TopNotchOverlay.startForegroundService(jobId, jobName, totalBytes);
  }

  updateProgress(progress: DownloadProgress): void {
    if (Platform.OS !== 'android' || !TopNotchOverlay) return;
    TopNotchOverlay.updateProgress(
      progress.jobId,
      progress.percent,
      progress.downloadedBytes,
      progress.totalBytes,
      progress.speed,
      String(progress.status),
    );
  }

  stopForegroundService(jobId: string): void {
    if (Platform.OS !== 'android' || !TopNotchOverlay) return;
    TopNotchOverlay.stopForegroundService(jobId);
  }

  // ── Download control ─────────────────────────────────────────────────────────

  startDownload(jobId: string, jobName: string, url: string, totalBytes: number): void {
    if (Platform.OS !== 'android' || !TopNotchOverlay) return;
    TopNotchOverlay.startDownload(jobId, jobName, url, totalBytes);
  }

  pauseDownload(jobId: string): void {
    if (Platform.OS !== 'android' || !TopNotchOverlay) return;
    TopNotchOverlay.pauseDownload(jobId);
  }

  resumeDownload(jobId: string): void {
    if (Platform.OS !== 'android' || !TopNotchOverlay) return;
    TopNotchOverlay.resumeDownload(jobId);
  }

  cancelDownload(jobId: string): void {
    if (Platform.OS !== 'android' || !TopNotchOverlay) return;
    TopNotchOverlay.cancelDownload(jobId);
  }

  // ── Gesture actions ──────────────────────────────────────────────────────────

  async toggleFlashlight(): Promise<boolean> {
    if (Platform.OS !== 'android' || !TopNotchOverlay) return false;
    return TopNotchOverlay.toggleFlashlight();
  }

  async dispatchMediaKey(action: 'play_pause' | 'next' | 'prev'): Promise<boolean> {
    if (Platform.OS !== 'android' || !TopNotchOverlay) return false;
    return TopNotchOverlay.dispatchMediaKey(action);
  }

  async openCameraApp(): Promise<boolean> {
    if (Platform.OS !== 'android' || !TopNotchOverlay) return false;
    return TopNotchOverlay.openCameraApp();
  }

  // ── Event listeners ──────────────────────────────────────────────────────────

  onDownloadProgress(callback: (event: ProgressEvent) => void): () => void {
    if (!this.emitter) return () => {};
    const sub = this.emitter.addListener('TopNotch_DownloadProgress', callback);
    return () => sub.remove();
  }

  onNotificationAction(callback: (event: NotificationActionEvent) => void): () => void {
    if (!this.emitter) return () => {};
    const sub = this.emitter.addListener('TopNotch_NotificationAction', callback);
    return () => sub.remove();
  }

  onGesture(callback: (event: GestureEvent) => void): () => void {
    if (!this.emitter) return () => {};
    const sub = this.emitter.addListener('TopNotch_Gesture', callback);
    return () => sub.remove();
  }
}

export const overlayBridge = new OverlayServiceBridge();
