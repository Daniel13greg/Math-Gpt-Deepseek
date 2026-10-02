import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { LayersIcon } from '@/components/icons';
import { AppText } from '@/components/ui/AppText';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import { useProblemPicker } from '@/store/problemPicker';

/** "Which problem should I solve?" for photos with several exercises. Dismissing solves them all. */
export function ProblemPicker() {
  const { colors } = useTheme();
  const { t } = useT();
  const problems = useProblemPicker((s) => s.problems);
  const answer = useProblemPicker((s) => s.answer);

  return (
    <BottomSheet visible={problems !== null} onClose={() => answer('all')} title={t('picker.title')}>
      <ScrollView style={styles.list} contentContainerStyle={styles.content}>
        {(problems ?? []).map((p) => (
          <Pressable
            key={`${p.label}:${p.text}`}
            onPress={() => answer(p)}
            accessibilityRole="button"
            accessibilityLabel={t('picker.problem', { label: p.label, text: p.text })}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}>
            <View style={[styles.label, { backgroundColor: colors.primarySoft }]}>
              <AppText size={14} weight="semibold" color={colors.primary} numberOfLines={1}>
                {p.label}
              </AppText>
            </View>
            <AppText size={16} numberOfLines={3} style={styles.text}>
              {p.text}
            </AppText>
          </Pressable>
        ))}
        <View style={[styles.divider, { backgroundColor: colors.hairline }]} />
        <Pressable
          onPress={() => answer('all')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}>
          <View style={styles.allIcon}>
            <LayersIcon size={22} color={colors.icon} strokeWidth={1.8} />
          </View>
          <AppText size={16} weight="medium" style={styles.text}>
            {t('picker.all')}
          </AppText>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 460 },
  content: { paddingTop: 6, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingVertical: 11, minHeight: 52 },
  label: { minWidth: 34, height: 30, borderRadius: 15, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  allIcon: { width: 34, alignItems: 'center' },
  text: { flex: 1 },
  divider: { height: 1, marginHorizontal: 24, marginVertical: 6 },
});
