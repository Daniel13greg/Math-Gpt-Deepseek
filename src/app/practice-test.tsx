import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PracticeTest from '@/components/dom/PracticeTest';
import { FileDownIcon } from '@/components/icons';
import { AppText } from '@/components/ui/AppText';
import { useArtifact } from '@/hooks/useArtifact';
import { usePdfExport } from '@/hooks/usePdfExport';
import { useTheme } from '@/hooks/useTheme';
import { practiceTestSections } from '@/lib/tools/printable';
import { practiceMistakes } from '@/lib/chat/controller';
import { useChats } from '@/store/chats';

export default function PracticeTestScreen() {
  const { chatId, messageId, artifact } = useArtifact('practice-test');
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const pdf = usePdfExport();

  if (!artifact) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <AppText secondary>This practice test is no longer available.</AppText>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
      <Stack.Screen
        options={{
          title: artifact.data.title,
          headerRight: () => (
            <Pressable
              onPress={() => pdf.exportPdf({ title: artifact.data.title, sections: practiceTestSections(artifact.data) })}
              hitSlop={10}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel="Save test as PDF">
              <FileDownIcon size={22} color={colors.icon} />
            </Pressable>
          ),
        }}
      />
      {pdf.exporter}
      <PracticeTest
        test={artifact.data}
        scheme={scheme}
        onAnswerPick={async () => {
          if (Platform.OS !== 'web') await Haptics.selectionAsync();
        }}
        onFinish={async (correct, total, answers) => {
          useChats
            .getState()
            .updateAssistant(chatId, messageId, (m) =>
              m.artifact?.kind === 'practice-test'
                ? { artifact: { ...m.artifact, lastScore: { correct, total, at: Date.now(), answers } } }
                : {},
            );
          if (Platform.OS !== 'web') {
            await Haptics.notificationAsync(
              correct / total >= 0.7 ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
            );
          }
        }}
        onPracticeMistakes={async () => {
          router.back();
          await practiceMistakes(chatId, messageId);
        }}
        dom={{ style: { flex: 1 }, containerStyle: { flex: 1 }, scrollEnabled: false, bounces: false }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerButton: { paddingHorizontal: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
