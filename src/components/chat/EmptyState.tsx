import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppLogo } from '@/components/drawer/AppDrawerContent';
import { ArrowUpRightIcon, CameraIcon, KeyRoundIcon, NotebookPenIcon, ToolCaseIcon } from '@/components/icons';
import { AppText } from '@/components/ui/AppText';
import { APP_NAME } from '@/constants/app';
import { getSubject } from '@/constants/subjects';
import { useTheme } from '@/hooks/useTheme';
import { sendMessage } from '@/lib/chat/controller';
import { toUnicodeMath } from '@/lib/math';
import { useHasApiKey } from '@/store/settings';
import { useUI } from '@/store/ui';

function Shortcut({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.shortcut, { backgroundColor: pressed ? colors.surfacePressed : colors.surface }]}>
      {icon}
      <AppText size={13.5} weight="medium" align="center" numberOfLines={2}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** A new chat before its first message: starter questions for the subject, shortcuts and key setup. */
export function EmptyState({ onTools }: { onTools: () => void }) {
  const { colors } = useTheme();
  const hasKey = useHasApiKey();
  const subject = getSubject(useUI((s) => s.subject));

  return (
    <ScrollView
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag">
      <Animated.View entering={FadeIn.duration(250)} style={styles.inner}>
        <View style={styles.hero}>
          <AppLogo size={44} />
          <AppText weight="bold" size={22} align="center" color={colors.textStrong} style={styles.title}>
            What are we solving today?
          </AppText>
          <AppText size={15} align="center" secondary>
            Ask any {subject.noun} question, snap a photo, or make a study tool.
          </AppText>
        </View>

        {!hasKey ? (
          <View style={[styles.keyCard, { backgroundColor: colors.primarySoft }]}>
            <View style={styles.keyHead}>
              <KeyRoundIcon size={18} color={colors.primary} />
              <AppText weight="semibold" size={15.5}>
                Add your API key
              </AppText>
            </View>
            <AppText size={14}>{APP_NAME} needs an API key to answer. You only have to add it once.</AppText>
            <Pressable
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.keyButton, { backgroundColor: pressed ? colors.primaryPressed : colors.primary }]}>
              <AppText weight="semibold" size={15} color={colors.onPrimary}>
                Open Settings
              </AppText>
            </Pressable>
          </View>
        ) : null}

        <AppText weight="semibold" size={12.5} secondary style={styles.section}>
          TRY ASKING
        </AppText>
        <Animated.View key={subject.id} entering={FadeIn.duration(200)} style={styles.examples}>
          {subject.examples.map((example) => {
            const label = toUnicodeMath(example);
            return (
              <Pressable
                key={example}
                onPress={() => void sendMessage({ text: example, images: [], tool: null, subject: subject.id })}
                accessibilityRole="button"
                accessibilityLabel={`Ask: ${label}`}
                style={({ pressed }) => [
                  styles.example,
                  { borderColor: colors.cardBorder, backgroundColor: pressed ? colors.surface : colors.card },
                ]}>
                <AppText size={15} style={styles.exampleText}>
                  {label}
                </AppText>
                <ArrowUpRightIcon size={17} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </Animated.View>

        <View style={styles.shortcuts}>
          <Shortcut
            icon={<CameraIcon size={22} color={colors.icon} strokeWidth={1.8} />}
            label="Scan a problem"
            onPress={() => useUI.getState().setMode('camera')}
          />
          <Shortcut icon={<ToolCaseIcon size={22} color={colors.icon} strokeWidth={1.8} />} label="Study tools" onPress={onTools} />
          <Shortcut
            icon={<NotebookPenIcon size={22} color={colors.icon} strokeWidth={1.8} />}
            label="Lecture notes"
            onPress={() => useUI.getState().setMode('record')}
          />
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 20 },
  inner: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  hero: { alignItems: 'center', gap: 6 },
  title: { marginTop: 8, lineHeight: 28 },
  keyCard: { marginTop: 22, borderRadius: 16, padding: 16, gap: 8 },
  keyHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  keyButton: { alignSelf: 'flex-start', height: 38, paddingHorizontal: 16, borderRadius: 19, justifyContent: 'center', marginTop: 4 },
  section: { marginTop: 26, marginBottom: 8, marginLeft: 4, letterSpacing: 0.4 },
  examples: { gap: 8 },
  example: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  exampleText: { flex: 1 },
  shortcuts: { flexDirection: 'row', gap: 8, marginTop: 18 },
  // Top-aligned so the icons line up when one label wraps onto two lines.
  shortcut: { flex: 1, minHeight: 76, borderRadius: 14, alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 14 },
});
