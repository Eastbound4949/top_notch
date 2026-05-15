import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, Modal, Pressable, StatusBar, Animated, Alert, Linking, Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { overlayBridge } from '../src/services/OverlayBridge';
import { useActivities } from '../src/hooks/useActivities';
import { activityManager, ActivityManager } from '../src/services/ActivityManager';
import type { Activity, ActivityKind } from '../src/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const BLUE = '#4a9eff';
const BG   = '#111316';
const CARD = '#1e2025';

const GESTURES_KEY  = 'topnotch_gestures';
const SETTINGS_KEY  = 'topnotch_settings';
const SOURCES_KEY   = 'topnotch_sources';

type OverlayStyle = 'circular' | 'linear' | 'pill';

const ALL_KINDS: ActivityKind[] = ['download', 'upload', 'music', 'video', 'cast', 'sync', 'call'];

const SOURCE_KINDS: { kind: ActivityKind; label: string; icon: string }[] = [
  { kind: 'download', label: 'Downloads', icon: '⬇' },
  { kind: 'upload',   label: 'Uploads',   icon: '⬆' },
  { kind: 'music',    label: 'Music',     icon: '♪' },
  { kind: 'video',    label: 'Video',     icon: '▶' },
  { kind: 'cast',     label: 'Cast',      icon: '⊡' },
  { kind: 'sync',     label: 'Sync',      icon: '↻' },
  { kind: 'call',     label: 'Calls',     icon: '✆' },
];

// ── Presets ───────────────────────────────────────────────────────────────────

const PRESETS: {
  kind: ActivityKind; title: string; subtitle: string;
  appIcon: string; totalBytes?: number; durationMs?: number;
}[] = [
  { kind: 'download', title: 'Ubuntu 24.04 ISO',   subtitle: 'releases.ubuntu.com', appIcon: '🐧', totalBytes: 6_200_000_000 },
  { kind: 'upload',   title: 'Project backup.zip', subtitle: 'Google Drive',        appIcon: '☁',  totalBytes: 450_000_000 },
  { kind: 'music',    title: 'Blinding Lights',     subtitle: 'The Weeknd',          appIcon: '♪',  durationMs: 200_000 },
  { kind: 'video',    title: 'Oppenheimer (4K)',     subtitle: 'Netflix',             appIcon: '🎬', durationMs: 11_100_000 },
  { kind: 'cast',     title: 'Casting to TV',       subtitle: 'Samsung Smart TV',    appIcon: '📺' },
  { kind: 'sync',     title: 'Google Photos sync',  subtitle: '1,204 items',         appIcon: '🖼', totalBytes: 2_100_000_000 },
  { kind: 'call',     title: 'Call with Priya',     subtitle: 'WhatsApp',            appIcon: '📞' },
];

// ── Gesture / action definitions ──────────────────────────────────────────────

type GestureKey = 'single' | 'long' | 'double' | 'swipeRL' | 'swipeLR';

const GESTURES: { key: GestureKey; label: string; icon: string }[] = [
  { key: 'single',  label: 'Single touch',       icon: '☝' },
  { key: 'long',    label: 'Long touch',          icon: '✋' },
  { key: 'double',  label: 'Double click',        icon: '✌' },
  { key: 'swipeRL', label: 'Swipe right to left', icon: '👈' },
  { key: 'swipeLR', label: 'Swipe left to right', icon: '👉' },
];

