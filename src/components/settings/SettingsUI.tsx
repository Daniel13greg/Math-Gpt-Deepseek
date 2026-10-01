import { type ReactNode } from 'react';
import { Alert, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export function Section({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={settingsStyles.section}>
      <AppText
        weight="semibold"
        size={13}
        color={colors.textMuted}
        style={settingsStyles.sectionTitle}
        accessibilityRole="header">
        {title.toUpperCase()}
      </AppText>
      <View style={[settingsStyles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>{children}</View>
      {footer ? (
        <AppText size={13} color={colors.textMuted} style={settingsStyles.footer}>
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}

export function Row({
  label,
  detail,
  children,
  onPress,
}: {
  label: string;
  detail?: string;
  children?: ReactNode;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [settingsStyles.row, pressed && onPress && { backgroundColor: colors.surface }]}>
      <View style={settingsStyles.rowText}>
        <AppText size={16}>{label}</AppText>
        {detail ? (
          <AppText size={13} secondary>
            {detail}
          </AppText>
        ) : null}
      </View>
      {children}
    </Pressable>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={[settingsStyles.divider, { backgroundColor: colors.hairline }]} />;
}

export function Field(props: React.ComponentProps<typeof TextInput>) {
  const { colors } = useTheme();
  return (
    <TextInput
      autoCapitalize="none"
      autoCorrect={false}
      placeholderTextColor={colors.textMuted}
      {...props}
      style={[
        settingsStyles.input,
        { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
        props.style,
      ]}
    />
  );
}

export function confirm(title: string, message: string, onConfirm: () => void, action = 'Delete') {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}

export const settingsStyles = StyleSheet.create({
  section: { marginBottom: 22 },
  sectionTitle: { marginLeft: 6, marginBottom: 6, letterSpacing: 0.4 },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  footer: { marginTop: 6, marginHorizontal: 6, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 52 },
  rowText: { flex: 1, gap: 2 },
  divider: { height: 1, marginLeft: 16 },
  block: { padding: 16, gap: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: FontFamily.regular,
  },
});
