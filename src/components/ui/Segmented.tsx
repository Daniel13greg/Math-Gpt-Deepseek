import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

import { AppText } from './AppText';

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const { colors, dark } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.segmentBg }]} accessibilityRole="radiogroup">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.option, selected && { backgroundColor: colors.segmentSelected }, selected && !dark && styles.shadow]}>
            <AppText
              size={14}
              weight={selected ? 'semibold' : 'regular'}
              color={selected ? colors.text : colors.segmentText}
              numberOfLines={1}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', borderRadius: 10, padding: 2 },
  option: { flex: 1, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  shadow: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
});
