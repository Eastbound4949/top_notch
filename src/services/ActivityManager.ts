import AsyncStorage from '@react-native-async-storage/async-storage';
import { overlayBridge } from './OverlayBridge';
import type { Activity, ActivityKind } from '../types';

const STORAGE_KEY = 'topnotch_activities';

type Listener = (activities: Activity[]) => void;

const KIND_COLOR: Record<ActivityKind, string> = {
  download: '#7c5cbf',
  upload:   '#06b6d4',
  music:    '#ec4899',
  video:    '#f59e0b',
  cast:     '#10b981',
  sync:     '#4a9eff',
  call:     '#22c55e',
};

const KIND_ICON: Record<ActivityKind, string> = {
  download: '⬇',
  upload:   '⬆',
  music:    '♪',
  video:    '▶',
  cast:     '⊡',
  sync:     '↻',
  call:     '✆',
};

class ActivityManagerClass {
  private activities: Map<string, Activity> = new Map();
  private listeners: Set<Listener> = new Set();
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private overlayStyle: 'circular' | 'linear' | 'pill' = 'circular';

  async init() {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const arr: Activity[] = JSON.parse(stored);
      arr
        .filter(a => a.status !== 'completed' && a.status !== 'error')
        .forEach(a => this.activities.set(a.id, { ...a, status: 'idle' }));
      this.notify();
    }
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.getAll());
    return () => this.listeners.delete(listener);
  }

  getAll(): Activity[] {
    return Array.from(this.activities.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  static kindColor(kind: ActivityKind): string { return KIND_COLOR[kind]; }
  static kindIcon(kind: ActivityKind): string  { return KIND_ICON[kind]; }

  setOverlayStyle(style: 'circular' | 'linear' | 'pill') {
    this.overlayStyle = style;
    if (style === 'linear') {
      overlayBridge.hideCameraOverlay();
    } else {
      overlayBridge.hideLinearOverlay();
    }
  }

  private showActiveOverlay(progress: number, color: string) {
    if (this.overlayStyle === 'linear') {
      overlayBridge.showLinearOverlay(progress, color);
    } else {
      overlayBridge.showCameraOverlay(progress, color);
    }
  }

  async add(params: {
    kind: ActivityKind;
    title: string;
    subtitle?: string;
    appName?: string;
    appIcon?: string;
    totalBytes?: number;
    durationMs?: number;
    accentColor?: string;
    autoStart?: boolean;
  }): Promise<string> {
    const id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const activity: Activity = {
      id,
      kind: params.kind,
      title: params.title,
      subtitle: params.subtitle,
      appName: params.appName,
      appIcon: params.appIcon ?? KIND_ICON[params.kind],
      status: 'idle',
      progress: 0,
      totalBytes: params.totalBytes,
      transferredBytes: 0,
      durationMs: params.durationMs,
      elapsedMs: 0,
      accentColor: params.accentColor ?? KIND_COLOR[params.kind],
      createdAt: Date.now(),
    };
    this.activities.set(id, activity);
    await this.persist();
    this.notify();

    if (params.autoStart !== false) await this.start(id);
    return id;
  }

  async start(id: string) {
    const a = this.activities.get(id);
    if (!a) return;
    a.status = 'active';
    this.activities.set(id, a);
    overlayBridge.startForegroundService(id, a.title, a.totalBytes ?? 0);
    this.showActiveOverlay(a.progress, a.accentColor ?? '#7c5cbf');
    this.notify();
    this.tick(id);
  }

  async pause(id: string) {
    const a = this.activities.get(id);
    if (!a || a.status !== 'active') return;
    a.status = 'paused';
    this.activities.set(id, a);
    this.clearTimer(id);
    overlayBridge.updateProgress({
      jobId: id,
      percent: Math.round(a.progress * 100),
      downloadedBytes: a.transferredBytes ?? 0,
      totalBytes: a.totalBytes ?? 0,
      speed: 0,
      status: 'paused',
    });
    await this.persist();
    this.notify();
  }

  async resume(id: string) {
    const a = this.activities.get(id);
    if (!a || a.status !== 'paused') return;
    a.status = 'active';
    this.activities.set(id, a);
    await this.persist();
    this.notify();
    this.tick(id);
  }

  async dismiss(id: string) {
    this.clearTimer(id);
    overlayBridge.stopForegroundService(id);
    overlayBridge.hideCameraOverlay();
    this.activities.delete(id);
    await this.persist();
    this.notify();
  }

  private tick(id: string) {
    this.clearTimer(id);
    const timer = setInterval(async () => {
      const a = this.activities.get(id);
      if (!a || a.status !== 'active') { this.clearTimer(id); return; }

      let done = false;

      if (a.kind === 'download' || a.kind === 'upload' || a.kind === 'sync') {
        const chunkSize = Math.random() * 2_000_000 + 1_000_000;
        a.transferredBytes = Math.min((a.transferredBytes ?? 0) + chunkSize, a.totalBytes ?? 1);
        a.speed = chunkSize;
        a.progress = a.totalBytes ? a.transferredBytes / a.totalBytes : 0;
        done = a.progress >= 1;
      } else if (a.kind === 'music' || a.kind === 'video') {
        a.elapsedMs = (a.elapsedMs ?? 0) + 1000;
        a.progress = a.durationMs ? Math.min(a.elapsedMs / a.durationMs, 1) : 0;
        done = a.progress >= 1;
      } else if (a.kind === 'call') {
        a.elapsedMs = (a.elapsedMs ?? 0) + 1000;
        a.progress = Math.min((a.elapsedMs ?? 0) / 3_600_000, 1);
      } else if (a.kind === 'cast') {
        a.progress = ((a.progress ?? 0) + 0.01) % 1;
      }

      if (done) {
        a.status = 'completed';
        a.completedAt = Date.now();
        this.clearTimer(id);
        overlayBridge.hideCameraOverlay();
        overlayBridge.stopForegroundService(id);
      } else {
        this.showActiveOverlay(a.progress, a.accentColor ?? '#7c5cbf');
        overlayBridge.updateProgress({
          jobId: id,
          percent: Math.round(a.progress * 100),
          downloadedBytes: a.transferredBytes ?? 0,
          totalBytes: a.totalBytes ?? 0,
          speed: a.speed ?? 0,
          status: a.status,
        });
      }

      this.activities.set(id, { ...a });
      await this.persist();
      this.notify();
    }, 1000);

    this.timers.set(id, timer);
  }

  private clearTimer(id: string) {
    const t = this.timers.get(id);
    if (t) { clearInterval(t); this.timers.delete(id); }
  }

  private async persist() {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.getAll()));
  }

  private notify() {
    const all = this.getAll();
    this.listeners.forEach(l => l(all));
  }
}

export const ActivityManager = ActivityManagerClass;
export const activityManager = new ActivityManagerClass();
