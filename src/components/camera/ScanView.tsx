import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraIcon, ImageIcon, RotateCcwIcon, ZapIcon, ZapOffIcon } from '@/components/icons';
import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/hooks/useTheme';
import { frameToCrop } from '@/lib/cropFrame';
import { prepareImage } from '@/lib/images';
import type { ImageAttachment } from '@/lib/types';
import { toast } from '@/store/toast';

const MIN_W = 140;
const MIN_H = 70;
const HANDLE = 44;

interface ScanViewProps {
  /** Called with the cropped photo when the user taps "Solve". */
  onSolve: (image: ImageAttachment) => void;
}

type Corner = 'tl' | 'tr' | 'bl' | 'br';

/** A wide frame in the upper-middle of the preview, sized for one problem. */
function defaultFrame(width: number, height: number) {
  const w = Math.max(MIN_W, Math.min(width - 48, 520));
  const h = Math.max(MIN_H, Math.min(height * 0.32, w * 0.55));
  return { x: (width - w) / 2, y: height * 0.36 - h / 2, w, h };
}

interface FrameValues {
  fx: SharedValue<number>;
  fy: SharedValue<number>;
  fw: SharedValue<number>;
  fh: SharedValue<number>;
}

/** Invisible touch target on a frame corner; dragging it resizes the crop frame. */
function CornerHandle({
  corner,
  frame: { fx, fy, fw, fh },
  start,
  bounds,
}: {
  corner: Corner;
  frame: FrameValues;
  start: SharedValue<{ x: number; y: number; w: number; h: number }>;
  bounds: { width: number; height: number };
}) {
  const left = corner === 'tl' || corner === 'bl';
  const topSide = corner === 'tl' || corner === 'tr';
  const gesture = Gesture.Pan()
    .onBegin(() => {
      start.set({ x: fx.get(), y: fy.get(), w: fw.get(), h: fh.get() });
    })
    .onUpdate((e) => {
      const s = start.get();
      if (left) {
        const x = Math.min(Math.max(4, s.x + e.translationX), s.x + s.w - MIN_W);
        fw.set(s.w + (s.x - x));
        fx.set(x);
      } else {
        fw.set(Math.min(bounds.width - 4 - s.x, Math.max(MIN_W, s.w + e.translationX)));
      }
      if (topSide) {
        const y = Math.min(Math.max(4, s.y + e.translationY), s.y + s.h - MIN_H);
        fh.set(s.h + (s.y - y));
        fy.set(y);
      } else {
        fh.set(Math.min(bounds.height - 4 - s.y, Math.max(MIN_H, s.h + e.translationY)));
      }
    });
  const style = useAnimatedStyle(() => ({
    left: (left ? fx.get() : fx.get() + fw.get()) - HANDLE / 2,
    top: (topSide ? fy.get() : fy.get() + fh.get()) - HANDLE / 2,
  }));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.handle, style]} hitSlop={8} accessibilityLabel={`Resize frame ${corner}`} />
    </GestureDetector>
  );
}

