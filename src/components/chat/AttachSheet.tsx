import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { BrainIcon, CameraIcon, ChevronRightIcon, ImageIcon, SparklesIcon } from '@/components/icons';
import { AppText } from '@/components/ui/AppText';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useTheme } from '@/hooks/useTheme';
import { modelLabel } from '@/lib/deepseek/models';
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

function Row({ icon, title, subtitle, onPress, right }: RowProps) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && onPress && { backgroundColor: colors.surface }]}>
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

/** The composer "+" menu: photo sources plus the Deep Think toggle and model shortcut. */
export function AttachSheet({ visible, onClose, onCamera, onLibrary, onModel }: AttachSheetProps) {
  const { colors } = useTheme();
  const thinking = useSettings((s) => s.thinking);
  const model = useSettings((s) => s.model);
  const update = useSettings((s) => s.update);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add to your question">
      <View style={styles.list}>
        <Row
          icon={<CameraIcon size={24} color={colors.icon} strokeWidth={1.8} />}
          title="Take a photo"
          subtitle="Snap a problem from your homework"
          onPress={() => {
            onClose();
            onCamera();
          }}
        />
        <Row
          icon={<ImageIcon size={24} color={colors.icon} strokeWidth={1.8} />}
          title="Choose from photos"
          subtitle="Attach a screenshot or picture"
          onPress={() => {
            onClose();
            onLibrary();
          }}
        />
        <View style={[styles.divider, { backgroundColor: colors.hairline }]} />
        <Row
          icon={<BrainIcon size={24} color={colors.icon} strokeWidth={1.8} />}
          title="Deep Think"
          subtitle="Reason carefully before answering (slower)"
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
          title="Model"
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
});
