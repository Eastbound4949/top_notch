import { useState, useEffect } from 'react';
import { downloadManager } from '../services/DownloadManager';
import type { DownloadJob } from '../types';

export function useDownloads() {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    downloadManager.init().then(() => setReady(true));
    const unsub = downloadManager.subscribe(setJobs);
    return () => { unsub(); };
  }, []);

  return {
    jobs,
    ready,
    activeJob: jobs.find((j) => j.status === 'downloading' || j.status === 'paused') ?? null,
    addJob: downloadManager.addJob.bind(downloadManager),
    startJob: downloadManager.startJob.bind(downloadManager),
    pauseJob: downloadManager.pauseJob.bind(downloadManager),
    resumeJob: downloadManager.resumeJob.bind(downloadManager),
    cancelJob: downloadManager.cancelJob.bind(downloadManager),
  };
}
