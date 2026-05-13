import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import type { DownloadJob } from '../types';

interface Props {
  job: DownloadJob;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatSpeed(bps: number): string {
  return `${formatBytes(bps)}/s`;
}

const STATUS_COLOR: Record<string, string> = {
  idle: '#6b7280',
  downloading: '#7c5cbf',
  paused: '#f59e0b',
  completed: '#10b981',
  error: '#ef4444',
};

const STATUS_LABEL: Record<string, string> = {
  idle: 'Ready',
  downloading: 'Downloading',
  paused: 'Paused',
  completed: 'Complete',
  error: 'Error',
};

export function DownloadCard({ job, onStart, onPause, onResume, onCancel }: Props) {
  const percent = job.totalBytes > 0 ? job.downloadedBytes / job.totalBytes : 0;
  const barWidth = useRef(new Animated.Value(percent)).current;

  useEffect(() => {
    Animated.spring(barWidth, {
      toValue: percent,
      useNativeDriver: false,
      tension: 80,
      friction: 10,
    }).start();
  }, [percent]);

  const isActive = job.status === 'downloading';
  const isPaused = job.status === 'paused';
  const isIdle = job.status === 'idle';
  const isDone = job.status === 'completed';

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.dot, { backgroundColor: STATUS_COLOR[job.status] }]} />
          <Text style={styles.name} numberOfLines={1}>{job.name}</Text>
        </View>
        <Text style={[styles.statusText, { color: STATUS_COLOR[job.status] }]}>
          {STATUS_LABEL[job.status]}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            {
              width: barWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: isDone ? '#10b981' : STATUS_COLOR[job.status],
            },
          ]}
        />
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <Text style={styles.stat}>
          {formatBytes(job.downloadedBytes)} / {formatBytes(job.totalBytes)}
        </Text>
        {isActive && job.speed ? (
          <Text style={styles.statAccent}>{formatSpeed(job.speed)}</Text>
        ) : null}
        <Text style={styles.stat}>{Math.round(percent * 100)}%</Text>
      </View>

      {/* Actions */}
      {!isDone && (
        <View style={styles.actions}>
          {isIdle && (
            <TouchableOpacity style={styles.btnPrimary} onPress={onStart}>
              <Text style={styles.btnPrimaryText}>Start</Text>
            </TouchableOpacity>
          )}
          {isActive && (
            <TouchableOpacity style={styles.btnSecondary} onPress={onPause}>
              <Text style={styles.btnSecondaryText}>Pause</Text>
            </TouchableOpacity>
          )}
          {isPaused && (
            <TouchableOpacity style={styles.btnPrimary} onPress={onResume}>
              <Text style={styles.btnPrimaryText}>Resume</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.btnDanger} onPress={onCancel}>
            <Text style={styles.btnDangerText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {isDone && (
        <View style={styles.doneRow}>
          <Text style={styles.doneText}>✓ Download complete</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#13111a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(124,92,191,0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e8d5ff',
    flex: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  barTrack: {
    height: 4,
    backgroundColor: 'rgba(124,92,191,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  stat: {
    fontSize: 12,
    color: 'rgba(232,213,255,0.45)',
    fontVariant: ['tabular-nums'],
  },
  statAccent: {
    fontSize: 12,
    color: '#c084fc',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#7c5cbf',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  btnSecondaryText: {
    color: '#f59e0b',
    fontWeight: '700',
    fontSize: 14,
  },
  btnDanger: {
    paddingHorizontal: 16,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  btnDangerText: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 14,
  },
  doneRow: {
    alignItems: 'center',
    paddingTop: 4,
  },
  doneText: {
    color: '#10b981',
    fontWeight: '600',
    fontSize: 14,
  },
});
