import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { DIAGRAM_KINDS, TOOL_KINDS, type ToolSelection } from '@/constants/tools';
import { ChevronDownIcon } from '@/components/icons';
import { AppText } from '@/components/ui/AppText';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';

import { ToolIcon } from './ToolIcon';

interface ToolsSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (tool: ToolSelection) => void;
}

function Chevron({ open, color }: { open: boolean; color: string }) {
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: withTiming(open ? '180deg' : '0deg', { duration: 180 }) }] }));
  return (
    <Animated.View style={style}>
      <ChevronDownIcon size={22} color={color} strokeWidth={2} />
    </Animated.View>
  );
}

/** "Tools" bottom sheet: video, practice test/question, graph, diagram (expandable), study guide, flashcards. */
export function ToolsSheet({ visible, onClose, onSelect }: ToolsSheetProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const [diagramOpen, setDiagramOpen] = useState(false);

  const choose = (tool: ToolSelection) => {
    onSelect(tool);
    onClose();
    setDiagramOpen(false);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('tools.title')}>
      <View style={styles.list}>
        {TOOL_KINDS.map((kind) => {
          const isDiagram = kind === 'diagram';
          return (
            <View key={kind}>
              <Pressable
                onPress={() => (isDiagram ? setDiagramOpen((o) => !o) : choose({ kind }))}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
                accessibilityRole="button"
                accessibilityState={isDiagram ? { expanded: diagramOpen } : undefined}>
                <ToolIcon kind={kind} size={24} color={colors.icon} />
                <AppText size={18} color={colors.icon} style={styles.label}>
                  {t(`tool.${kind}.title`)}
                </AppText>
                {isDiagram ? <Chevron open={diagramOpen} color={colors.icon} /> : null}
              </Pressable>
              {isDiagram && diagramOpen ? (
                <Animated.View entering={FadeIn.duration(160)} style={styles.subList}>
                  {DIAGRAM_KINDS.map((d) => (
                    <Pressable
                      accessibilityRole="button"
                      key={d}
                      onPress={() => choose({ kind: 'diagram', diagram: d })}
                      style={({ pressed }) => [styles.subRow, pressed && { backgroundColor: colors.surface }]}>
                      <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
                      <AppText size={16} color={colors.icon}>
                        {t(`diagram.${d}.title`)}
                      </AppText>
                    </Pressable>
                  ))}
                </Animated.View>
              ) : null}
            </View>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', height: 48, paddingLeft: 24, paddingRight: 26, gap: 10 },
  label: { flex: 1 },
  subList: { paddingBottom: 4 },
  subRow: { flexDirection: 'row', alignItems: 'center', height: 42, paddingLeft: 58, gap: 12 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
