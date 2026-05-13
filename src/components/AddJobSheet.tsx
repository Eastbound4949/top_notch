import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';

// Preset download jobs for quick-add
const PRESETS = [
  { name: 'Ubuntu 24.04 ISO', url: 'https://releases.ubuntu.com/noble/ubuntu-24.04-desktop-amd64.iso', size: 6_200_000_000 },
  { name: 'Blender 4.0', url: 'https://download.blender.org/release/Blender4.0/blender-4.0.tar.xz', size: 220_000_000 },
  { name: 'Android Studio', url: 'https://dl.google.com/dl/android/studio/ide-zips/2024.1.1.11/android-studio-2024.1.1.11-linux.tar.gz', size: 1_050_000_000 },
  { name: 'Sample Video (HD)', url: 'https://example.com/video.mp4', size: 800_000_000 },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (name: string, url: string, totalBytes: number) => void;
}

export function AddJobSheet({ visible, onClose, onAdd }: Props) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [size, setSize] = useState('');
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 10,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handlePreset = (preset: typeof PRESETS[0]) => {
    setName(preset.name);
    setUrl(preset.url);
    setSize((preset.size / (1024 * 1024)).toFixed(0)); // MB
  };

  const handleAdd = () => {
    if (!name.trim() || !url.trim()) return;
    const bytes = parseFloat(size) * 1024 * 1024 || 500_000_000;
    onAdd(name.trim(), url.trim(), bytes);
    setName('');
    setUrl('');
    setSize('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kavContainer}
        >
          <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.handle} />
            <Text style={styles.title}>New Download</Text>

            {/* Presets */}
            <Text style={styles.sectionLabel}>Quick Add</Text>
            <View style={styles.presets}>
              {PRESETS.map((p) => (
                <TouchableOpacity key={p.name} style={styles.preset} onPress={() => handlePreset(p)}>
                  <Text style={styles.presetText} numberOfLines={1}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom */}
            <Text style={styles.sectionLabel}>Custom</Text>
            <TextInput
              style={styles.input}
              placeholder="Job name"
              placeholderTextColor="rgba(232,213,255,0.3)"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder="Download URL"
              placeholderTextColor="rgba(232,213,255,0.3)"
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
            <TextInput
              style={styles.input}
              placeholder="File size (MB)"
              placeholderTextColor="rgba(232,213,255,0.3)"
              value={size}
              onChangeText={setSize}
              keyboardType="numeric"
            />

            <TouchableOpacity
              style={[styles.addBtn, (!name || !url) && styles.addBtnDisabled]}
              onPress={handleAdd}
              disabled={!name || !url}
            >
              <Text style={styles.addBtnText}>Add to Queue</Text>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  kavContainer: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1625',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(124,92,191,0.25)',
    borderBottomWidth: 0,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(124,92,191,0.4)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#e8d5ff',
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(232,213,255,0.4)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  preset: {
    backgroundColor: 'rgba(124,92,191,0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(124,92,191,0.25)',
  },
  presetText: {
    color: '#c084fc',
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 140,
  },
  input: {
    backgroundColor: '#0f0d16',
    borderRadius: 12,
    padding: 14,
    color: '#e8d5ff',
    fontSize: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(124,92,191,0.2)',
  },
  addBtn: {
    backgroundColor: '#7c5cbf',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  addBtnDisabled: {
    opacity: 0.4,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
