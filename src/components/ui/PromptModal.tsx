import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

import { AppText } from './AppText';

interface PromptModalProps {
  visible: boolean;
  title: string;
  initialValue: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

/** Cross-platform text prompt (Alert.prompt is iOS-only). */
export function PromptModal(props: PromptModalProps) {
  const { colors } = useTheme();
  return (
    <Modal transparent visible={props.visible} animationType="fade" onRequestClose={props.onCancel} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={[styles.backdrop, { backgroundColor: colors.backdrop }]}>
        {/* Mounted only while visible, so the field starts from initialValue every time. */}
        {props.visible ? <PromptCard {...props} /> : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PromptCard({ title, initialValue, confirmLabel = 'Save', onCancel, onConfirm }: PromptModalProps) {
  const { colors } = useTheme();
  const [value, setValue] = useState(initialValue);
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <AppText weight="semibold" size={17}>
        {title}
      </AppText>
      <TextInput
        value={value}
        onChangeText={setValue}
        autoFocus
        selectTextOnFocus
        onSubmitEditing={() => onConfirm(value)}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
        placeholderTextColor={colors.textMuted}
      />
      <View style={styles.buttons}>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.button} hitSlop={6}>
          <AppText weight="medium" size={16} secondary>
            Cancel
          </AppText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => onConfirm(value)} style={styles.button} hitSlop={6}>
          <AppText weight="semibold" size={16} color={colors.primary}>
            {confirmLabel}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 28 },
  card: { borderRadius: 18, padding: 20, gap: 14, maxWidth: 420, width: '100%', alignSelf: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: FontFamily.regular,
  },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 22 },
  button: { paddingVertical: 4 },
});
