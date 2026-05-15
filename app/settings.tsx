import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, Switch,
  TouchableOpacity, ScrollView, Linking, Animated, Modal, Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle } from 'react-native-svg';
import { overlayBridge } from '../src/services/OverlayBridge';

const SETTINGS_KEY = 'topnotch_settings';

// ── Mockup constants ──────────────────────────────────────────────────────────

const MOCK_W   = 200;
const MOCK_H   = 330;
const STATUS_H = 28;
const CAM_CX   = MOCK_W / 2;
const CAM_CY   = STATUS_H / 2;
const CAM_R    = 6;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Settings {
  barStyle:   string;
  lockScreen: boolean;
  fullscreen: boolean;
  matchColor: boolean;
  barColor:   string;
  blackBg:    boolean;
  rounded:    boolean;
  glow:       boolean;
  thickness:  number;
}

const DEFAULT_SETTINGS: Settings = {
  barStyle:   'circular',
  lockScreen: true,
  fullscreen: false,
  matchColor: false,
  barColor:   '#7c5cbf',
  blackBg:    false,
  rounded:    true,
  glow:       false,
  thickness:  6,
};

const ICONS: Record<string, string> = {
  style:      '◎',
  circular:   '◑',
  lockscreen: '⊟',
  fullscreen: '⛶',
  perapps:    '⋮⋮⋮',
  color:      '◈',
  paint:      '▣',
  background: '◐',
  rounded:    '▢',
  permission: '⬡',
  thickness:  '≡',
  glow:       '✦',
};

const COLORS = [
  { label: 'Violet',  hex: '#7c5cbf' },
  { label: 'Purple',  hex: '#a855f7' },
  { label: 'Pink',    hex: '#ec4899' },
  { label: 'Cyan',    hex: '#06b6d4' },
  { label: 'Emerald', hex: '#10b981' },
  { label: 'Amber',   hex: '#f59e0b' },
  { label: 'Red',     hex: '#ef4444' },
  { label: 'White',   hex: '#e8e8e8' },
];

