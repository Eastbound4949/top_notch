import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, Animated, Modal, Pressable, StatusBar, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { overlayBridge } from '../src/services/OverlayBridge';
import { useDownloads } from '../src/hooks/useDownloads';
import { DownloadCard } from '../src/components/DownloadCard';
import { AddJobSheet } from '../src/components/AddJobSheet';
import { CircularProgress } from '../src/components/CircularProgress';
import type { DownloadJob } from '../src/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type GestureKey = 'single' | 'long' | 'double' | 'swipeRL' | 'swipeLR';

interface ActionOption {
  id: string;
  label: string;
  exclusive?: boolean;
  isNew?: boolean;
}

interface ActionGroup {
  category: string;
  items: ActionOption[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GESTURES_KEY = 'topnotch_gestures';

const ACTION_GROUPS: ActionGroup[] = [
  {
    category: '',
    items: [
      { id: 'nothing',   label: 'Nothing' },
      { id: 'scroll_top', label: 'Scroll to top' },
    ],
  },
  {
    category: 'Exclusive',
    items: [
      { id: 'min_drawer',  label: 'Minimized applications drawer', exclusive: true },
      { id: 'auto_task',   label: 'Trigger an automated task',     exclusive: true },
    ],
  },
  {
    category: 'Actions',
    items: [
      { id: 'screenshot',  label: 'Take a screenshot',                    exclusive: true },
      { id: 'flashlight',  label: 'Toggle camera flashlight' },
      { id: 'power_menu',  label: 'Open the power button long-press menu' },
    ],
  },
  {
    category: 'Communication',
    items: [
      { id: 'quick_dial',  label: 'Quick dial',                               exclusive: true },
      { id: 'sms',         label: 'Compose new SMS' },
      { id: 'whatsapp',    label: 'Open whatsapp chat with favourite contact' },
    ],
  },
  {
    category: 'Access',
    items: [
      { id: 'camera',      label: 'Open camera! make sense?!' },
      { id: 'recent_apps', label: 'Open recent apps menu' },
      { id: 'open_app',    label: 'Open selected app' },
    ],
  },
  {
    category: 'Modes',
    items: [
      { id: 'auto_orient', label: 'Automatic screen orientations' },
      { id: 'dnd',         label: 'Do Not Disturb' },
    ],
  },
  {
    category: 'Tools',
    items: [
      { id: 'qr',      label: 'QR code reader', isNew: true },
      { id: 'website', label: 'Open a website' },
    ],
  },
  {
    category: 'Media',
    items: [
      { id: 'play_pause', label: 'Play/Pause music' },
      { id: 'next',       label: 'Play next music' },
      { id: 'prev',       label: 'Play previous music' },
    ],
  },
  {
    category: 'System',
    items: [
      { id: 'brightness', label: 'Switch screen brightness between low and high', exclusive: true },
    ],
  },
];

const GESTURES: { key: GestureKey; label: string; icon: string }[] = [
  { key: 'single',  label: 'Single touch',       icon: '☝' },
  { key: 'long',    label: 'Long touch',          icon: '✋' },
  { key: 'double',  label: 'Double click',        icon: '✌' },
  { key: 'swipeRL', label: 'Swipe right to left', icon: '👈' },
  { key: 'swipeLR', label: 'Swipe left to right', icon: '👉' },
];

type Tab = 'progress' | 'actions' | 'settings';

// ── App ───────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('actions');
  const [gestureActions, setGestureActions] = useState<Partial<Record<GestureKey, string>>>({
    double: 'flashlight',
    swipeRL: 'open_app',
  });
  const [pickerOpen, setPickerOpen]       = useState(false);
  const [editingGesture, setEditingGesture] = useState<GestureKey | null>(null);
  const [addSheetOpen, setAddSheetOpen]   = useState(false);

  // Load persisted gesture assignments on mount
  useEffect(() => {
    AsyncStorage.getItem(GESTURES_KEY).then((raw) => {
      if (!raw) return;
      try { setGestureActions(JSON.parse(raw)); } catch {}
    });
  }, []);

  const openPicker = (key: GestureKey) => {
    setEditingGesture(key);
    setPickerOpen(true);
  };

  const selectAction = (actionId: string) => {
    if (!editingGesture) return;
    const next = { ...gestureActions, [editingGesture]: actionId };
    setGestureActions(next);
    AsyncStorage.setItem(GESTURES_KEY, JSON.stringify(next));
    setPickerOpen(false);
  };

  const getActionLabel = (actionId?: string) => {
    if (!actionId) return 'Nothing · Select a function';
    for (const g of ACTION_GROUPS) {
      const found = g.items.find((i) => i.id === actionId);
      if (found) return found.label;
    }
    return 'Nothing · Select a function';
  };

  const downloads = useDownloads();

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#111" />

      <View style={s.content}>
        {activeTab === 'actions' && (
          <ActionsTab
            gestureActions={gestureActions}
            getActionLabel={getActionLabel}
            onEdit={openPicker}
          />
        )}
        {activeTab === 'progress' && (
          <ProgressTab
            downloads={downloads}
            onAddPress={() => setAddSheetOpen(true)}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab onNavigate={() => router.push('/settings')} />
        )}
      </View>

      {/* Bottom nav */}
      <View style={s.bottomNav}>
        <NavTab icon="◎" label="Progress"  tab="progress"  active={activeTab} onPress={setActiveTab} badge={downloads.jobs.filter(j => j.status === 'downloading').length} />
        <NavTab icon="⚡" label="Actions"   tab="actions"   active={activeTab} onPress={setActiveTab} />
        <NavTab icon="⚙" label="Settings"  tab="settings"  active={activeTab} onPress={setActiveTab} />
      </View>

      {/* Action picker modal */}
      <ActionPickerModal
        visible={pickerOpen}
        gesture={editingGesture}
        selected={editingGesture ? gestureActions[editingGesture] : undefined}
        onSelect={selectAction}
        onClose={() => setPickerOpen(false)}
      />

      {/* Add download sheet */}
      <AddJobSheet
        visible={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        onAdd={downloads.addJob}
      />
    </SafeAreaView>
  );
}

// ── Actions Tab ───────────────────────────────────────────────────────────────

function ActionsTab({ gestureActions, getActionLabel, onEdit }: {
  gestureActions: Partial<Record<GestureKey, string>>;
  getActionLabel: (id?: string) => string;
  onEdit: (key: GestureKey) => void;
}) {
  const handlePermissions = async () => {
    const hasOverlay = await overlayBridge.hasOverlayPermission();
    const hasNotif   = await overlayBridge.hasNotificationPermission();

    if (!hasOverlay) {
      Alert.alert(
        'Overlay Permission Required',
        'Top Notch needs "Display over other apps" permission to show the camera ring. Tap OK to open settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => overlayBridge.requestOverlayPermission() },
        ]
      );
      return;
    }

    if (!hasNotif) {
      Alert.alert(
        'Notification Permission',
        'Allow notifications to see download progress in the status bar.',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Allow', onPress: () => overlayBridge.requestNotificationPermission() },
        ]
      );
      return;
    }

