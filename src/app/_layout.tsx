import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';

import { ToastHost } from '@/components/ui/Toast';
import { APP_NAME } from '@/constants/app';
import { FontFamily } from '@/constants/theme';
import { useShareIntake } from '@/hooks/useShareIntake';
import { useTheme } from '@/hooks/useTheme';
import { applyLanguagePreference, useT } from '@/i18n';
import { useSettings } from '@/store/settings';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const { colors, dark } = useTheme();
  const { t } = useT();
  const ready = fontsLoaded || !!fontError;
  useShareIntake();

  // "Same as device" follows the system language, which can change while the app is in the background.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') applyLanguagePreference(useSettings.getState().language);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  const base = dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.hairline,
    },
  };

  const header = {
    headerShown: true,
    headerShadowVisible: false,
    headerTintColor: colors.icon,
    headerStyle: { backgroundColor: colors.background },
    headerTitleStyle: { fontFamily: FontFamily.semibold, fontSize: 17, color: colors.text },
    headerBackButtonDisplayMode: 'minimal' as const,
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemeProvider value={navTheme}>
        <StatusBar style={dark ? 'light' : 'dark'} />
        {/* Every Reanimated animation follows the system "Reduce motion" setting. */}
        <ReducedMotionConfig mode={ReduceMotion.System} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          {/* The title is only used as the back button label ("(main)" otherwise) and the web page title. */}
          <Stack.Screen name="(main)" options={{ title: APP_NAME }} />
          <Stack.Screen name="settings" options={{ ...header, title: t('settings.title') }} />
          <Stack.Screen name="models" options={{ presentation: 'modal' }} />
          <Stack.Screen name="practice-test" options={{ ...header, title: t('tool.practice-test.chip') }} />
          <Stack.Screen name="flashcards" options={{ ...header, title: t('tool.flashcards.chip') }} />
          <Stack.Screen name="video" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="notes/[id]" options={{ ...header, title: t('notes.title') }} />
          <Stack.Screen name="image" options={{ presentation: 'transparentModal', animation: 'fade' }} />
          <Stack.Screen name="expo-sharing" options={{ animation: 'none' }} />
          <Stack.Screen name="math-input" options={{ ...header, title: t('math.title'), presentation: 'modal' }} />
        </Stack>
        <ToastHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