export function ScanView({ onSolve }: ScanViewProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [torch, setTorch] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ImageAttachment | null>(null);
  // Estimate the preview size from the window so the frame never renders collapsed; onLayout refines it.
  const windowSize = useWindowDimensions();
  const [view, setView] = useState(() => ({ width: windowSize.width, height: Math.max(300, windowSize.height - 140) }));
  const [initialFrame] = useState(() => defaultFrame(view.width, view.height));

  const fx = useSharedValue(initialFrame.x);
  const fy = useSharedValue(initialFrame.y);
  const fw = useSharedValue(initialFrame.w);
  const fh = useSharedValue(initialFrame.h);
  const start = useSharedValue({ x: 0, y: 0, w: 0, h: 0 });
  const frame = { fx, fy, fw, fh };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width === view.width && height === view.height) return;
    setView({ width, height });
    const next = defaultFrame(width, height);
    fx.set(next.x);
    fy.set(next.y);
    fw.set(next.w);
    fh.set(next.h);
  };

  const frameStyle = useAnimatedStyle(() => ({ left: fx.get(), top: fy.get(), width: fw.get(), height: fh.get() }));
  const shadeTop = useAnimatedStyle(() => ({ height: fy.get() }));
  const shadeBottom = useAnimatedStyle(() => ({ top: fy.get() + fh.get() }));
  const shadeLeft = useAnimatedStyle(() => ({ top: fy.get(), height: fh.get(), width: fx.get() }));
  const shadeRight = useAnimatedStyle(() => ({ top: fy.get(), height: fh.get(), left: fx.get() + fw.get() }));
  const capture = async () => {
    if (!camera.current || busy) return;
    setBusy(true);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.9, shutterSound: false });
      if (!photo) throw new Error('No photo');
      const crop = frameToCrop({ x: fx.get(), y: fy.get(), w: fw.get(), h: fh.get() }, view, photo);
      setPreview(await prepareImage(photo.uri, { width: photo.width, height: photo.height }, crop));
    } catch {
      toast.error("Couldn't take the photo. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 1 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setBusy(true);
    try {
      setPreview(await prepareImage(asset.uri, { width: asset.width, height: asset.height }));
    } catch {
      toast.error("Couldn't read that image.");
    } finally {
      setBusy(false);
    }
  };

  if (!permission) {
    return <View style={[styles.fill, { backgroundColor: '#000' }]} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.fill, styles.permission, { backgroundColor: colors.background }]}>
        <View style={[styles.permissionIcon, { backgroundColor: colors.primarySoft }]}>
          <CameraIcon size={30} color={colors.primary} />
        </View>
        <AppText weight="bold" size={22} align="center">
          Scan a problem
        </AppText>
        <AppText size={16} secondary align="center" style={styles.permissionText}>
          Point your camera at any math or science problem and MathGPT will solve it step by step.
        </AppText>
        <Pressable
          accessibilityRole="button"
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}>
          <AppText weight="semibold" size={16} color="#fff">
            {permission.canAskAgain ? 'Allow camera access' : 'Open settings'}
          </AppText>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={pickFromLibrary}>
          <ImageIcon size={18} color={colors.primary} />
          <AppText weight="medium" size={16} color={colors.primary}>
            Choose a photo instead
          </AppText>
        </Pressable>
      </View>
    );
  }

  return (
    // Keyed so it mounts fresh after the permission check; reusing the placeholder View drops onLayout on web.
    <View key="camera" style={[styles.fill, styles.black]} onLayout={onLayout}>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        animateShutter
        onCameraReady={() => setReady(true)}
      />

      {/* Shade outside the frame */}
      <Animated.View
        pointerEvents="none"
        style={[styles.shade, { top: 0, left: 0, right: 0, backgroundColor: colors.cameraOverlay }, shadeTop]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.shade, { left: 0, right: 0, bottom: 0, backgroundColor: colors.cameraOverlay }, shadeBottom]}
      />
      <Animated.View pointerEvents="none" style={[styles.shade, { left: 0, backgroundColor: colors.cameraOverlay }, shadeLeft]} />
      <Animated.View
        pointerEvents="none"
        style={[styles.shade, { right: 0, backgroundColor: colors.cameraOverlay }, shadeRight]}
      />

      <Animated.View pointerEvents="none" style={[styles.frame, frameStyle]}>
        <View style={[styles.corner, styles.cTL]} />
        <View style={[styles.corner, styles.cTR]} />
        <View style={[styles.corner, styles.cBL]} />
        <View style={[styles.corner, styles.cBR]} />
      </Animated.View>

      {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
        <CornerHandle key={corner} corner={corner} frame={frame} start={start} bounds={view} />
      ))}

      <View pointerEvents="none" style={[styles.hint, { top: 18 }]}>
        <AppText weight="medium" size={15} color="#fff" align="center">
          Fit one problem inside the frame
        </AppText>
      </View>

      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <Pressable
          accessibilityRole="button"
          onPress={pickFromLibrary}
          style={styles.sideButton}
          accessibilityLabel="Choose from photos">
          <ImageIcon size={26} color="#fff" strokeWidth={1.8} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={capture}
          disabled={!ready || busy}
          style={styles.shutterOuter}
          accessibilityLabel="Take photo">
          <View style={[styles.shutterInner, (!ready || busy) && { opacity: 0.5 }]}>
            {busy ? <ActivityIndicator color="#000" /> : null}
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setTorch((t) => !t)}
          style={styles.sideButton}
          accessibilityLabel={torch ? 'Turn off light' : 'Turn on light'}>
          {torch ? (
            <ZapIcon size={26} color="#FFD60A" strokeWidth={1.8} />
          ) : (
            <ZapOffIcon size={26} color="#fff" strokeWidth={1.8} />
          )}
        </Pressable>
      </View>

      {preview ? (
        <View style={[StyleSheet.absoluteFill, styles.previewBackdrop]}>
          <View style={[styles.previewCard, { backgroundColor: colors.card }]}>
            <AppText weight="semibold" size={17} align="center">
              Solve this problem?
            </AppText>
            <Image
              source={{ uri: preview.uri }}
              style={[styles.previewImage, { aspectRatio: preview.width / preview.height }]}
              contentFit="contain"
            />
            <View style={styles.previewButtons}>
              <Pressable
                accessibilityRole="button"
                style={[styles.previewButton, { backgroundColor: colors.surface }]}
                onPress={() => setPreview(null)}>
                <RotateCcwIcon size={17} color={colors.text} />
                <AppText weight="medium" size={16}>
                  Retake
                </AppText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[styles.previewButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  const image = preview;
                  setPreview(null);
                  onSolve(image);
                }}>
                <AppText weight="semibold" size={16} color="#fff">
                  Solve
                </AppText>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const CORNER = 26;
const styles = StyleSheet.create({
  fill: { flex: 1 },
  black: { backgroundColor: '#000' },
  shade: { position: 'absolute' },
  frame: { position: 'absolute', borderRadius: 14 },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#fff' },
  cTL: { left: -2, top: -2, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 14 },
  cTR: { right: -2, top: -2, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 14 },
  cBL: { left: -2, bottom: -2, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 14 },
  cBR: { right: -2, bottom: -2, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 14 },
  handle: { position: 'absolute', width: HANDLE, height: HANDLE },
  hint: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingTop: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sideButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permission: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  permissionIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  permissionText: { lineHeight: 23, marginBottom: 12 },
  primaryButton: { height: 48, paddingHorizontal: 26, borderRadius: 24, justifyContent: 'center' },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  previewBackdrop: { backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  previewCard: { borderRadius: 20, padding: 16, gap: 14 },
  previewImage: { width: '100%', maxHeight: 360, borderRadius: 12 },
  previewButtons: { flexDirection: 'row', gap: 10 },
  previewButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
