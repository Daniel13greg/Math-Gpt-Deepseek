import * as Haptics from 'expo-haptics';
import { Stack } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Flashcards from '@/components/dom/Flashcards';
import { AppText } from '@/components/ui/AppText';
import { useArtifact } from '@/hooks/useArtifact';
import { useTheme } from '@/hooks/useTheme';

export default function FlashcardsScreen() {
  const { artifact } = useArtifact('flashcards');
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();

  if (!artifact) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <AppText secondary>These flashcards are no longer available.</AppText>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
      <Stack.Screen options={{ title: artifact.data.title }} />
      <Flashcards
        deck={artifact.data}
        scheme={scheme}
        onFlip={async () => {
          if (Platform.OS !== 'web') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
