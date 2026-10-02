import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronDownIcon, MenuIcon } from '@/components/icons';
import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import { modelLabel, modelName } from '@/lib/ai/models';
import { formatClock } from '@/lib/dates';
import { useSettings } from '@/store/settings';
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
  onModelPress: () => void;
}

/** The current model ("Flash ▾"); opens the model picker. */
function ModelButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const { t } = useT();
  const model = useSettings((s) => s.model);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('header.model.a11y', { model: modelLabel(model) })}
      style={({ pressed }) => [styles.model, { backgroundColor: pressed ? colors.surfacePressed : colors.segmentBg }]}>
      <AppText weight="semibold" size={14.5} color={colors.text} numberOfLines={1} style={styles.modelName}>
        {modelName(model, t('header.model.custom'))}
      </AppText>
      <ChevronDownIcon size={15} color={colors.textSecondary} strokeWidth={2.2} />
    </Pressable>
  );
}

/** "● 12:34" while a lecture records in the background (a spinner while it transcribes); tap to go back to it. */
function LectureBadge({ lecture, onPress }: { lecture: LectureActivity; onPress: () => void }) {
  const { colors } = useTheme();
  const { t } = useT();
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
      accessibilityLabel={recording ? t('header.lecture.recording', { time: elapsed }) : t('header.lecture.processing')}
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

export function MainHeader({ mode, lecture, onModeChange, onMenu, onModelPress }: MainHeaderProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.background, borderBottomColor: colors.hairline }]}>
      <View style={styles.row}>
        <Pressable onPress={onMenu} hitSlop={12} style={styles.menu} accessibilityRole="button" accessibilityLabel={t('header.menu')}>
          <MenuIcon size={21} color={colors.icon} />
        </Pressable>

        <View style={styles.center} pointerEvents="box-none">
          <ModeSwitcher mode={mode} onChange={onModeChange} />
        </View>

        {mode !== 'record' && lecture ? <LectureBadge lecture={lecture} onPress={() => onModeChange('record')} /> : null}

        {mode !== 'record' && !lecture ? <ModelButton onPress={onModelPress} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { borderBottomWidth: BORDER },
  row: { height: HEADER_ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  menu: { width: 40, height: 40, justifyContent: 'center' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  model: {
    marginLeft: 'auto',
    height: 32,
    maxWidth: 104,
    paddingLeft: 12,
    paddingRight: 9,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  modelName: { flexShrink: 1 },
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
