import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, Switch,
  TouchableOpacity, ScrollView, Linking, Animated, Modal, Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { overlayBridge } from '../src/services/OverlayBridge';

const SETTINGS_KEY = 'topnotch_settings';

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

export default function SettingsScreen() {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [previewVisible,  setPreviewVisible]   = useState(false);
  const previewScale = useRef(new Animated.Value(1)).current;

  // Load persisted settings on mount
  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then((raw) => {
      if (!raw) return;
      try { setS({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) }); } catch {}
    });
  }, []);

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

  const selectedStyleLabel = BAR_STYLES.find((b) => b.value === s.barStyle)?.label ?? '';
  const selectedColorLabel  = COLORS.find((c) => c.hex === s.barColor)?.label ?? 'Custom';

  return (
    <SafeAreaView style={st.root}>
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>

        <Text style={st.pageTitle}>Top Notch</Text>

        <SectionLabel label="general" />
        <Row icon={ICONS.style}      label="Select progress bar style"        desc={selectedStyleLabel}      onPress={() => setStylePickerOpen(true)} />
        <Row icon={ICONS.circular}   label="Circular progress bar tweaks"     desc="Adjust size and arc position" onPress={() => {}} />
        <Row icon={ICONS.lockscreen} label="Show progress bar in lock screen" desc="Also shown in always on display" value={s.lockScreen} onToggle={(v) => update({ lockScreen: v })} />
        <Row icon={ICONS.fullscreen} label="Disable in fullscreen mode"       desc="Hide progress bar in fullscreen apps" value={s.fullscreen} onToggle={(v) => update({ fullscreen: v })} />

        <SectionLabel label="customization" />
        <Row icon={ICONS.perapps}    label="Per-app settings"            desc="Toggle Top Notch on per-app basis"          onPress={() => {}} />
        <Row icon={ICONS.color}      label="Match notification color"    desc="Use the notification's color"               value={s.matchColor} onToggle={(v) => update({ matchColor: v })} />
        <Row icon={ICONS.paint}      label="Change progress bar color"   desc={selectedColorLabel} rightDot={s.barColor}   onPress={() => setColorPickerOpen(true)} />
        <Row icon={ICONS.background} label="Use black background"        desc="Switch to black track"                      value={s.blackBg}    onToggle={(v) => update({ blackBg: v })} />
        <Row icon={ICONS.rounded}    label="Rounded corners"             desc="Progress bar with rounded ends"             value={s.rounded}    onToggle={(v) => update({ rounded: v })} />
        <Row icon={ICONS.glow}       label="Glow effect"                 desc="Soft glow around the progress arc"          value={s.glow}       onToggle={(v) => update({ glow: v })} />

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

      {/* Preview modal */}
      <Sheet visible={previewVisible} onClose={() => setPreviewVisible(false)} title="Preview">
        <View style={st.previewDemo}>
          <View style={st.fakeBar}>
            <Text style={st.fakeTime}>9:41</Text>
            <View style={st.fakeCam}>
              <View style={[st.fakeRing, { borderColor: s.barColor }]} />
              <View style={st.fakeLens} />
            </View>
            <Text style={st.fakeIcons}>▲ ))) ▮▮</Text>
          </View>
          <View style={[st.fakePill, { borderColor: s.barColor }]}>
            <View style={[st.fakePillFill, { backgroundColor: s.barColor, width: '65%' }]} />
          </View>
          <Text style={st.previewNote}>Ring shown at 65% · tap outside to close</Text>
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

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

  backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: '#1a1a1a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 44 },
  handle:      { width: 36, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle:  { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 16 },

  pickerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#222' },
  pickerLabel: { fontSize: 15, color: '#fff' },
  pickerCheck: { fontSize: 16, color: '#7c5cbf', fontWeight: '700' },

  colorGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingVertical: 8 },
  colorDot:    { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  colorDotActive: { borderWidth: 3, borderColor: '#fff' },
  colorCheck:  { fontSize: 22, color: '#fff', fontWeight: '800' },

  previewDemo: { gap: 16, paddingVertical: 8 },
  fakeBar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#000', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  fakeTime:    { color: '#fff', fontWeight: '600', fontSize: 14 },
  fakeCam:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  fakeRing:    { position: 'absolute', width: 34, height: 34, borderRadius: 17, borderWidth: 3 },
  fakeLens:    { width: 14, height: 14, borderRadius: 7, backgroundColor: '#1a1a1a' },
  fakeIcons:   { color: '#fff', fontSize: 10, letterSpacing: 1 },
  fakePill:    { height: 6, backgroundColor: '#1e1e1e', borderRadius: 3, overflow: 'hidden', borderWidth: 1 },
  fakePillFill:{ height: '100%', borderRadius: 3 },
  previewNote: { fontSize: 12, color: '#555', textAlign: 'center' },
});
