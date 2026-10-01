import { Drawer } from 'expo-router/drawer';

import { AppDrawerContent } from '@/components/drawer/AppDrawerContent';
import { useTheme } from '@/hooks/useTheme';

export default function MainLayout() {
  const { colors, dark } = useTheme();
  return (
    <Drawer
      drawerContent={(props) => <AppDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        swipeEdgeWidth: 28,
        overlayColor: dark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.25)',
        drawerStyle: { width: 304, backgroundColor: colors.background },
      }}
    />
  );
}
