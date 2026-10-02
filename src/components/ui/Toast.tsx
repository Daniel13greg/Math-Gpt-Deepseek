import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/store/toast';

import { AppText } from './AppText';

/** Global toast host; render once near the root. */
export function ToastHost() {
  const { id, message, kind, action, hide } = useToast();
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!message) return;
    // Screen readers don't notice a view appearing; read the message out.
    AccessibilityInfo.announceForAccessibility(message);
    const timer = setTimeout(hide, action ? 6000 : 3500);
    return () => clearTimeout(timer);
  }, [id, message, action, hide]);

  if (!message) return null;

  const background = kind === 'error' ? colors.danger : dark ? '#2C2E33' : '#1F2023';

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 62 }]}>
      <Animated.View
        key={id}
        entering={FadeInUp.duration(180)}
        exiting={FadeOutUp.duration(160)}
        style={[styles.toast, { backgroundColor: background }]}>
        <Pressable style={styles.row} onPress={hide} accessibilityRole="alert">
          <AppText size={14} weight="medium" color="#FFFFFF" style={styles.text}>
            {message}
          </AppText>
          {action ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                hide();
                action.onPress();
              }}>
              <AppText size={14} weight="semibold" color={kind === 'error' ? '#FFFFFF' : colors.primary} style={styles.action}>
                {action.label}
              </AppText>
            </Pressable>
          ) : null}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 100, paddingHorizontal: 16 },
  toast: {
    maxWidth: 520,
    width: '100%',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1 },
  action: { textDecorationLine: 'underline' },
});
