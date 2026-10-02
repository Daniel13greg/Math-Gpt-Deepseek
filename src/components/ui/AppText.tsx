import { StyleSheet, Text, type TextProps } from 'react-native';

import { FontFamily, type FontWeightName } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export interface AppTextProps extends TextProps {
  weight?: FontWeightName;
  size?: number;
  color?: string;
  /** Use a muted secondary color. */
  secondary?: boolean;
  align?: 'left' | 'center' | 'right';
}

/** Text in Inter. Android ignores fontWeight for custom fonts, so each weight is its own family. */
export function AppText({ weight = 'regular', size = 16, color, secondary, align, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  return (
    <Text
      // Follow the system text size, but cap it so fixed-height controls stay usable.
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[
        styles.base,
        {
          fontFamily: FontFamily[weight],
          fontSize: size,
          lineHeight: Math.round(size * 1.38),
          color: color ?? (secondary ? colors.textSecondary : colors.text),
          textAlign: align,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
  },
});
