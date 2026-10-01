import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Flashcards from '@/components/dom/Flashcards';
import { AppText } from '@/components/ui/AppText';
import { useArtifact } from '@/hooks/useArtifact';
import { useTheme } from '@/hooks/useTheme';
import { describeDue, isDue } from '@/lib/srs';
import { deckKey, useReviews } from '@/store/reviews';

export default function FlashcardsScreen() {
  const { artifact, chatId, messageId } = useArtifact('flashcards');
  const { review } = useLocalSearchParams<{ review?: string }>();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const key = deckKey(chatId, messageId);
  const schedules = useReviews((s) => s.decks[key]);
  // Review mode studies only the cards due today, most overdue first (fixed when the screen opens).
  const [dueOrder] = useState(() =>
    review
      ? Object.entries(useReviews.getState().decks[key] ?? {})
          .filter(([, card]) => isDue(card))
          .sort(([, a], [, b]) => a.due - b.due)
          .map(([index]) => Number(index))
      : undefined,
  );
  const studied = Object.values(schedules ?? {});
  const nextDue = studied.length ? Math.min(...studied.map((c) => c.due)) : null;

  if (!artifact) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <AppText secondary>These flashcards are no longer available.</AppText>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
      <Stack.Screen options={{ title: review ? `Review: ${artifact.data.title}` : artifact.data.title }} />
      <Flashcards
        deck={artifact.data}
        scheme={scheme}
        initialOrder={dueOrder}
        nextReview={nextDue === null ? null : describeDue(nextDue)}
        onGrade={async (card, gotIt) => {
          useReviews.getState().grade(key, card, gotIt ? 'good' : 'again');
        }}
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