const BAR_STYLES = [
  { label: 'Circular progress bar', value: 'circular' },
  { label: 'Linear progress bar',   value: 'linear'   },
  { label: 'Pill (around camera)',  value: 'pill'      },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [previewVisible,  setPreviewVisible]   = useState(false);

  // Preview internal state
  const previewScale = useRef(new Animated.Value(1)).current;
  const previewAnim  = useRef(new Animated.Value(0)).current;
  const [animProgress, setAnimProgress] = useState(0);
  const [pvStyle,    setPvStyle]   = useState<'bar' | 'circle'>('circle');
  const [pvOffsetX,  setPvOffsetX] = useState(0);
  const [pvOffsetY,  setPvOffsetY] = useState(0);

  // Load persisted settings on mount
  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then((raw) => {
      if (!raw) return;
      try { setS({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) }); } catch {}
    });
  }, []);

  // Drive animProgress state from Animated.Value (SVG needs plain number)
  useEffect(() => {
    const id = previewAnim.addListener(({ value }) => setAnimProgress(value));
    return () => previewAnim.removeListener(id);
  }, []);

  // Start/stop the looping progress animation when preview opens/closes
  useEffect(() => {
    if (!previewVisible) {
      previewAnim.stopAnimation();
      previewAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(previewAnim, { toValue: 1, duration: 3500, useNativeDriver: false }),
        Animated.delay(600),
        Animated.timing(previewAnim, { toValue: 0, duration: 250, useNativeDriver: false }),
        Animated.delay(400),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [previewVisible]);

  const update = useCallback((partial: Partial<Settings>) => {
    setS((prev) => {
      const next = { ...prev, ...partial };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      overlayBridge.applyConfig({
        enabled:               true,
        showAroundCamera:      next.barStyle !== 'linear',
        showInStatusBar:       true,
        showInNotificationDrawer: true,
        accentColor:           next.barColor,
        ringThickness:         next.thickness,
        glow:                  next.glow,
        matchColor:            next.matchColor,
        blackBg:               next.blackBg,
        rounded:               next.rounded,
      });
      return next;
    });
  }, []);

  const handlePreviewPress = () => {
    Animated.sequence([
      Animated.spring(previewScale, { toValue: 0.93, useNativeDriver: true, speed: 60 }),
      Animated.spring(previewScale, { toValue: 1,    useNativeDriver: true, speed: 30 }),
    ]).start(() => setPreviewVisible(true));
  };

  const nudge = (dx: number, dy: number) => {
    setPvOffsetX(x => Math.max(-30, Math.min(30, x + dx)));
    setPvOffsetY(y => Math.max(-10, Math.min(10, y + dy)));
  };

  const selectedStyleLabel = BAR_STYLES.find((b) => b.value === s.barStyle)?.label ?? '';
  const selectedColorLabel  = COLORS.find((c) => c.hex === s.barColor)?.label ?? 'Custom';

  // Derived preview values
  const ringR        = CAM_R + Math.max(2, s.thickness * 0.7) + 3;
  const circumference = 2 * Math.PI * ringR;
  const dashOffset   = circumference * (1 - animProgress);
  const barH         = Math.max(3, Math.min(s.thickness, 10));
  const barW         = animProgress * MOCK_W;

  return (
    <SafeAreaView style={st.root}>
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>

        <Text style={st.pageTitle}>Top Notch</Text>

        <SectionLabel label="general" />
        <Row icon={ICONS.style}      label="Select progress bar style"        desc={selectedStyleLabel}           onPress={() => setStylePickerOpen(true)} />
        <Row icon={ICONS.circular}   label="Circular progress bar tweaks"     desc="Adjust size and arc position"  onPress={() => {}} />
        <Row icon={ICONS.lockscreen} label="Show progress bar in lock screen" desc="Also shown in always on display" value={s.lockScreen} onToggle={(v) => update({ lockScreen: v })} />
        <Row icon={ICONS.fullscreen} label="Disable in fullscreen mode"       desc="Hide progress bar in fullscreen apps" value={s.fullscreen} onToggle={(v) => update({ fullscreen: v })} />

        <SectionLabel label="customization" />
        <Row icon={ICONS.perapps}    label="Per-app settings"            desc="Toggle Top Notch on per-app basis"        onPress={() => {}} />
        <Row icon={ICONS.color}      label="Match notification color"    desc="Use the notification's color"             value={s.matchColor} onToggle={(v) => update({ matchColor: v })} />
        <Row icon={ICONS.paint}      label="Change progress bar color"   desc={selectedColorLabel} rightDot={s.barColor} onPress={() => setColorPickerOpen(true)} />
        <Row icon={ICONS.background} label="Use black background"        desc="Switch to black track"                    value={s.blackBg}    onToggle={(v) => update({ blackBg: v })} />
        <Row icon={ICONS.rounded}    label="Rounded corners"             desc="Progress bar with rounded ends"           value={s.rounded}    onToggle={(v) => update({ rounded: v })} />
        <Row icon={ICONS.glow}       label="Glow effect"                 desc="Soft glow around the progress arc"        value={s.glow}       onToggle={(v) => update({ glow: v })} />

        <SectionLabel label="ring size" />
        <View style={st.stepperRow}>
          <Text style={st.rowIcon}>{ICONS.thickness}</Text>
          <View style={st.rowBody}>
            <Text style={st.rowLabel}>Ring thickness</Text>
            <Text style={st.rowDesc}>Controls the stroke width of the arc</Text>
          </View>
          <View style={st.stepper}>
            <TouchableOpacity style={st.stepBtn} onPress={() => update({ thickness: Math.max(2, s.thickness - 1) })}>
              <Text style={st.stepBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={st.stepValue}>{s.thickness}</Text>
            <TouchableOpacity style={st.stepBtn} onPress={() => update({ thickness: Math.min(16, s.thickness + 1) })}>
              <Text style={st.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <SectionLabel label="permissions" />
        <Row
          icon={ICONS.permission}
          label="Display over other apps"
          desc="Required for camera ring overlay"
          onPress={async () => {
            const ok = await overlayBridge.requestOverlayPermission();
            if (!ok) Linking.openSettings();
          }}
          arrow
        />
        <Row
          icon="🔔"
          label="Post notifications"
          desc="Required for download progress notification"
          onPress={async () => {
            const ok = await overlayBridge.requestNotificationPermission();
            if (!ok) Linking.openSettings();
          }}
          arrow
        />

        <SectionLabel label="more" />
        <View style={st.moreBlock}>
          <Text style={st.moreText}>Top Notch v1.0.0</Text>
          <Text style={st.moreText}>com.topnotch.progress · Expo SDK 54</Text>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Floating Preview button */}
      <Animated.View style={[st.previewWrap, { transform: [{ scale: previewScale }] }]}>
        <TouchableOpacity style={st.previewBtn} onPress={handlePreviewPress} activeOpacity={0.9}>
          <Text style={st.previewIcon}>▶</Text>
          <Text style={st.previewText}>Preview</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Style picker */}
      <Sheet visible={stylePickerOpen} onClose={() => setStylePickerOpen(false)} title="Progress bar style">
        {BAR_STYLES.map((item) => (
          <TouchableOpacity key={item.value} style={st.pickerRow} onPress={() => { update({ barStyle: item.value }); setStylePickerOpen(false); }}>
            <Text style={st.pickerLabel}>{item.label}</Text>
            {s.barStyle === item.value && <Text style={st.pickerCheck}>✓</Text>}
          </TouchableOpacity>
        ))}
      </Sheet>

      {/* Color picker */}
      <Sheet visible={colorPickerOpen} onClose={() => setColorPickerOpen(false)} title="Progress bar color">
        <View style={st.colorGrid}>
          {COLORS.map((c) => (
            <TouchableOpacity
              key={c.hex}
              style={[st.colorDot, { backgroundColor: c.hex }, s.barColor === c.hex && st.colorDotActive]}
              onPress={() => { update({ barColor: c.hex }); setColorPickerOpen(false); }}
            >
              {s.barColor === c.hex && <Text style={st.colorCheck}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </Sheet>

      {/* ── Interactive Preview Modal ── */}
      <Modal visible={previewVisible} transparent animationType="slide" onRequestClose={() => setPreviewVisible(false)}>
        <Pressable style={st.backdrop} onPress={() => setPreviewVisible(false)}>
          <Pressable style={st.pvSheet} onPress={() => {}}>
            <View style={st.handle} />
            <Text style={st.sheetTitle}>Preview</Text>

            {/* Style toggle */}
            <View style={st.pvStyleRow}>
              <TouchableOpacity
                style={[st.pvStyleTab, pvStyle === 'bar'    && st.pvStyleTabActive]}
                onPress={() => setPvStyle('bar')}
              >
                <Text style={[st.pvStyleTabIcon, pvStyle === 'bar'    && st.pvStyleTabIconActive]}>▬</Text>
                <Text style={[st.pvStyleTabText, pvStyle === 'bar'    && st.pvStyleTabTextActive]}>Linear Bar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.pvStyleTab, pvStyle === 'circle' && st.pvStyleTabActive]}
                onPress={() => setPvStyle('circle')}
              >
                <Text style={[st.pvStyleTabIcon, pvStyle === 'circle' && st.pvStyleTabIconActive]}>◎</Text>
                <Text style={[st.pvStyleTabText, pvStyle === 'circle' && st.pvStyleTabTextActive]}>Circle Ring</Text>
              </TouchableOpacity>
            </View>

            {/* Phone mockup */}
            <View style={st.pvMockWrap}>
              <View style={st.pvPhone}>

                {/* Status bar */}
                <View style={st.pvStatusBar}>
                  <Text style={st.pvTime}>9:41</Text>

                  {/* Camera hole + ring */}
                  <View style={st.pvCamArea}>
                    <View style={st.pvCamHole} />
                    {pvStyle === 'circle' && (
                      <Svg
                        width={MOCK_W}
                        height={STATUS_H}
                        style={StyleSheet.absoluteFill}
                        pointerEvents="none"
                      >
                        {/* Track */}
                        <Circle
                          cx={CAM_CX + pvOffsetX}
                          cy={CAM_CY + pvOffsetY}
                          r={ringR}
                          stroke={s.barColor + '30'}
                          strokeWidth={Math.max(1.5, s.thickness * 0.65)}
                          fill="none"
                        />
                        {/* Progress arc — clockwise from 12 o'clock */}
                        <Circle
                          cx={CAM_CX + pvOffsetX}
                          cy={CAM_CY + pvOffsetY}
                          r={ringR}
                          stroke={s.barColor}
                          strokeWidth={Math.max(1.5, s.thickness * 0.65)}
                          fill="none"
                          strokeDasharray={circumference}
                          strokeDashoffset={dashOffset}
                          strokeLinecap="round"
                          rotation="-90"
                          origin={`${CAM_CX + pvOffsetX},${CAM_CY + pvOffsetY}`}
                        />
                      </Svg>
                    )}
                  </View>

                  <Text style={st.pvIcons}>▲))) ▮▮</Text>
                </View>

                {/* Linear bar — fills left to right from top of phone */}
                {pvStyle === 'bar' && (
                  <View style={[st.pvLinearTrack, { height: barH }]}>
                    <View style={[st.pvLinearFill, {
                      width: barW,
                      height: barH,
                      backgroundColor: s.barColor,
                      borderRadius: s.rounded ? barH / 2 : 0,
                    }]} />
                  </View>
                )}

                {/* Screen content */}
                <View style={st.pvScreen}>
                  {/* Simulated app grid */}
                  {[0,1,2].map(row => (
                    <View key={row} style={st.pvAppRow}>
                      {[0,1,2,3].map(col => (
                        <View key={col} style={st.pvAppIcon} />
                      ))}
                    </View>
                  ))}
                </View>

              </View>

              {/* Progress % label */}
              <Text style={[st.pvPctLabel, { color: s.barColor }]}>
                {Math.round(animProgress * 100)}%
              </Text>
            </View>

            {/* Controls */}
            <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>

              {/* Circle position nudge */}
              {pvStyle === 'circle' && (
                <View style={st.pvControlBlock}>
                  <Text style={st.pvControlLabel}>POSITION</Text>
                  <View style={st.pvNudgeGrid}>
                    <View style={st.pvNudgeRow}>
                      <View style={st.pvNudgeSpacer} />
                      <TouchableOpacity style={st.pvNudgeBtn} onPress={() => nudge(0, -2)}>
                        <Text style={st.pvNudgeIcon}>↑</Text>
                      </TouchableOpacity>
                      <View style={st.pvNudgeSpacer} />
                    </View>
                    <View style={st.pvNudgeRow}>
                      <TouchableOpacity style={st.pvNudgeBtn} onPress={() => nudge(-4, 0)}>
                        <Text style={st.pvNudgeIcon}>←</Text>
                      </TouchableOpacity>
                      <View style={st.pvNudgeCenter}>
                        <Text style={st.pvNudgeCenterText}>{pvOffsetX},{pvOffsetY}</Text>
                      </View>
                      <TouchableOpacity style={st.pvNudgeBtn} onPress={() => nudge(4, 0)}>
                        <Text style={st.pvNudgeIcon}>→</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={st.pvNudgeRow}>
                      <View style={st.pvNudgeSpacer} />
                      <TouchableOpacity style={st.pvNudgeBtn} onPress={() => nudge(0, 2)}>
                        <Text style={st.pvNudgeIcon}>↓</Text>
                      </TouchableOpacity>
                      <View style={st.pvNudgeSpacer} />
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => { setPvOffsetX(0); setPvOffsetY(0); }} style={st.pvResetBtn}>
                    <Text style={st.pvResetText}>Reset position</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Thickness */}
              <View style={st.pvControlBlock}>
                <Text style={st.pvControlLabel}>THICKNESS</Text>
                <View style={st.pvThicknessRow}>
                  <TouchableOpacity style={st.pvThickBtn} onPress={() => update({ thickness: Math.max(2, s.thickness - 1) })}>
                    <Text style={st.pvThickBtnText}>−</Text>
                  </TouchableOpacity>
                  <View style={st.pvThickTrack}>
                    <View style={[st.pvThickFill, {
                      width: `${((s.thickness - 2) / 14) * 100}%` as any,
                      backgroundColor: s.barColor,
                    }]} />
                    <View style={[st.pvThickKnob, {
                      left: `${((s.thickness - 2) / 14) * 100}%` as any,
                      backgroundColor: s.barColor,
                    }]} />
                  </View>
                  <TouchableOpacity style={st.pvThickBtn} onPress={() => update({ thickness: Math.min(16, s.thickness + 1) })}>
                    <Text style={st.pvThickBtnText}>+</Text>
                  </TouchableOpacity>
                  <Text style={[st.pvThickValue, { color: s.barColor }]}>{s.thickness}px</Text>
                </View>
              </View>

              {/* Color */}
              <View style={st.pvControlBlock}>
                <Text style={st.pvControlLabel}>COLOR</Text>
                <View style={st.pvColorRow}>
                  {COLORS.map((c) => (
                    <TouchableOpacity
                      key={c.hex}
                      style={[st.pvColorDot, { backgroundColor: c.hex }, s.barColor === c.hex && { borderColor: '#fff', borderWidth: 2.5 }]}
                      onPress={() => update({ barColor: c.hex })}
                    />
                  ))}
                </View>
              </View>

            </ScrollView>

          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return <Text style={st.sectionLabel}>{label}</Text>;
}

interface RowProps {
  icon: string; label: string; desc?: string;
  value?: boolean; onToggle?: (v: boolean) => void;
  onPress?: () => void; arrow?: boolean; rightDot?: string;
}
function Row({ icon, label, desc, value, onToggle, onPress, arrow, rightDot }: RowProps) {
  const hasToggle = value !== undefined && onToggle;
  const Wrap: any = onPress ? TouchableOpacity : View;
  return (
    <Wrap style={st.row} onPress={onPress} activeOpacity={0.65}>
      <Text style={st.rowIcon}>{icon}</Text>
      <View style={st.rowBody}>
        <Text style={st.rowLabel}>{label}</Text>
        {desc ? <Text style={st.rowDesc}>{desc}</Text> : null}
      </View>
      {rightDot && <View style={[st.rightDot, { backgroundColor: rightDot }]} />}
      {hasToggle && <Switch value={value} onValueChange={onToggle} trackColor={{ false: '#2a2a2a', true: '#7c5cbf' }} thumbColor={value ? '#e0d0ff' : '#888'} />}
      {arrow && !hasToggle && <Text style={st.arrow}>›</Text>}
    </Wrap>
  );
}

function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose}>
        <Pressable style={st.sheet} onPress={() => {}}>
          <View style={st.handle} />
          <Text style={st.sheetTitle}>{title}</Text>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const BLUE = '#4a9eff';

