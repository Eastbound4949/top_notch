import AsyncStorage from '@react-native-async-storage/async-storage';
import { overlayBridge } from './OverlayBridge';
import type { DownloadJob, DownloadStatus } from '../types';

const JOBS_KEY = 'topnotch_download_jobs';

type Listener = (jobs: DownloadJob[]) => void;

class DownloadManager {
  private jobs: Map<string, DownloadJob> = new Map();
  private listeners: Set<Listener> = new Set();
  private initialized = false;

  async init() {
    if (this.initialized) return;
    this.initialized = true;

    const stored = await AsyncStorage.getItem(JOBS_KEY);
    if (stored) {
      try {
        const arr: DownloadJob[] = JSON.parse(stored);
        arr.forEach((j) => {
          // Reset any in-progress jobs to idle on restart (service was killed)
          if (j.status === 'downloading') j.status = 'paused';
          this.jobs.set(j.id, j);
        });
        this.notify();
      } catch {}
    }

    // Listen to native progress events
    overlayBridge.onDownloadProgress(({ jobId, percent, downloadedBytes, totalBytes, speed, status }) => {
      const job = this.jobs.get(jobId);
      if (!job) return;
      job.downloadedBytes = downloadedBytes;
      job.totalBytes      = totalBytes > 0 ? totalBytes : job.totalBytes;
      job.speed           = speed;
      job.status          = status as DownloadStatus;
      if (status === 'completed') job.completedAt = Date.now();
      this.jobs.set(jobId, { ...job });

      const pct = job.totalBytes > 0 ? percent / 100 : 0;
      if (status === 'downloading') {
        overlayBridge.showCameraOverlay(pct, '#7c5cbf');
      } else if (status === 'completed' || status === 'error') {
        overlayBridge.hideCameraOverlay();
      }

      this.persist();
      this.notify();
    });

    // Notification button actions from the foreground service
    overlayBridge.onNotificationAction(({ jobId, action }) => {
      const job = this.jobs.get(jobId);
      if (!job) return;
      if (action === 'pause') {
        job.status = 'paused';
        this.jobs.set(jobId, { ...job });
      } else if (action === 'resume') {
        job.status = 'downloading';
        this.jobs.set(jobId, { ...job });
      } else if (action === 'cancel') {
        this.jobs.delete(jobId);
        overlayBridge.hideCameraOverlay();
      }
      this.persist();
      this.notify();
    });
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.getJobs());
    return () => this.listeners.delete(listener);
  }

  getJobs(): DownloadJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  async addJob(name: string, url: string, totalBytes: number): Promise<string> {
    const id  = `job_${Date.now()}`;
    const job: DownloadJob = {
      id, name, url, totalBytes,
      downloadedBytes: 0,
      status: 'idle',
      createdAt: Date.now(),
    };
    this.jobs.set(id, job);
    await this.persist();
    this.notify();
    return id;
  }

  async startJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'downloading';
    this.jobs.set(jobId, { ...job });
    await this.persist();
    this.notify();
    overlayBridge.startDownload(jobId, job.name, job.url, job.totalBytes);
    overlayBridge.showCameraOverlay(0, '#7c5cbf');
  }

  async pauseJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'downloading') return;
    overlayBridge.pauseDownload(jobId);
    job.status = 'paused';
    this.jobs.set(jobId, { ...job });
    await this.persist();
    this.notify();
  }

  async resumeJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'paused') return;
    overlayBridge.resumeDownload(jobId);
    job.status = 'downloading';
    this.jobs.set(jobId, { ...job });
    await this.persist();
    this.notify();
  }

  async cancelJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    overlayBridge.cancelDownload(jobId);
    overlayBridge.hideCameraOverlay();
    this.jobs.delete(jobId);
    await this.persist();
    this.notify();
  }

  private async persist() {
    await AsyncStorage.setItem(JOBS_KEY, JSON.stringify(this.getJobs()));
  }

  private notify() {
    const jobs = this.getJobs();
    this.listeners.forEach((l) => l(jobs));
  }
}

export const downloadManager = new DownloadManager();
