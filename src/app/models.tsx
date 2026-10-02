import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLogo } from '@/components/drawer/AppDrawerContent';
import { XIcon } from '@/components/icons';
import { AppText } from '@/components/ui/AppText';
import { APP_NAME } from '@/constants/app';
import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { MODELS } from '@/lib/ai/models';
import { useHasApiKey, useSettings } from '@/store/settings';

/** Picks the model and Deep Think. Opened from the model button in the header. */
export default function ModelsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const model = useSettings((s) => s.model);
  const thinking = useSettings((s) => s.thinking);
  const update = useSettings((s) => s.update);
  const hasKey = useHasApiKey();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: 24 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.close} accessibilityLabel="Close">
          <XIcon size={24} color={colors.icon} />
        </Pressable>

        <View style={styles.hero}>
          <AppLogo size={48} />
          <AppText weight="bold" size={26} align="center" style={styles.title}>
            Choose a model
          </AppText>
          <AppText size={16} secondary align="center" style={styles.subtitle}>
            Flash and Pro are {APP_NAME}&apos;s own math models. Switch any time.
          </AppText>
        </View>

        {MODELS.map((m) => {
          const selected = model === m.id;
          return (
            <Pressable
              key={m.id}
              onPress={() => update({ model: m.id })}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[
                styles.card,
                {
                  borderColor: selected ? colors.primary : colors.cardBorder,
                  backgroundColor: selected ? colors.primarySoft : colors.card,
                },
              ]}>
              <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.border }]}>
                {selected ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}
              </View>
              <View style={styles.flex}>
                <View style={styles.cardHead}>
                  <AppText weight="bold" size={17}>
                    {m.label}
                  </AppText>
                  {m.recommended ? (
                    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                      <AppText weight="semibold" size={11} color={colors.onPrimary}>
                        Recommended
                      </AppText>
                    </View>
                  ) : null}
                </View>
                <AppText size={14} secondary>
                  {m.description}
                </AppText>
              </View>
            </Pressable>
          );
        })}

        <View style={[styles.card, styles.toggle, { borderColor: colors.cardBorder, backgroundColor: colors.card }]}>
          <View style={styles.flex}>
            <AppText weight="semibold" size={16}>
              Deep Think
            </AppText>
            <AppText size={14} secondary>
              Thinks before answering. Slower, but more accurate on multi-step problems.
            </AppText>
          </View>
          <Switch
            value={thinking}
            onValueChange={(v) => update({ thinking: v })}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor="#fff"
            accessibilityLabel="Deep Think"
          />
        </View>
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          style={({ pressed }) => [styles.ctaButton, { backgroundColor: pressed ? colors.primaryPressed : colors.primary }]}
          onPress={() => {
            router.back();
            if (!hasKey) router.push('/settings');
          }}>
          <AppText weight="semibold" size={17} color={colors.onPrimary}>
            {hasKey ? 'Done' : 'Add your API key'}
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
  hero: { alignItems: 'center', marginTop: 4, marginBottom: 24 },
  title: { marginTop: 14, lineHeight: 32 },
  subtitle: { marginTop: 8, lineHeight: 22 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
  toggle: { marginTop: 6 },
  cta: { paddingHorizontal: 20, paddingTop: 10, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  ctaButton: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
