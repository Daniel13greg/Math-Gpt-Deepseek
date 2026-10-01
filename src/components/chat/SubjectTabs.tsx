import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, type LayoutRectangle } from 'react-native';

import { SUBJECTS, type SubjectId } from '@/constants/subjects';
import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';

/** Horizontally scrolling subject picker (Math, Physics, Accounting, Chemistry, ...). */
export function SubjectTabs({ value, onChange }: { value: SubjectId; onChange: (id: SubjectId) => void }) {
  const { colors } = useTheme();
  const { t } = useT();
  const scrollRef = useRef<ScrollView>(null);
  const layouts = useRef<Partial<Record<SubjectId, LayoutRectangle>>>({});

  useEffect(() => {
    const layout = layouts.current[value];
    if (layout) scrollRef.current?.scrollTo({ x: Math.max(0, layout.x - 24), animated: true });
  }, [value]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      accessibilityRole="tablist">
      {SUBJECTS.map((s) => {
        const active = s.id === value;
        return (
          <Pressable
            key={s.id}
            onPress={() => onChange(s.id)}
            onLayout={(e) => {
              layouts.current[s.id] = e.nativeEvent.layout;
            }}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}>
            <AppText size={15.5} weight="semibold" color={active ? colors.textStrong : colors.tabInactive}>
              {t(`subject.${s.id}`)}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 23, gap: 23, alignItems: 'center', height: 38 },
});
