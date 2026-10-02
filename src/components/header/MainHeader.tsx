import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuIcon } from '@/components/icons';
import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/hooks/useTheme';
import { formatClock } from '@/lib/dates';
import type { AppMode, LectureActivity } from '@/store/ui';

import { ModeSwitcher } from './ModeSwitcher';

/** Height of the header row below the status bar (plus a hairline border). */
export const HEADER_ROW_HEIGHT = 52;
const BORDER = StyleSheet.hairlineWidth * 2;

/** Total header height, e.g. for KeyboardAvoidingView offsets. */
export function headerHeight(topInset: number) {
  return topInset + HEADER_ROW_HEIGHT + BORDER;
}

interface MainHeaderProps {
  mode: AppMode;
  /** A lecture still recording or transcribing while another mode is open. */
  lecture: LectureActivity | null;
  onModeChange: (mode: AppMode) => void;
  onMenu: () => void;
  onUpgrade: () => void;
}

/** "● 12:34" while a lecture records in the background (a spinner while it transcribes); tap to go back to it. */
function LectureBadge({ lecture, onPress }: { lecture: LectureActivity; onPress: () => void }) {
  const { colors } = useTheme();
  const [now, setNow] = useState(Date.now);
  const recording = lecture.status === 'recording';

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  const elapsed = recording ? formatClock(Math.max(0, Math.floor((now - lecture.startedAt) / 1000))) : '';

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={recording ? `Recording lecture, ${elapsed}. Show recording` : 'Transcribing lecture. Show progress'}
      style={({ pressed }) => [styles.badge, { backgroundColor: colors.dangerSoft, opacity: pressed ? 0.75 : 1 }]}>
      {recording ? (
        <>
          <View style={[styles.badgeDot, { backgroundColor: colors.recordDot }]} />
          <AppText weight="semibold" size={14} color={colors.danger} style={styles.badgeTime}>
            {elapsed}
          </AppText>
        </>
      ) : (
        <ActivityIndicator size="small" color={colors.danger} />
      )}
    </Pressable>
  );
}

export function MainHeader({ mode, lecture, onModeChange, onMenu, onUpgrade }: MainHeaderProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.background, borderBottomColor: colors.hairline }]}>
      <View style={styles.row}>
        <Pressable onPress={onMenu} hitSlop={12} style={styles.menu} accessibilityRole="button" accessibilityLabel="Open menu">
          <MenuIcon size={21} color={colors.icon} />
        </Pressable>

        <View style={styles.center} pointerEvents="box-none">
          <ModeSwitcher mode={mode} onChange={onModeChange} />
        </View>

        {mode !== 'record' && lecture ? <LectureBadge lecture={lecture} onPress={() => onModeChange('record')} /> : null}

        {mode !== 'record' && !lecture ? (
          <Pressable
            onPress={onUpgrade}
            accessibilityRole="button"
            accessibilityLabel="Upgrade"
            style={({ pressed }) => [styles.upgrade, { backgroundColor: pressed ? colors.primaryPressed : colors.primary }]}>
            <AppText weight="medium" size={15} color={colors.onPrimary}>
              Upgrade
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { borderBottomWidth: BORDER },
  row: { height: HEADER_ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  menu: { width: 40, height: 40, justifyContent: 'center' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  upgrade: {
    marginLeft: 'auto',
    height: 30,
    paddingHorizontal: 7.5,
    borderRadius: 7,
    justifyContent: 'center',
  },
  badge: {
    marginLeft: 'auto',
    height: 30,
    minWidth: 44,
    paddingHorizontal: 10,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  badgeTime: { fontVariant: ['tabular-nums'] },
});
