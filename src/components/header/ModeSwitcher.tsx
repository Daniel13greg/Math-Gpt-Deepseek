import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { CameraIcon, KeyboardIcon, MicIcon } from '@/components/icons';
import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/hooks/useTheme';
import type { AppMode } from '@/store/ui';

const SEGMENTS: { mode: AppMode; label: string; Icon: typeof CameraIcon; a11y: string }[] = [
  { mode: 'camera', label: 'Scan', Icon: CameraIcon, a11y: 'Scan a problem with the camera' },
  { mode: 'chat', label: 'Chat', Icon: KeyboardIcon, a11y: 'Type a question' },
  { mode: 'record', label: 'Record', Icon: MicIcon, a11y: 'Record lecture notes' },
];

const layout = LinearTransition.duration(220);

/** The Camera | Chat | Record pill in the header. The active segment expands to show its label. */
export function ModeSwitcher({ mode, onChange }: { mode: AppMode; onChange: (mode: AppMode) => void }) {
  const { colors, dark } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.segmentBg }]} accessibilityRole="tablist">
      {SEGMENTS.map(({ mode: m, label, Icon, a11y }) => {
        const selected = m === mode;
        return (
          <Animated.View key={m} layout={layout}>
            <Pressable
              onPress={() => onChange(m)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={a11y}
              hitSlop={4}
              style={[
                styles.segment,
                selected && [styles.selected, { backgroundColor: colors.segmentSelected }, !dark && styles.selectedShadow],
              ]}>
              <Icon size={selected ? 19 : 20} color={colors.segmentText} strokeWidth={1.9} />
              {selected ? (
                <Animated.View entering={FadeIn.duration(180)}>
                  <AppText size={15} color={colors.segmentText} style={styles.label}>
                    {label}
                  </AppText>
                </Animated.View>
              ) : null}
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 2,
    height: 34,
  },
  segment: {
    height: 30,
    minWidth: 36,
    paddingHorizontal: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { paddingHorizontal: 12, gap: 6 },
  selectedShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  label: { marginTop: -1 },
});
