import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLogo } from '@/components/drawer/AppDrawerContent';
import { CheckIcon, XIcon } from '@/components/icons';
import { AppText } from '@/components/ui/AppText';
import { APP_NAME } from '@/constants/app';
import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { MODELS } from '@/lib/deepseek/models';
import { useHasApiKey, useSettings } from '@/store/settings';

const FEATURES = [
  'Step-by-step solutions for 10 subjects',
  'Snap a photo of any problem',
  'Deep Think reasoning for hard problems',
  'Lecture notes from recordings',
  'Practice tests, flashcards, graphs, diagrams & video lessons',
];

const PLAN_COPY: Record<string, { name: string; blurb: string; badge?: string }> = {
  'deepseek-flash': {
    name: 'Flash',
    blurb: 'DeepSeek V4.1 Flash. Fast answers, reads photos of problems, and Deep Think included.',
    badge: 'Recommended',
  },
  'deepseek-v4-pro': {
    name: 'Pro',
    blurb: 'DeepSeek V4 Pro. The strongest reasoning for proofs and olympiad-style problems (text only).',
  },
};

/**
 * MathGPT's "Upgrade" paywall, reimagined: everything is unlocked by your own DeepSeek key,
 * so this screen picks the model and reasoning mode instead of selling a plan.
 */
export default function UpgradeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const model = useSettings((s) => s.model);
  const thinking = useSettings((s) => s.thinking);
  const update = useSettings((s) => s.update);
  const hasKey = useHasApiKey();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: 24 }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.close}
          accessibilityLabel="Close">
          <XIcon size={24} color={colors.icon} />
        </Pressable>

        <View style={styles.hero}>
          <AppLogo size={56} />
          <AppText weight="bold" size={28} align="center" style={styles.title}>
            {APP_NAME} Pro
          </AppText>
          <AppText size={16} secondary align="center" style={styles.subtitle}>
            Every feature is unlocked with your DeepSeek API key. No subscription: you pay DeepSeek directly for what you use.
          </AppText>
        </View>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f} style={styles.feature}>
              <View style={[styles.check, { backgroundColor: colors.primarySoft }]}>
                <CheckIcon size={14} color={colors.primary} strokeWidth={3} />
              </View>
              <AppText size={15} style={styles.flex}>
                {f}
              </AppText>
            </View>
          ))}
        </View>

        <AppText weight="semibold" size={13} color={colors.textMuted} style={styles.label}>
          CHOOSE YOUR MODEL
        </AppText>
        {MODELS.map((m) => {
          const copy = PLAN_COPY[m.id] ?? { name: m.label, blurb: m.description };
          const selected = model === m.id;
          return (
            <Pressable
              key={m.id}
              onPress={() => update({ model: m.id })}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[
                styles.plan,
                {
                  borderColor: selected ? colors.primary : colors.cardBorder,
                  backgroundColor: selected ? colors.primarySoft : colors.card,
                },
              ]}>
              <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.border }]}>
                {selected ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}
              </View>
              <View style={styles.flex}>
                <View style={styles.planHead}>
                  <AppText weight="bold" size={17}>
                    {copy.name}
                  </AppText>
                  {copy.badge ? (
                    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                      <AppText weight="semibold" size={11} color="#fff">
                        {copy.badge}
                      </AppText>
                    </View>
                  ) : null}
                </View>
                <AppText size={14} secondary>
                  {copy.blurb}
                </AppText>
              </View>
            </Pressable>
          );
        })}

        <View style={[styles.plan, styles.toggle, { borderColor: colors.cardBorder, backgroundColor: colors.card }]}>
          <View style={styles.flex}>
            <AppText weight="semibold" size={16}>
              Deep Think
            </AppText>
            <AppText size={14} secondary>
              On for every model. Thinks before answering and before writing tests, flashcards and notes. Slower, but more
              accurate.
            </AppText>
          </View>
          <Switch
            value={thinking}
            onValueChange={(v) => update({ thinking: v })}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor="#fff"
          />
        </View>
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.ctaButton, { backgroundColor: pressed ? colors.primaryPressed : colors.primary }]}
          onPress={() => {
            router.back();
            if (!hasKey) router.push('/settings');
          }}>
          <AppText weight="semibold" size={17} color="#fff">
            {hasKey ? 'Continue' : 'Add your DeepSeek API key'}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  close: { alignSelf: 'flex-end', padding: 4 },
  hero: { alignItems: 'center', marginTop: 4 },
  title: { marginTop: 14, lineHeight: 34 },
  subtitle: { marginTop: 8, lineHeight: 22 },
  features: { marginTop: 22, gap: 12 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { marginTop: 28, marginBottom: 10, letterSpacing: 0.4 },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
  toggle: { marginTop: 6 },
  cta: { paddingHorizontal: 20, paddingTop: 10, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  ctaButton: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
