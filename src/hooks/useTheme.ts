import { useColorScheme } from 'react-native';

import { Colors, type ColorSchemeName, type ThemeColors } from '@/constants/theme';
import { useSettings } from '@/store/settings';

export function useColorSchemeName(): ColorSchemeName {
  const system = useColorScheme();
  const preference = useSettings((s) => s.theme);
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

export function useTheme(): { colors: ThemeColors; scheme: ColorSchemeName; dark: boolean } {
  const scheme = useColorSchemeName();
  return { colors: Colors[scheme], scheme, dark: scheme === 'dark' };
}
