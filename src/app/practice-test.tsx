import * as Haptics from 'expo-haptics';
import { Stack } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PracticeTest from '@/components/dom/PracticeTest';
import { AppText } from '@/components/ui/AppText';
import { useArtifact } from '@/hooks/useArtifact';
import { useTheme } from '@/hooks/useTheme';
import { useChats } from '@/store/chats';

export default function PracticeTestScreen() {
  const { chatId, messageId, artifact } = useArtifact('practice-test');
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();

  if (!artifact) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <AppText secondary>This practice test is no longer available.</AppText>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
      <Stack.Screen options={{ title: artifact.data.title }} />
      <PracticeTest
        test={artifact.data}
        scheme={scheme}
        onAnswerPick={async () => {
          if (Platform.OS !== 'web') await Haptics.selectionAsync();
        }}
        onFinish={async (correct, total) => {
          useChats
            .getState()
            .updateAssistant(chatId, messageId, (m) =>
              m.artifact?.kind === 'practice-test'
                ? { artifact: { ...m.artifact, lastScore: { correct, total, at: Date.now() } } }
                : {},
            );
          if (Platform.OS !== 'web') {
            await Haptics.notificationAsync(
              correct / total >= 0.7 ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
            );
          }
        }}
        dom={{ style: { flex: 1 }, containerStyle: { flex: 1 }, scrollEnabled: false, bounces: false }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
