import { router, Stack } from 'expo-router';
import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import MathEditor from '@/components/dom/MathEditor';
import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import { insertMath } from '@/lib/mathInput';
import { useUI } from '@/store/ui';

export default function MathInputScreen() {
  const { colors, scheme } = useTheme();
  const { t, lang } = useT();
  const latex = useRef('');

  const insert = () => {
    useUI.getState().setDraft(insertMath(useUI.getState().draft, latex.current));
    router.back();
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" style={styles.headerButton}>
              <AppText size={16} color={colors.textSecondary}>
                {t('common.cancel')}
              </AppText>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={insert} hitSlop={10} accessibilityRole="button" style={styles.headerButton}>
              <AppText size={16} weight="semibold" color={colors.primary}>
                {t('math.insert')}
              </AppText>
            </Pressable>
          ),
        }}
      />
      <MathEditor
        scheme={scheme}
        lang={lang}
        onChange={async (value) => {
          latex.current = value;
        }}
        dom={{ style: { flex: 1 }, containerStyle: { flex: 1 }, scrollEnabled: false, bounces: false }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerButton: { paddingHorizontal: 8 },
});
