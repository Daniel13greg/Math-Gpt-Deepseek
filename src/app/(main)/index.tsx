import { router, useNavigation } from 'expo-router';
import type { DrawerNavigationProp } from 'expo-router/drawer';
import { StyleSheet, View } from 'react-native';

import { ScanView } from '@/components/camera/ScanView';
import { ChatView } from '@/components/chat/ChatView';
import { MainHeader } from '@/components/header/MainHeader';
import { RecordView } from '@/components/record/RecordView';
import { useTheme } from '@/hooks/useTheme';
import { sendMessage } from '@/lib/chat/controller';
import type { ImageAttachment } from '@/lib/types';
import { useUI } from '@/store/ui';

export default function MainScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const mode = useUI((s) => s.mode);
  const setMode = useUI((s) => s.setMode);

  const solvePhoto = (image: ImageAttachment) => {
    const { draft, pendingImages, subject, clearComposer } = useUI.getState();
    setMode('chat');
    clearComposer();
    void sendMessage({ text: draft, images: [...pendingImages, image], tool: null, subject });
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <MainHeader
        mode={mode}
        onModeChange={setMode}
        onMenu={() => navigation.openDrawer()}
        onUpgrade={() => router.push('/upgrade')}
      />
      <View style={styles.body}>
        {mode === 'chat' ? <ChatView /> : null}
        {mode === 'record' ? <RecordView /> : null}
        {mode === 'camera' ? <ScanView onSolve={solvePhoto} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1 },
});