const ACTION_GROUPS = [
  { category: '', items: [
    { id: 'nothing',    label: 'Nothing' },
    { id: 'scroll_top', label: 'Scroll to top' },
  ]},
  { category: 'Exclusive', items: [
    { id: 'min_drawer', label: 'Minimized applications drawer', exclusive: true },
    { id: 'auto_task',  label: 'Trigger an automated task',     exclusive: true },
  ]},
  { category: 'Actions', items: [
    { id: 'screenshot',  label: 'Take a screenshot',                    exclusive: true },
    { id: 'flashlight',  label: 'Toggle camera flashlight' },
    { id: 'power_menu',  label: 'Open the power button long-press menu' },
  ]},
  { category: 'Communication', items: [
    { id: 'quick_dial', label: 'Quick dial',                              exclusive: true },
    { id: 'sms',        label: 'Compose new SMS' },
    { id: 'whatsapp',   label: 'Open WhatsApp chat with favourite contact' },
  ]},
  { category: 'Access', items: [
    { id: 'camera',      label: 'Open camera' },
    { id: 'recent_apps', label: 'Open recent apps menu' },
    { id: 'open_app',    label: 'Open selected app' },
  ]},
  { category: 'Modes', items: [
    { id: 'auto_orient', label: 'Automatic screen orientation' },
    { id: 'dnd',         label: 'Do Not Disturb' },
  ]},
  { category: 'Tools', items: [
    { id: 'qr',      label: 'QR code reader', isNew: true },
    { id: 'website', label: 'Open a website' },
  ]},
  { category: 'Media', items: [
    { id: 'play_pause', label: 'Play / Pause' },
    { id: 'next',       label: 'Next track' },
    { id: 'prev',       label: 'Previous track' },
  ]},
  { category: 'System', items: [
    { id: 'brightness', label: 'Toggle brightness', exclusive: true },
  ]},
];

type Tab = 'progress' | 'actions';

