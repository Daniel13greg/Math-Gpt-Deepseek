import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuIcon } from '@/components/icons';
import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/hooks/useTheme';
import type { AppMode } from '@/store/ui';

import { ModeSwitcher } from './ModeSwitcher';

/** Height of the header row below the status bar (plus a hairline border). */
export const HEADER_ROW_HEIGHT = 52;
const BORDER = StyleSheet.hairlineWidth * 2;

/** Total header height, e.g. for KeyboardAvoidingView offsets. */
export function headerHeight(topInset: number) {
  return topInset + HEADER_ROW_HEIGHT + BORDER;
}

interface MainHeaderProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  onMenu: () => void;
  onUpgrade: () => void;
}

export function MainHeader({ mode, onModeChange, onMenu, onUpgrade }: MainHeaderProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.background, borderBottomColor: colors.hairline }]}>
      <View style={styles.row}>
        <Pressable onPress={onMenu} hitSlop={12} style={styles.menu} accessibilityRole="button" accessibilityLabel="Open menu">
          <MenuIcon size={21} color={colors.icon} />
        </Pressable>

        <View style={styles.center} pointerEvents="box-none">
          <ModeSwitcher mode={mode} onChange={onModeChange} />
        </View>

        {mode !== 'record' ? (
          <Pressable
            onPress={onUpgrade}
            accessibilityRole="button"
            accessibilityLabel="Upgrade"
            style={({ pressed }) => [styles.upgrade, { backgroundColor: pressed ? colors.primaryPressed : colors.primary }]}>
            <AppText weight="medium" size={15} color={colors.onPrimary}>
              Upgrade
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { borderBottomWidth: BORDER },
  row: { height: HEADER_ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  menu: { width: 40, height: 40, justifyContent: 'center' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  upgrade: {
    marginLeft: 'auto',
    height: 30,
    paddingHorizontal: 7.5,
    borderRadius: 7,
    justifyContent: 'center',
  },
});