    Alert.alert('All Set ✓', 'All required permissions are granted.');
  };

  return (
    <ScrollView contentContainerStyle={s.tabScroll} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={s.permBtn} onPress={handlePermissions}>
        <Text style={s.permIcon}>🛡</Text>
        <Text style={s.permBtnText}>Required Permissions</Text>
      </TouchableOpacity>

      {GESTURES.map((g) => (
        <TouchableOpacity key={g.key} style={s.gestureCard} onPress={() => onEdit(g.key)} activeOpacity={0.75}>
          <Text style={s.gestureIcon}>{g.icon}</Text>
          <View style={s.gestureBody}>
            <Text style={s.gestureLabel}>{g.label}</Text>
            <Text style={s.gestureValue} numberOfLines={1}>{getActionLabel(gestureActions[g.key])}</Text>
          </View>
          <Text style={s.gestureArrow}>›</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ── Progress Tab ──────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  idle: '#6b7280', downloading: '#7c5cbf', paused: '#f59e0b',
  completed: '#10b981', error: '#ef4444',
};
const STATUS_LABEL: Record<string, string> = {
  idle: 'Ready', downloading: 'Downloading…', paused: 'Paused',
  completed: 'Complete', error: 'Error',
};

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1_073_741_824) return `${(b / 1_048_576).toFixed(1)} MB`;
  return `${(b / 1_073_741_824).toFixed(2)} GB`;
}
function fmtSpeed(bps: number) { return `${fmtBytes(bps)}/s`; }
function fmtETA(secs: number) {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function ProgressTab({ downloads, onAddPress }: {
  downloads: ReturnType<typeof useDownloads>;
  onAddPress: () => void;
}) {
  const { jobs, ready, activeJob, startJob, pauseJob, resumeJob, cancelJob } = downloads;

  if (!ready) {
    return <View style={ps.center}><Text style={ps.dimText}>Loading…</Text></View>;
  }

  const queueJobs = jobs.filter((j) => j.id !== activeJob?.id);

  return (
    <ScrollView contentContainerStyle={ps.scroll} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={ps.header}>
        <Text style={ps.title}>Progress</Text>
        <TouchableOpacity style={ps.addBtn} onPress={onAddPress} activeOpacity={0.8}>
          <Text style={ps.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Hero — active job or empty */}
      {activeJob ? (
        <ActiveJobHero
          job={activeJob}
          onPause={() => pauseJob(activeJob.id)}
          onResume={() => resumeJob(activeJob.id)}
          onCancel={() => cancelJob(activeJob.id)}
        />
      ) : (
        <EmptyHero onAdd={onAddPress} />
      )}

      {/* Queue */}
      {queueJobs.length > 0 && (
        <View style={ps.queueSection}>
          <Text style={ps.queueLabel}>Queue · {queueJobs.length}</Text>
          {queueJobs.map((job) => (
            <DownloadCard
              key={job.id}
              job={job}
              onStart={() => startJob(job.id)}
              onPause={() => pauseJob(job.id)}
              onResume={() => resumeJob(job.id)}
              onCancel={() => cancelJob(job.id)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function ActiveJobHero({ job, onPause, onResume, onCancel }: {
  job: DownloadJob;
  onPause: () => void; onResume: () => void; onCancel: () => void;
}) {
  const pct       = job.totalBytes > 0 ? job.downloadedBytes / job.totalBytes : 0;
  const isActive  = job.status === 'downloading';
  const isPaused  = job.status === 'paused';
  const isDone    = job.status === 'completed';
  const isError   = job.status === 'error';
  const accentColor = isDone ? '#10b981' : STATUS_COLOR[job.status];

  const etaSecs = isActive && job.speed && job.speed > 0
    ? Math.round((job.totalBytes - job.downloadedBytes) / job.speed)
    : null;

  return (
    <View style={ps.heroCard}>
      {/* Ring */}
      <View style={ps.ringWrap}>
        <CircularProgress
          progress={pct}
          size={180}
          strokeWidth={10}
          color={accentColor}
        />
        {isPaused && (
          <View style={ps.pauseBadge}>
            <Text style={ps.pauseBadgeText}>PAUSED</Text>
          </View>
        )}
        {isError && (
          <View style={[ps.pauseBadge, { backgroundColor: '#ef4444' }]}>
            <Text style={ps.pauseBadgeText}>ERROR</Text>
          </View>
        )}
      </View>

      {/* Name + status */}
      <Text style={ps.heroName} numberOfLines={2}>{job.name}</Text>
      <Text style={[ps.heroStatus, { color: accentColor }]}>
        {STATUS_LABEL[job.status]}
      </Text>

      {/* Stats row */}
      <View style={ps.statsRow}>
        <StatCell
          label="Downloaded"
          value={`${fmtBytes(job.downloadedBytes)}`}
          sub={`of ${fmtBytes(job.totalBytes)}`}
        />
        <View style={ps.statDiv} />
        <StatCell
          label="Speed"
          value={isActive && job.speed ? fmtSpeed(job.speed) : '—'}
        />
        <View style={ps.statDiv} />
        <StatCell
          label="ETA"
          value={etaSecs !== null ? fmtETA(etaSecs) : '—'}
        />
      </View>

      {/* Progress bar */}
      <View style={ps.barTrack}>
        <View
          style={[
            ps.barFill,
            { width: `${Math.min(100, Math.round(pct * 100))}%` as any, backgroundColor: accentColor },
          ]}
        />
      </View>
      <Text style={ps.barPct}>{Math.round(pct * 100)}%</Text>

      {/* Actions */}
      {!isDone && !isError && (
        <View style={ps.heroActions}>
          {isActive  && <TouchableOpacity style={ps.btnSecondary} onPress={onPause}><Text style={ps.btnSecText}>Pause</Text></TouchableOpacity>}
          {isPaused  && <TouchableOpacity style={ps.btnPrimary}   onPress={onResume}><Text style={ps.btnPriText}>Resume</Text></TouchableOpacity>}
          <TouchableOpacity style={ps.btnDanger} onPress={onCancel}><Text style={ps.btnDanText}>Cancel</Text></TouchableOpacity>
        </View>
      )}
      {isDone && (
        <View style={ps.doneRow}>
          <Text style={ps.doneText}>✓ Download complete</Text>
        </View>
      )}
    </View>
  );
}

function EmptyHero({ onAdd }: { onAdd: () => void }) {
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={ps.emptyHero}>
      <Animated.Text style={[ps.emptyRing, { opacity: pulse }]}>◎</Animated.Text>
      <Text style={ps.emptyTitle}>No active transfers</Text>
      <Text style={ps.emptyDesc}>
        Start a download and the progress ring{'\n'}will appear around your camera.
      </Text>
      <TouchableOpacity style={ps.emptyAddBtn} onPress={onAdd} activeOpacity={0.85}>
        <Text style={ps.emptyAddText}>+ New Download</Text>
      </TouchableOpacity>
    </View>
  );
}

function StatCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={ps.statCell}>
      <Text style={ps.statValue}>{value}</Text>
      {sub ? <Text style={ps.statSub}>{sub}</Text> : null}
      <Text style={ps.statLabel}>{label}</Text>
    </View>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────────────

function SettingsTab({ onNavigate }: { onNavigate: () => void }) {
  return (
    <ScrollView contentContainerStyle={s.tabScroll} showsVerticalScrollIndicator={false}>
      <Text style={s.tabTitle}>Settings</Text>
      <TouchableOpacity style={s.settingsCard} onPress={onNavigate}>
        <Text style={s.settingsCardIcon}>⚙</Text>
        <View style={s.settingsCardBody}>
          <Text style={s.settingsCardLabel}>Overlay & Progress Bar</Text>
          <Text style={s.settingsCardDesc}>Style, color, ring thickness, zones</Text>
        </View>
        <Text style={s.gestureArrow}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.settingsCard} onPress={async () => {
        await overlayBridge.requestOverlayPermission();
        await overlayBridge.requestNotificationPermission();
      }}>
        <Text style={s.settingsCardIcon}>🛡</Text>
        <View style={s.settingsCardBody}>
          <Text style={s.settingsCardLabel}>Required Permissions</Text>
          <Text style={s.settingsCardDesc}>Overlay, accessibility, notifications</Text>
        </View>
        <Text style={s.gestureArrow}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.settingsCard} onPress={() => Alert.alert('Coming Soon', 'Subscription management will be available in a future update.')}>
        <Text style={s.settingsCardIcon}>👑</Text>
        <View style={s.settingsCardBody}>
          <Text style={s.settingsCardLabel}>Manage Subscription</Text>
          <Text style={s.settingsCardDesc}>Unlock exclusive features</Text>
        </View>
        <Text style={s.gestureArrow}>›</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Bottom Nav Tab ────────────────────────────────────────────────────────────

function NavTab({ icon, label, tab, active, onPress, badge = 0 }: {
  icon: string; label: string; tab: Tab; active: Tab;
  onPress: (t: Tab) => void; badge?: number;
}) {
  const isActive = tab === active;
  return (
    <TouchableOpacity style={s.navTab} onPress={() => onPress(tab)} activeOpacity={0.7}>
      <View>
        <Text style={[s.navIcon, isActive && s.navIconActive]}>{icon}</Text>
        {badge > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={[s.navLabel, isActive && s.navLabelActive]}>{label}</Text>
      {isActive && <View style={s.navDot} />}
    </TouchableOpacity>
  );
}

// ── Action Picker Modal ───────────────────────────────────────────────────────

function ActionPickerModal({ visible, gesture, selected, onSelect, onClose }: {
  visible: boolean;
  gesture: GestureKey | null;
  selected?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const gestureLabel = GESTURES.find((g) => g.key === gesture)?.label ?? '';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.pickerBackdrop} onPress={onClose}>
        <Pressable style={s.pickerSheet} onPress={() => {}}>
          <View style={s.pickerHeader}>
            <TouchableOpacity style={s.pickerBackBtn} onPress={onClose}>
              <Text style={s.pickerBackIcon}>‹</Text>
            </TouchableOpacity>
            <Text style={s.pickerTitle}>{gestureLabel}</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {ACTION_GROUPS.map((group, gi) => (
              <View key={gi}>
                {group.category ? <Text style={s.pickerCategory}>{group.category}</Text> : null}
                {group.items.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={s.pickerRow}
                    onPress={() => onSelect(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[s.radio, selected === item.id && s.radioSelected]} />
                    <Text style={s.pickerItemLabel}>{item.label}</Text>
                    {item.exclusive && <Text style={s.fireBadge}>🔥</Text>}
                    {item.isNew && (
                      <View style={s.newBadge}>
                        <Text style={s.newBadgeText}>NEW</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Progress Tab Styles ───────────────────────────────────────────────────────

const ps = StyleSheet.create({
  scroll:    { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dimText:   { color: '#555', fontSize: 14 },

  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title:     { fontSize: 28, fontWeight: '700', color: '#fff' },
  addBtn:    { backgroundColor: '#7c5cbf', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },

  // Hero card
  heroCard: {
    backgroundColor: '#13111a',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124,92,191,0.25)',
    marginBottom: 20,
  },
  ringWrap:  { marginBottom: 16, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  pauseBadge:{
    position: 'absolute', bottom: -4, right: -4,
    backgroundColor: '#f59e0b', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  pauseBadgeText: { fontSize: 9, fontWeight: '800', color: '#000', letterSpacing: 1 },
  heroName:  { fontSize: 18, fontWeight: '700', color: '#e8d5ff', textAlign: 'center', marginBottom: 4, paddingHorizontal: 8 },
  heroStatus:{ fontSize: 13, fontWeight: '600', letterSpacing: 0.5, marginBottom: 20 },

  // Stats
  statsRow:  { flexDirection: 'row', width: '100%', marginBottom: 20 },
  statCell:  { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 16, fontWeight: '700', color: '#e8d5ff' },
  statSub:   { fontSize: 11, color: 'rgba(232,213,255,0.4)' },
  statLabel: { fontSize: 11, color: '#555', letterSpacing: 0.5, textTransform: 'uppercase' as const },
  statDiv:   { width: 1, backgroundColor: '#222', marginVertical: 4 },

  // Progress bar
  barTrack:  { width: '100%', height: 5, backgroundColor: 'rgba(124,92,191,0.15)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  barFill:   { height: '100%', borderRadius: 3 },
  barPct:    { fontSize: 12, color: 'rgba(232,213,255,0.4)', marginBottom: 20 },

  // Actions
  heroActions:{ flexDirection: 'row', gap: 10, width: '100%' },
  btnPrimary: { flex: 1, backgroundColor: '#7c5cbf', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  btnPriText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnSecondary:{ flex: 1, backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
  btnSecText: { color: '#f59e0b', fontWeight: '700', fontSize: 15 },
  btnDanger:  { paddingHorizontal: 20, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' },
  btnDanText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
  doneRow:   { paddingVertical: 8 },
  doneText:  { color: '#10b981', fontWeight: '600', fontSize: 15 },

  // Empty hero
  emptyHero: {
    backgroundColor: '#13111a',
    borderRadius: 24,
    paddingVertical: 52,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e1e2a',
    borderStyle: 'dashed',
    marginBottom: 20,
    gap: 8,
  },
  emptyRing:  { fontSize: 64, color: '#2a2a3a', marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#444' },
  emptyDesc:  { fontSize: 14, color: '#333', textAlign: 'center', lineHeight: 22 },
  emptyAddBtn:{ marginTop: 12, backgroundColor: '#7c5cbf', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 13 },
  emptyAddText:{ color: '#fff', fontWeight: '700', fontSize: 15 },

  // Queue section
  queueSection:{ gap: 0 },
  queueLabel:  { fontSize: 12, fontWeight: '700', color: '#555', letterSpacing: 1, textTransform: 'uppercase' as const, marginBottom: 12 },
});

// ── Styles ────────────────────────────────────────────────────────────────────

const BLUE    = '#4a9eff';
const CARD_BG = '#1e2025';
const BG      = '#111316';

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: BG },
  content: { flex: 1 },

  tabScroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 20 },
  tabTitle:  { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 20 },

  // Permission button
  permBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#1e2d3d', borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 16, marginBottom: 12,
  },
  permIcon:    { fontSize: 20 },
  permBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  // Gesture cards
  gestureCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD_BG, borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 18,
    marginBottom: 10, gap: 14,
  },
  gestureIcon:  { fontSize: 22, width: 30, textAlign: 'center' },
  gestureBody:  { flex: 1 },
  gestureLabel: { fontSize: 16, fontWeight: '600', color: '#fff' },
  gestureValue: { fontSize: 13, color: '#6b7280', marginTop: 3 },
  gestureArrow: { fontSize: 22, color: '#444' },


  // Settings tab
  settingsCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD_BG, borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 18,
    marginBottom: 10, gap: 14,
  },
  settingsCardIcon:  { fontSize: 20, width: 30, textAlign: 'center' },
  settingsCardBody:  { flex: 1 },
  settingsCardLabel: { fontSize: 16, fontWeight: '600', color: '#fff' },
  settingsCardDesc:  { fontSize: 13, color: '#6b7280', marginTop: 3 },

  // Bottom nav
  bottomNav: {
    flexDirection: 'row', backgroundColor: '#16181c',
    borderTopWidth: 1, borderTopColor: '#222',
    paddingBottom: 8, paddingTop: 4,
  },
  navTab:        { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 4 },
  navIcon:       { fontSize: 20, color: '#444' },
  navIconActive: { color: BLUE },
  navLabel:      { fontSize: 10, color: '#444', fontWeight: '600', letterSpacing: 0.5 },
  navLabelActive:{ color: BLUE },
  navDot:        { width: 4, height: 4, borderRadius: 2, backgroundColor: BLUE, marginTop: 2 },
  badge:         { position: 'absolute', top: -4, right: -8, backgroundColor: '#ef4444', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  badgeText:     { color: '#fff', fontSize: 9, fontWeight: '700' },

  // Action picker modal
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: '#111316', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '88%', paddingBottom: 10,
  },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: '#1e1e1e',
  },
  pickerBackBtn:  { width: 38, height: 38, borderRadius: 10, backgroundColor: '#1e2025', alignItems: 'center', justifyContent: 'center' },
  pickerBackIcon: { fontSize: 24, color: BLUE, lineHeight: 30 },
  pickerTitle:    { fontSize: 20, fontWeight: '700', color: BLUE },
  pickerCategory: { fontSize: 14, fontWeight: '700', color: BLUE, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD_BG, borderRadius: 12,
    marginHorizontal: 12, marginBottom: 8,
    paddingHorizontal: 16, paddingVertical: 16, gap: 14,
  },
  radio:          { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#555' },
  radioSelected:  { borderColor: BLUE, backgroundColor: BLUE },
  pickerItemLabel:{ flex: 1, fontSize: 15, color: '#e0e0e0' },
  fireBadge:      { fontSize: 16 },
  newBadge:       { backgroundColor: '#2a2a2a', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#444' },
  newBadgeText:   { fontSize: 10, color: '#aaa', fontWeight: '700', letterSpacing: 1 },
});