// ── Root ──────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('progress');
  const [gestureActions, setGestureActions] = useState<Partial<Record<GestureKey, string>>>({
    double:  'flashlight',
    swipeRL: 'open_app',
  });

  // Request permissions on first launch if not granted
  useEffect(() => {
    (async () => {
      const hasOverlay = await overlayBridge.hasOverlayPermission();
      if (!hasOverlay) {
        Alert.alert(
          'Permission Required',
          'Top Notch needs "Display over other apps" to show the progress ring around your camera.',
          [
            { text: 'Not Now', style: 'cancel' },
            { text: 'Grant', onPress: () => overlayBridge.requestOverlayPermission() },
          ]
        );
        return;
      }
      const hasNotif = await overlayBridge.hasNotificationPermission();
      if (!hasNotif) {
        Alert.alert(
          'Notification Access',
          'Allow notifications to show download progress in your status bar.',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Allow', onPress: () => overlayBridge.requestNotificationPermission() },
          ]
        );
      }
    })();
  }, []);
  const [pickerOpen, setPickerOpen]       = useState(false);
  const [editingGesture, setEditingGesture] = useState<GestureKey | null>(null);

  // Keep ref current so the gesture listener closure always sees latest config
  const gestureActionsRef = useRef(gestureActions);
  useEffect(() => { gestureActionsRef.current = gestureActions; }, [gestureActions]);

  // Load persisted gesture assignments
  useEffect(() => {
    AsyncStorage.getItem(GESTURES_KEY).then((raw) => {
      if (!raw) return;
      try { setGestureActions(JSON.parse(raw)); } catch {}
    });
  }, []);

  // Listen for taps on the overlay ring and execute the assigned action
  useEffect(() => {
    const unsub = overlayBridge.onGesture(({ gestureType }) => {
      const actionId = gestureActionsRef.current[gestureType as GestureKey] ?? 'nothing';
      executeGestureAction(actionId);
    });
    return unsub;
  }, []);

  const openPicker = (key: GestureKey) => { setEditingGesture(key); setPickerOpen(true); };

  const selectAction = (actionId: string) => {
    if (!editingGesture) return;
    const next = { ...gestureActions, [editingGesture]: actionId };
    setGestureActions(next);
    AsyncStorage.setItem(GESTURES_KEY, JSON.stringify(next));
    setPickerOpen(false);
  };

  const getActionLabel = (id?: string) => {
    if (!id) return 'Nothing · Select a function';
    for (const g of ACTION_GROUPS) {
      const f = g.items.find((i: any) => i.id === id);
      if (f) return f.label;
    }
    return 'Nothing · Select a function';
  };

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <View style={s.content}>
        {activeTab === 'progress' && <ProgressBarTab />}
        {activeTab === 'actions'  && (
          <ActionsTab
            gestureActions={gestureActions}
            getActionLabel={getActionLabel}
            onEdit={openPicker}
          />
        )}
      </View>

      <View style={s.bottomNav}>
        <NavTab icon="◎" label="Progress" tab="progress" active={activeTab} onPress={setActiveTab} />
        <NavTab icon="⚡" label="Actions"  tab="actions"  active={activeTab} onPress={setActiveTab} />
      </View>

      <ActionPickerModal
        visible={pickerOpen}
        gesture={editingGesture}
        selected={editingGesture ? gestureActions[editingGesture] : undefined}
        onSelect={selectAction}
        onClose={() => setPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

// ── Gesture action executor ───────────────────────────────────────────────────

async function executeGestureAction(id: string) {
  switch (id) {
    case 'nothing':    break;

    case 'flashlight':
      overlayBridge.toggleFlashlight();
      break;

    case 'play_pause':
      overlayBridge.dispatchMediaKey('play_pause');
      break;
    case 'next':
      overlayBridge.dispatchMediaKey('next');
      break;
    case 'prev':
      overlayBridge.dispatchMediaKey('prev');
      break;

    case 'camera':
      overlayBridge.openCameraApp();
      break;

    case 'sms':
      Linking.openURL('sms:').catch(() => {});
      break;

    case 'quick_dial':
      Linking.openURL('tel:').catch(() => {});
      break;

    case 'whatsapp':
      Linking.openURL('whatsapp://').catch(() =>
        Linking.openURL('https://wa.me').catch(() => {})
      );
      break;

    case 'website':
      Linking.openURL('https://').catch(() => {});
      break;

    // These require accessibility service — inform user
    case 'recent_apps':
    case 'power_menu':
    case 'screenshot':
    case 'scroll_top':
    case 'min_drawer':
    case 'auto_task':
    case 'auto_orient':
    case 'dnd':
    case 'brightness':
      Alert.alert(
        'Accessibility Required',
        'This action needs the Top Notch Accessibility Service. Enable it in Settings → Accessibility.',
        [{ text: 'OK' }]
      );
      break;

    case 'open_app':
    case 'qr':
      Alert.alert('Coming Soon', 'Configure this action in the Actions tab.', [{ text: 'OK' }]);
      break;

    default:
      break;
  }
}

// ── Progress Bar Tab ──────────────────────────────────────────────────────────

function ProgressBarTab() {
  const { activities, active, completed, ready, pause, resume, dismiss, setOverlayStyle } = useActivities();
  const [overlayStyle, setLocalStyle] = useState<OverlayStyle>('circular');
  const [enabledKinds, setEnabledKinds] = useState<Set<ActivityKind>>(new Set(ALL_KINDS));
  const [lockScreen, setLockScreen]   = useState(true);
  const [autoHide,   setAutoHide]     = useState(false);

  // Load persisted preferences
  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then(raw => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        const style: OverlayStyle = parsed.barStyle ?? 'circular';
        setLocalStyle(style);
        setOverlayStyle(style);
        if (parsed.lockScreen !== undefined) setLockScreen(parsed.lockScreen);
        if (parsed.fullscreen  !== undefined) setAutoHide(parsed.fullscreen);
      } catch {}
    });
    AsyncStorage.getItem(SOURCES_KEY).then(raw => {
      if (!raw) return;
      try { setEnabledKinds(new Set(JSON.parse(raw))); } catch {}
    });
  }, []);

  const changeStyle = (style: OverlayStyle) => {
    setLocalStyle(style);
    setOverlayStyle(style);
    AsyncStorage.getItem(SETTINGS_KEY).then(raw => {
      const prev = raw ? JSON.parse(raw) : {};
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...prev, barStyle: style }));
    });
  };

  const toggleKind = (kind: ActivityKind) => {
    setEnabledKinds(prev => {
      const next = new Set(prev);
      if (next.has(kind)) { if (next.size > 1) next.delete(kind); }
      else next.add(kind);
      AsyncStorage.setItem(SOURCES_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const updateDisplayPref = (key: 'lockScreen' | 'fullscreen', val: boolean) => {
    if (key === 'lockScreen') setLockScreen(val);
    else setAutoHide(val);
    AsyncStorage.getItem(SETTINGS_KEY).then(raw => {
      const prev = raw ? JSON.parse(raw) : {};
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...prev, [key]: val }));
    });
  };

  const visibleActive    = active.filter(a => enabledKinds.has(a.kind));
  const visibleCompleted = completed.filter(a => enabledKinds.has(a.kind));
  const primaryActive    = visibleActive[0] ?? null;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.tabScroll} showsVerticalScrollIndicator={false}>

        {/* ── Section title ── */}
        <Text style={s.pbTitle}>Progress Bar</Text>

        {/* ── Style selector ── */}
        <View style={s.styleCard}>
          <Text style={s.styleCardLabel}>Style</Text>
          <View style={s.styleRow}>
            {([
              { value: 'circular', icon: '◎', label: 'Circular', desc: 'Around camera' },
              { value: 'linear',   icon: '▬', label: 'Linear',   desc: 'Top of screen' },
              { value: 'pill',     icon: '⊙', label: 'Pill',     desc: 'Camera wrap' },
            ] as { value: OverlayStyle; icon: string; label: string; desc: string }[]).map(opt => {
              const active = overlayStyle === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[s.styleBtn, active && s.styleBtnActive]}
                  onPress={() => changeStyle(opt.value)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.styleBtnIcon, active && s.styleBtnIconActive]}>{opt.icon}</Text>
                  <Text style={[s.styleBtnLabel, active && s.styleBtnLabelActive]}>{opt.label}</Text>
                  <Text style={s.styleBtnDesc}>{opt.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Hero / active ── */}
        {primaryActive ? (
          <HeroCard
            activity={primaryActive}
            onPause={() => pause(primaryActive.id)}
            onResume={() => resume(primaryActive.id)}
            overlayStyle={overlayStyle}
          />
        ) : (
          <View style={s.emptyHero}>
            <Text style={s.emptyRing}>{overlayStyle === 'linear' ? '▬' : '◎'}</Text>
            <Text style={s.emptyTitle}>Nothing playing or transferring</Text>
            <Text style={s.emptyDesc}>
              Add an activity to see the{' '}
              {overlayStyle === 'linear' ? 'progress bar' : 'ring'}{'\n'}
              appear {overlayStyle === 'linear' ? 'at the top of your screen' : 'around your camera'}
            </Text>
          </View>
        )}

        {/* ── Active list ── */}
        {visibleActive.length > 0 && (
          <>
            <SectionHeader label="Active" count={visibleActive.length} />
            {visibleActive.map(a => (
              <ActivityCard key={a.id} activity={a}
                onPause={() => pause(a.id)}
                onResume={() => resume(a.id)}
                onDismiss={() => dismiss(a.id)}
              />
            ))}
          </>
        )}

        {/* ── Completed list ── */}
        {visibleCompleted.length > 0 && (
          <>
            <SectionHeader label="Completed" count={visibleCompleted.length} />
            {visibleCompleted.slice(0, 5).map(a => (
              <ActivityCard key={a.id} activity={a} onDismiss={() => dismiss(a.id)} />
            ))}
          </>
        )}

        {activities.length === 0 && ready && (
          <Text style={s.hintText}>Tap + to add a download, music, video, call or sync</Text>
        )}

        {/* ── Tracking Sources ── */}
        <View style={s.sourcesCard}>
          <Text style={s.sourcesTitle}>Tracking Sources</Text>
          <Text style={s.sourcesDesc}>Toggle which activity types appear in the progress bar</Text>
          <View style={s.sourcesGrid}>
            {SOURCE_KINDS.map(({ kind, label, icon }) => {
              const on    = enabledKinds.has(kind);
              const color = ActivityManager.kindColor(kind);
              return (
                <TouchableOpacity
                  key={kind}
                  style={[s.sourceChip, on && { backgroundColor: color + '22', borderColor: color }]}
                  onPress={() => toggleKind(kind)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.sourceChipIcon, on && { color }]}>{icon}</Text>
                  <Text style={[s.sourceChipLabel, on && { color }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Overlay settings link ── */}
        <TouchableOpacity style={s.settingsLinkCard} onPress={() => router.push('/settings')} activeOpacity={0.75}>
          <Text style={s.settingsLinkIcon}>⚙</Text>
          <View style={s.gestureBody}>
            <Text style={s.gestureLabel}>Overlay & Progress Bar</Text>
            <Text style={s.gestureValue}>Style, color, ring thickness, glow, per-app</Text>
          </View>
          <Text style={s.gestureArrow}>›</Text>
        </TouchableOpacity>

        {/* ── Display options ── */}
        <View style={s.displayCard}>
          <Text style={s.sourcesTitle}>Display</Text>
          <View style={s.displayRow}>
            <View style={s.displayRowBody}>
              <Text style={s.displayRowLabel}>⊟  Show on lock screen</Text>
              <Text style={s.displayRowDesc}>Also shown in always-on display</Text>
            </View>
            <Switch
              value={lockScreen}
              onValueChange={v => updateDisplayPref('lockScreen', v)}
              trackColor={{ false: '#2a2a2a', true: BLUE }}
              thumbColor={lockScreen ? '#c4dcff' : '#888'}
            />
          </View>
          <View style={s.displayRow}>
            <View style={s.displayRowBody}>
              <Text style={s.displayRowLabel}>⛶  Auto-hide in fullscreen</Text>
              <Text style={s.displayRowDesc}>Hides when video or game goes fullscreen</Text>
            </View>
            <Switch
              value={autoHide}
              onValueChange={v => updateDisplayPref('fullscreen', v)}
              trackColor={{ false: '#2a2a2a', true: BLUE }}
              thumbColor={autoHide ? '#c4dcff' : '#888'}
            />
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Hero card ─────────────────────────────────────────────────────────────────

function HeroCard({ activity: a, onPause, onResume, overlayStyle = 'circular' }: {
  activity: Activity; onPause: () => void; onResume: () => void; overlayStyle?: OverlayStyle;
}) {
  const color = a.accentColor ?? '#7c5cbf';
  const isPaused = a.status === 'paused';
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (a.kind === 'cast' && !isPaused) {
      Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 2000, useNativeDriver: true })
      ).start();
    } else {
      spinAnim.stopAnimation();
    }
  }, [a.kind, isPaused]);

  return (
    <View style={[s.heroCard, { borderColor: color + '40' }]}>
      <View style={s.heroTop}>
        <View style={[s.heroIconWrap, { backgroundColor: color + '22' }]}>
          <Text style={s.heroIcon}>{a.appIcon ?? ActivityManager.kindIcon(a.kind)}</Text>
        </View>
        <View style={s.heroMeta}>
          <Text style={s.heroKindLabel}>{kindLabel(a.kind)}</Text>
          <Text style={s.heroTitle} numberOfLines={1}>{a.title}</Text>
          {a.subtitle ? <Text style={s.heroSubtitle} numberOfLines={1}>{a.subtitle}</Text> : null}
        </View>
        <View style={[s.statusPill, { backgroundColor: isPaused ? '#f59e0b22' : color + '22' }]}>
          <View style={[s.statusDot, { backgroundColor: isPaused ? '#f59e0b' : color }]} />
          <Text style={[s.statusText, { color: isPaused ? '#f59e0b' : color }]}>
            {isPaused ? 'Paused' : 'Live'}
          </Text>
        </View>
      </View>

      {/* Linear mode: show taller bar preview; circular: thin track */}
      <View style={[s.heroBg, overlayStyle === 'linear' && s.heroBgLinear]}>
        <View style={[s.heroFill, {
          width: `${Math.round(a.progress * 100)}%` as any,
          backgroundColor: color,
          borderRadius: overlayStyle === 'linear' ? 4 : 3,
        }]} />
      </View>

      <View style={s.heroStats}>
        <Text style={s.heroStat}>{formatProgress(a)}</Text>
        <Text style={[s.heroPercent, { color }]}>{Math.round(a.progress * 100)}%</Text>
        <Text style={s.heroStat}>{formatRight(a)}</Text>
      </View>

      <View style={s.heroControls}>
        <TouchableOpacity
          style={[s.controlBtn, { backgroundColor: color + '22', borderColor: color + '55' }]}
          onPress={isPaused ? onResume : onPause}
        >
          <Text style={[s.controlBtnText, { color }]}>{isPaused ? '▶  Resume' : '⏸  Pause'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Activity card ─────────────────────────────────────────────────────────────

function ActivityCard({ activity: a, onPause, onResume, onDismiss }: {
  activity: Activity;
  onPause?: () => void;
  onResume?: () => void;
  onDismiss: () => void;
}) {
  const color = a.accentColor ?? '#7c5cbf';
  const isDone   = a.status === 'completed';
  const isPaused = a.status === 'paused';

  return (
    <View style={s.actCard}>
      <View style={[s.actIconWrap, { backgroundColor: color + '22' }]}>
        <Text style={s.actIcon}>{a.appIcon ?? ActivityManager.kindIcon(a.kind)}</Text>
      </View>
      <View style={s.actBody}>
        <View style={s.actHeader}>
          <Text style={s.actTitle} numberOfLines={1}>{a.title}</Text>
          {isDone
            ? <Text style={s.doneTag}>✓ Done</Text>
            : <Text style={[s.actPercent, { color }]}>{Math.round(a.progress * 100)}%</Text>
          }
        </View>
        {a.subtitle ? <Text style={s.actSubtitle} numberOfLines={1}>{a.subtitle}</Text> : null}
        <View style={s.actBarBg}>
          <View style={[s.actBarFill, {
            width: `${Math.round(a.progress * 100)}%` as any,
            backgroundColor: isDone ? '#10b981' : color,
          }]} />
        </View>
        <View style={s.actFooter}>
          <Text style={s.actMeta}>{formatProgress(a)}</Text>
          {!isDone && (
            <View style={s.actActions}>
              {isPaused
                ? <TouchableOpacity onPress={onResume}><Text style={[s.actBtn, { color }]}>Resume</Text></TouchableOpacity>
                : <TouchableOpacity onPress={onPause}><Text style={s.actBtnMuted}>Pause</Text></TouchableOpacity>
              }
              <TouchableOpacity onPress={onDismiss}><Text style={s.actBtnDanger}>✕</Text></TouchableOpacity>
            </View>
          )}
          {isDone && (
            <TouchableOpacity onPress={onDismiss}><Text style={s.actBtnMuted}>Clear</Text></TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionLabel}>{label}</Text>
      <View style={s.sectionBadge}><Text style={s.sectionCount}>{count}</Text></View>
    </View>
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
    if (!hasOverlay) {
      Alert.alert(
        'Overlay Permission Required',
        'Top Notch needs "Display over other apps" permission to show the camera ring.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => overlayBridge.requestOverlayPermission() },
        ]
      );
      return;
    }
    const hasNotif = await overlayBridge.hasNotificationPermission();
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
      {GESTURES.map(g => (
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

// ── Bottom Nav ────────────────────────────────────────────────────────────────

function NavTab({ icon, label, tab, active, onPress }: {
  icon: string; label: string; tab: Tab; active: Tab; onPress: (t: Tab) => void;
}) {
  const isActive = tab === active;
  return (
    <TouchableOpacity style={s.navTab} onPress={() => onPress(tab)} activeOpacity={0.7}>
      <Text style={[s.navIcon,  isActive && s.navIconActive]}>{icon}</Text>
      <Text style={[s.navLabel, isActive && s.navLabelActive]}>{label}</Text>
      {isActive && <View style={s.navDot} />}
    </TouchableOpacity>
  );
}

// ── Action Picker Modal ───────────────────────────────────────────────────────

function ActionPickerModal({ visible, gesture, selected, onSelect, onClose }: {
  visible: boolean; gesture: GestureKey | null; selected?: string;
  onSelect: (id: string) => void; onClose: () => void;
}) {
  const gestureLabel = GESTURES.find(g => g.key === gesture)?.label ?? '';
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.sheetBackdrop} onPress={onClose}>
        <Pressable style={[s.sheet, { maxHeight: '88%' }]} onPress={() => {}}>
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
                {group.items.map((item: any) => (
                  <TouchableOpacity key={item.id} style={s.pickerRow} onPress={() => onSelect(item.id)} activeOpacity={0.7}>
                    <View style={[s.radio, selected === item.id && s.radioSelected]} />
                    <Text style={s.pickerItemLabel}>{item.label}</Text>
                    {item.exclusive && <Text style={s.fireBadge}>🔥</Text>}
                    {item.isNew && (
                      <View style={s.newBadge}><Text style={s.newBadgeText}>NEW</Text></View>
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function kindLabel(kind: ActivityKind): string {
  return ({ download: 'Download', upload: 'Upload', music: 'Music', video: 'Video', cast: 'Cast', sync: 'Sync', call: 'Call' } as Record<ActivityKind, string>)[kind];
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b}B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)}KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)}MB`;
  return `${(b / 1024 ** 3).toFixed(2)}GB`;
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatProgress(a: Activity): string {
  if (a.kind === 'download' || a.kind === 'upload' || a.kind === 'sync') {
    return `${formatBytes(a.transferredBytes ?? 0)} / ${formatBytes(a.totalBytes ?? 0)}`;
  }
  if (a.kind === 'music' || a.kind === 'video') {
    return `${formatMs(a.elapsedMs ?? 0)} / ${formatMs(a.durationMs ?? 0)}`;
  }
  if (a.kind === 'call') return formatMs(a.elapsedMs ?? 0);
  if (a.kind === 'cast') return 'Live';
  return '';
}

function formatRight(a: Activity): string {
  if (a.speed && a.speed > 0) return `${formatBytes(a.speed)}/s`;
  if (a.kind === 'call') return 'Ongoing';
  if (a.kind === 'cast') return 'Streaming';
  return '';
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: BG },
  content: { flex: 1 },
  tabScroll: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 20 },

  // Progress Bar section title
  pbTitle: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 14, letterSpacing: -0.5 },

  // Style selector card
  styleCard:        { backgroundColor: CARD, borderRadius: 16, padding: 14, marginBottom: 16 },
  styleCardLabel:   { fontSize: 11, color: '#555', fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  styleRow:         { flexDirection: 'row', gap: 8 },
  styleBtn:         { flex: 1, alignItems: 'center', backgroundColor: '#181a1e', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 6, borderWidth: 1, borderColor: '#282828', gap: 2 },
  styleBtnActive:   { backgroundColor: BLUE + '18', borderColor: BLUE },
  styleBtnIcon:     { fontSize: 20, color: '#444' },
  styleBtnIconActive:{ color: BLUE },
  styleBtnLabel:    { fontSize: 12, fontWeight: '700', color: '#555' },
  styleBtnLabelActive:{ color: BLUE },
  styleBtnDesc:     { fontSize: 10, color: '#333' },

  // Tracking sources card
  sourcesCard:   { backgroundColor: CARD, borderRadius: 16, padding: 14, marginBottom: 12, marginTop: 4 },
  sourcesTitle:  { fontSize: 13, fontWeight: '700', color: '#aaa', marginBottom: 4 },
  sourcesDesc:   { fontSize: 11, color: '#444', marginBottom: 12 },
  sourcesGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sourceChip:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#181a1e', borderWidth: 1, borderColor: '#282828' },
  sourceChipIcon:{ fontSize: 13, color: '#444' },
  sourceChipLabel:{ fontSize: 12, fontWeight: '600', color: '#444' },

  // Settings link card
  settingsLinkCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16, marginBottom: 10, gap: 14 },
  settingsLinkIcon: { fontSize: 20, width: 30, textAlign: 'center', color: '#fff' },

  // Display options card
  displayCard:      { backgroundColor: CARD, borderRadius: 16, padding: 14, marginBottom: 12 },
  displayRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  displayRowBody:   { flex: 1 },
  displayRowLabel:  { fontSize: 14, fontWeight: '600', color: '#ddd' },
  displayRowDesc:   { fontSize: 11, color: '#444', marginTop: 2 },

  // Hero
  heroCard:     { backgroundColor: CARD, borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1 },
  heroTop:      { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  heroIconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  heroIcon:     { fontSize: 22 },
  heroMeta:     { flex: 1 },
  heroKindLabel:{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700', marginBottom: 2 },
  heroTitle:    { fontSize: 16, fontWeight: '700', color: '#fff' },
  heroSubtitle: { fontSize: 12, color: '#666', marginTop: 2 },
  statusPill:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusDot:    { width: 6, height: 6, borderRadius: 3 },
  statusText:   { fontSize: 11, fontWeight: '700' },
  heroBg:       { height: 5, backgroundColor: '#2a2a2a', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  heroBgLinear: { height: 10, borderRadius: 5 },
  heroFill:     { height: '100%', borderRadius: 3 },
  heroStats:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  heroStat:     { fontSize: 11, color: '#555', fontVariant: ['tabular-nums'] },
  heroPercent:  { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  heroControls: {},
  controlBtn:   { borderRadius: 12, paddingVertical: 11, alignItems: 'center', borderWidth: 1 },
  controlBtnText:{ fontSize: 14, fontWeight: '700' },

  // Activity card
  actCard:    { flexDirection: 'row', backgroundColor: CARD, borderRadius: 14, padding: 14, marginBottom: 9, gap: 12 },
  actIconWrap:{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actIcon:    { fontSize: 18 },
  actBody:    { flex: 1 },
  actHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  actTitle:   { fontSize: 14, fontWeight: '600', color: '#e0e0e0', flex: 1, marginRight: 8 },
  actPercent: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  doneTag:    { fontSize: 11, color: '#10b981', fontWeight: '700' },
  actSubtitle:{ fontSize: 11, color: '#555', marginBottom: 6 },
  actBarBg:   { height: 3, backgroundColor: '#2a2a2a', borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  actBarFill: { height: '100%', borderRadius: 2 },
  actFooter:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actMeta:    { fontSize: 11, color: '#444', fontVariant: ['tabular-nums'] },
  actActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  actBtn:     { fontSize: 12, fontWeight: '700' },
  actBtnMuted:{ fontSize: 12, color: '#555', fontWeight: '600' },
  actBtnDanger:{ fontSize: 14, color: '#555' },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 4 },
  sectionLabel:  { fontSize: 12, color: '#555', fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  sectionBadge:  { backgroundColor: '#222', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  sectionCount:  { fontSize: 11, color: '#555', fontWeight: '700' },

  // Empty state
  emptyHero:  { alignItems: 'center', paddingVertical: 52, backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: '#222', borderStyle: 'dashed', marginBottom: 16 },
  emptyRing:  { fontSize: 44, color: '#2a2a2a', marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#444' },
  emptyDesc:  { fontSize: 13, color: '#333', marginTop: 5, textAlign: 'center', lineHeight: 19 },
  hintText:   { fontSize: 13, color: '#333', textAlign: 'center', marginTop: 12 },

  // Modal sheet (used by ActionPickerModal)
  sheetBackdrop:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: '#16181c', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 10, maxHeight: '80%' },

  // Bottom nav
  bottomNav:     { flexDirection: 'row', backgroundColor: '#16181c', borderTopWidth: 1, borderTopColor: '#1e1e1e', paddingBottom: 8, paddingTop: 4 },
  navTab:        { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3 },
  navIcon:       { fontSize: 20, color: '#333' },
  navIconActive: { color: BLUE },
  navLabel:      { fontSize: 10, color: '#333', fontWeight: '600', letterSpacing: 0.5 },
  navLabelActive:{ color: BLUE },
  navDot:        { width: 4, height: 4, borderRadius: 2, backgroundColor: BLUE },

  // Gesture cards (actions tab)
  permBtn:     { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#1e2d3d', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16, marginBottom: 12 },
  permIcon:    { fontSize: 20 },
  permBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  gestureCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 18, marginBottom: 10, gap: 14 },
  gestureIcon: { fontSize: 22, width: 30, textAlign: 'center' },
  gestureBody: { flex: 1 },
  gestureLabel:{ fontSize: 16, fontWeight: '600', color: '#fff' },
  gestureValue:{ fontSize: 13, color: '#555', marginTop: 3 },
  gestureArrow:{ fontSize: 22, color: '#333' },

  // Picker modal
  pickerHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#1e1e1e' },
  pickerBackBtn:{ width: 38, height: 38, borderRadius: 10, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' },
  pickerBackIcon:{ fontSize: 24, color: BLUE, lineHeight: 30 },
  pickerTitle:  { fontSize: 20, fontWeight: '700', color: BLUE },
  pickerCategory:{ fontSize: 14, fontWeight: '700', color: BLUE, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  pickerRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 12, marginHorizontal: 12, marginBottom: 8, paddingHorizontal: 16, paddingVertical: 16, gap: 14 },
  radio:        { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#444' },
  radioSelected:{ borderColor: BLUE, backgroundColor: BLUE },
  pickerItemLabel:{ flex: 1, fontSize: 15, color: '#e0e0e0' },
  fireBadge:    { fontSize: 16 },
  newBadge:     { backgroundColor: '#2a2a2a', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#444' },
  newBadgeText: { fontSize: 10, color: '#aaa', fontWeight: '700', letterSpacing: 1 },
});
