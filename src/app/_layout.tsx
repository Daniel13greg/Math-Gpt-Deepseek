import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ToastHost } from '@/components/ui/Toast';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const { colors, dark } = useTheme();
  const ready = fontsLoaded || !!fontError;

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
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="(main)" />
          <Stack.Screen name="settings" options={{ ...header, title: 'Settings' }} />
          <Stack.Screen name="upgrade" options={{ presentation: 'modal' }} />
          <Stack.Screen name="practice-test" options={{ ...header, title: 'Practice Test' }} />
          <Stack.Screen name="flashcards" options={{ ...header, title: 'Flashcards' }} />
          <Stack.Screen name="video" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="notes/[id]" options={{ ...header, title: 'Lecture Notes' }} />
          <Stack.Screen name="image" options={{ presentation: 'transparentModal', animation: 'fade' }} />
        </Stack>
        <ToastHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
