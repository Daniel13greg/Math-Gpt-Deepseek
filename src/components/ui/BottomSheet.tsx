import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

import { AppText } from './AppText';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

const OPEN = { duration: 260, easing: Easing.out(Easing.cubic) };
const CLOSE = { duration: 200, easing: Easing.in(Easing.cubic) };

/** Modal sheet with a grabber and drag-to-dismiss, styled like the MathGPT Tools sheet. */
export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  // Mount as soon as we become visible (adjusting state during render, not in an effect).
  if (visible && !mounted) setMounted(true);
  const height = useSharedValue(600);
  const translateY = useSharedValue(1000);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.set(withTiming(0, OPEN));
      backdrop.set(withTiming(1, OPEN));
    } else {
      backdrop.set(withTiming(0, CLOSE));
      translateY.set(
        withTiming(Math.max(height.get(), 400), CLOSE, (finished) => {
          if (finished) scheduleOnRN(setMounted, false);
        }),
      );
    }
  }, [visible, backdrop, translateY, height]);

  const onLayout = (e: LayoutChangeEvent) => height.set(e.nativeEvent.layout.height);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateY.set(Math.max(0, e.translationY));
    })
    .onEnd((e) => {
      if (e.translationY > height.get() * 0.3 || e.velocityY > 900) {
        scheduleOnRN(onClose);
      } else {
        translateY.set(withTiming(0, OPEN));
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() }));

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.backdrop }, backdropStyle]}>
          <Pressable accessibilityRole="button" style={styles.fill} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <View style={styles.anchor} pointerEvents="box-none">
          <Animated.View
            onLayout={onLayout}
            style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 16) + 12 }, sheetStyle]}>
            <GestureDetector gesture={pan}>
              <View style={styles.handleArea}>
                <View style={[styles.grabber, { backgroundColor: colors.grabber }]} />
                {title ? (
                  <AppText weight="medium" size={18} color={colors.icon} style={styles.title}>
                    {title}
                  </AppText>
                ) : null}
              </View>
            </GestureDetector>
            {children}
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  anchor: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleArea: { paddingTop: 10, paddingBottom: 6 },
  grabber: { alignSelf: 'center', width: 29, height: 4, borderRadius: 2 },
  title: { marginTop: 18, marginLeft: 24, marginBottom: 4 },
});