const st = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#111111' },
  scroll:      { paddingTop: 16, paddingBottom: 20 },
  pageTitle:   { fontSize: 32, fontWeight: '700', color: '#fff', paddingHorizontal: 20, marginBottom: 8, letterSpacing: -0.5 },
  sectionLabel:{ fontSize: 13, color: '#666', paddingHorizontal: 20, marginTop: 28, marginBottom: 4 },

  row:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 16 },
  rowIcon:     { fontSize: 20, color: '#fff', width: 28, textAlign: 'center' },
  rowBody:     { flex: 1 },
  rowLabel:    { fontSize: 15, fontWeight: '600', color: '#fff', lineHeight: 20 },
  rowDesc:     { fontSize: 13, color: '#888', marginTop: 2, lineHeight: 17 },
  rightDot:    { width: 22, height: 22, borderRadius: 11, marginRight: 4 },
  arrow:       { fontSize: 22, color: '#555' },

  stepperRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 16 },
  stepper:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1e1e1e', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6 },
  stepBtn:     { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#2a2a2a' },
  stepBtnText: { fontSize: 20, color: '#fff', lineHeight: 24 },
  stepValue:   { fontSize: 16, fontWeight: '700', color: '#fff', minWidth: 22, textAlign: 'center' },

  moreBlock:   { paddingHorizontal: 20, paddingVertical: 10, gap: 4 },
  moreText:    { fontSize: 12, color: '#444' },

  previewWrap: { position: 'absolute', bottom: 28, right: 20 },
  previewBtn:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#5b3fa6', borderRadius: 28, paddingHorizontal: 24, paddingVertical: 16, shadowColor: '#5b3fa6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 12 },
  previewIcon: { fontSize: 14, color: '#fff' },
  previewText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: '#1a1a1a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 44 },
  pvSheet:     { backgroundColor: '#111316', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, paddingBottom: 32, maxHeight: '95%' },
  handle:      { width: 36, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle:  { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 16, paddingHorizontal: 20 },

  pickerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#222' },
  pickerLabel: { fontSize: 15, color: '#fff' },
  pickerCheck: { fontSize: 16, color: '#7c5cbf', fontWeight: '700' },

  colorGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingVertical: 8 },
  colorDot:    { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  colorDotActive: { borderWidth: 3, borderColor: '#fff' },
  colorCheck:  { fontSize: 22, color: '#fff', fontWeight: '800' },

  // ── Preview modal ────────────────────────────────────────────────────────────

  pvStyleRow:  { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 20 },
  pvStyleTab:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, backgroundColor: '#1e2025', borderWidth: 1, borderColor: '#282828' },
  pvStyleTabActive: { backgroundColor: '#1a2233', borderColor: BLUE },
  pvStyleTabIcon:   { fontSize: 18, color: '#444' },
  pvStyleTabIconActive: { color: BLUE },
  pvStyleTabText:   { fontSize: 14, fontWeight: '600', color: '#555' },
  pvStyleTabTextActive: { color: BLUE },

  pvMockWrap:  { alignItems: 'center', marginBottom: 16 },
  pvPhone:     {
    width: MOCK_W,
    height: MOCK_H,
    backgroundColor: '#0a0a0a',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
  },

  pvStatusBar: {
    height: STATUS_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    backgroundColor: '#050505',
  },
  pvTime:      { fontSize: 9, fontWeight: '700', color: '#fff' },
  pvCamArea:   { flex: 1, height: STATUS_H, alignItems: 'center', justifyContent: 'center' },
  pvCamHole:   { width: CAM_R * 2, height: CAM_R * 2, borderRadius: CAM_R, backgroundColor: '#000' },
  pvIcons:     { fontSize: 7, color: '#fff', letterSpacing: 0.5 },

  pvLinearTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: MOCK_W,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  pvLinearFill: { position: 'absolute', top: 0, left: 0 },

  pvScreen:    { flex: 1, padding: 12, gap: 10 },
  pvAppRow:    { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  pvAppIcon:   { width: 36, height: 36, borderRadius: 10, backgroundColor: '#1e2025' },

  pvPctLabel:  { fontSize: 22, fontWeight: '800', marginTop: 8 },

  // Controls
  pvControlBlock: { paddingHorizontal: 20, paddingBottom: 18 },
  pvControlLabel: { fontSize: 10, fontWeight: '700', color: '#444', letterSpacing: 1.5, marginBottom: 12 },

  pvNudgeGrid:  { alignItems: 'center', gap: 6 },
  pvNudgeRow:   { flexDirection: 'row', gap: 6, alignItems: 'center' },
  pvNudgeBtn:   { width: 44, height: 44, borderRadius: 12, backgroundColor: '#1e2025', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#282828' },
  pvNudgeIcon:  { fontSize: 18, color: '#aaa' },
  pvNudgeSpacer:{ width: 44, height: 44 },
  pvNudgeCenter:{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f0f0f', borderRadius: 10 },
  pvNudgeCenterText: { fontSize: 7, color: '#444', textAlign: 'center' },
  pvResetBtn:   { alignSelf: 'center', marginTop: 10 },
  pvResetText:  { fontSize: 12, color: '#555' },

  pvThicknessRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pvThickBtn:  { width: 36, height: 36, borderRadius: 10, backgroundColor: '#1e2025', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#282828' },
  pvThickBtnText: { fontSize: 20, color: '#fff', lineHeight: 24 },
  pvThickTrack:{ flex: 1, height: 6, backgroundColor: '#1e2025', borderRadius: 3, overflow: 'visible', position: 'relative' },
  pvThickFill: { position: 'absolute', top: 0, left: 0, height: 6, borderRadius: 3 },
  pvThickKnob: { position: 'absolute', top: -5, width: 16, height: 16, borderRadius: 8, marginLeft: -8 },
  pvThickValue:{ fontSize: 13, fontWeight: '700', minWidth: 36, textAlign: 'right' },

  pvColorRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pvColorDot:  { width: 36, height: 36, borderRadius: 18 },
});
