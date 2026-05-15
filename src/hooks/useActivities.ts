import { useState, useEffect } from 'react';
import { activityManager } from '../services/ActivityManager';
import type { Activity } from '../types';

export function useActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    activityManager.init().then(() => setReady(true));
    return activityManager.subscribe(setActivities);
  }, []);

  return {
    activities,
    ready,
    active:    activities.filter(a => a.status === 'active' || a.status === 'paused'),
    completed: activities.filter(a => a.status === 'completed'),
    addActivity:     activityManager.add.bind(activityManager),
    pause:           activityManager.pause.bind(activityManager),
    resume:          activityManager.resume.bind(activityManager),
    dismiss:         activityManager.dismiss.bind(activityManager),
    setOverlayStyle: activityManager.setOverlayStyle.bind(activityManager),
  };
}
