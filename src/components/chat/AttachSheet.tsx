import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  BrainIcon,
  CameraIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  GraduationCapIcon,
  ImageIcon,
  SparklesIcon,
} from '@/components/icons';
import { AppText } from '@/components/ui/AppText';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ANSWER_STYLES } from '@/constants/answerStyles';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import { modelLabel } from '@/lib/ai/models';
import { useSettings } from '@/store/settings';

interface AttachSheetProps {
  visible: boolean;
  onClose: () => void;
  onCamera: () => void;
  onLibrary: () => void;
  onModel: () => void;
}

interface RowProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
}

function Row({ icon, title, subtitle, onPress, right, expanded }: RowProps & { expanded?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      style={({ pressed }) => [styles.row, pressed && onPress && { backgroundColor: colors.surface }]}>
      {icon}
      <View style={styles.text}>
        <AppText size={17} color={colors.icon}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText size={13} secondary>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

/** The composer "+" menu: photo sources, answer style, the Deep Think toggle and a model shortcut. */
export function AttachSheet({ visible, onClose, onCamera, onLibrary, onModel }: AttachSheetProps) {
  const { colors } = useTheme();
  const thinking = useSettings((s) => s.thinking);
  const model = useSettings((s) => s.model);
  const answerStyle = useSettings((s) => s.answerStyle);
  const update = useSettings((s) => s.update);
  const [stylesOpen, setStylesOpen] = useState(false);
  const { t } = useT();

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('attach.title')}>
      <View style={styles.list}>
        <Row
          icon={<CameraIcon size={24} color={colors.icon} strokeWidth={1.8} />}
          title={t('attach.camera')}
          subtitle={t('attach.camera.detail')}
          onPress={() => {
            onClose();
            onCamera();
          }}
        />
        <Row
          icon={<ImageIcon size={24} color={colors.icon} strokeWidth={1.8} />}
          title={t('attach.library')}
          subtitle={t('attach.library.detail')}
          onPress={() => {
            onClose();
            onLibrary();
          }}
        />
        <View style={[styles.divider, { backgroundColor: colors.hairline }]} />
        <Row
          icon={<GraduationCapIcon size={24} color={colors.icon} strokeWidth={1.8} />}
          title={t('answerStyle.title')}
          subtitle={t(`answerStyle.${answerStyle}`)}
          expanded={stylesOpen}
          onPress={() => setStylesOpen((o) => !o)}
          right={
            <View style={stylesOpen && styles.flipped}>
              <ChevronDownIcon size={20} color={colors.textMuted} />
            </View>
          }
        />
        {stylesOpen ? (
          <Animated.View entering={FadeIn.duration(160)} accessibilityRole="radiogroup">
            {ANSWER_STYLES.map((style) => {
              const selected = style === answerStyle;
              return (
                <Pressable
                  key={style}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    update({ answerStyle: style });
                    setStylesOpen(false);
                    onClose();
                  }}
                  style={({ pressed }) => [styles.subRow, pressed && { backgroundColor: colors.surface }]}>
                  <View style={styles.text}>
                    <AppText size={16} weight={selected ? 'semibold' : 'regular'} color={colors.icon}>
                      {t(`answerStyle.${style}`)}
                    </AppText>
                    <AppText size={13} secondary>
                      {t(`answerStyle.${style}.description`)}
                    </AppText>
                  </View>
                  {selected ? <CheckIcon size={20} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </Animated.View>
        ) : null}
        <Row
          icon={<BrainIcon size={24} color={colors.icon} strokeWidth={1.8} />}
          title={t('deepThink.title')}
          subtitle={t('attach.deepThink.detail')}
          onPress={() => update({ thinking: !thinking })}
          right={
            <Switch
              value={thinking}
              onValueChange={(v) => update({ thinking: v })}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#FFFFFF"
            />
          }
        />
        <Row
          icon={<SparklesIcon size={24} color={colors.icon} strokeWidth={1.8} />}
          title={t('attach.model')}
          subtitle={modelLabel(model)}
          onPress={() => {
            onClose();
            onModel();
          }}
          right={<ChevronRightIcon size={20} color={colors.textMuted} />}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingVertical: 11, minHeight: 56 },
  text: { flex: 1 },
  divider: { height: 1, marginHorizontal: 24, marginVertical: 6 },
  flipped: { transform: [{ rotate: '180deg' }] },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 62, paddingRight: 24, paddingVertical: 9 },
});
