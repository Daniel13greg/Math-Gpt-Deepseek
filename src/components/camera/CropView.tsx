import { Image } from 'expo-image';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RotateCcwIcon } from '@/components/icons';
import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import { frameToImageCrop } from '@/lib/cropFrame';
import { prepareImage } from '@/lib/images';
import type { CropSource } from '@/lib/pickImage';
import type { ImageAttachment } from '@/lib/types';
import { toast } from '@/store/toast';

/** Space around the fitted photo so the frame corners stay easy to grab. */
const PAD = 24;
/** The frame never gets closer than this to the screen edge. */
const EDGE = 6;
const MIN_FRAME = 64;
/** Maximum zoom, relative to the whole photo fitting the screen. */
const MAX_ZOOM = 8;
const DOUBLE_TAP_ZOOM = 2.5;
const HANDLE = 48;
const ANIMATION = { duration: 220 };

interface Geometry {
  /** Center of the editing area. */
  cx: number;
  cy: number;
  /** Size of the editing area. */
  width: number;
  height: number;
  /** Photo size on screen at zoom 1, fitted inside the editing area. */
  dw: number;
  dh: number;
}

function geometryFor(stage: { width: number; height: number }, photo: CropSource): Geometry {
  const fit = Math.max(0.0001, Math.min((stage.width - PAD * 2) / photo.width, (stage.height - PAD * 2) / photo.height));
  return {
    cx: stage.width / 2,
    cy: stage.height / 2,
    width: stage.width,
    height: stage.height,
    dw: photo.width * fit,
    dh: photo.height * fit,
  };
}

interface CropValues {
  zoom: SharedValue<number>;
  /** Offset of the photo's center from the editing area's center. */
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  /** Crop frame, in editing-area coordinates. */
  fx: SharedValue<number>;
  fy: SharedValue<number>;
  fw: SharedValue<number>;
  fh: SharedValue<number>;
}

/** Smallest zoom at which the photo still covers the frame. */
function minZoom(g: Geometry, fw: number, fh: number) {
  'worklet';
  return Math.max(fw / g.dw, fh / g.dh);
}

/** Keeps the frame inside the photo along one axis (centers the photo if it is smaller than the frame). */
function clampOffset(offset: number, center: number, size: number, frameStart: number, frameSize: number) {
  'worklet';
  const max = frameStart - center + size / 2;
  const min = frameStart + frameSize - center - size / 2;
  return min > max ? (min + max) / 2 : Math.min(max, Math.max(min, offset));
}

/**
 * Zooms by `ratio` around the screen point (px, py), clamped so the photo keeps covering the frame.
 * Returns the new zoom and offsets without applying them.
 */
function zoomAround(g: Geometry, v: CropValues, ratio: number, px: number, py: number) {
  'worklet';
  const zoom = v.zoom.get();
  const fw = v.fw.get();
  const fh = v.fh.get();
  const next = Math.min(MAX_ZOOM, Math.max(minZoom(g, fw, fh), zoom * ratio));
  const k = next / zoom;
  // The photo point under (px, py) stays under it.
  const ox = px - g.cx;
  const oy = py - g.cy;
  return {
    zoom: next,
    tx: clampOffset(ox - (ox - v.tx.get()) * k, g.cx, g.dw * next, v.fx.get(), fw),
    ty: clampOffset(oy - (oy - v.ty.get()) * k, g.cy, g.dh * next, v.fy.get(), fh),
  };
}

type Corner = 'tl' | 'tr' | 'bl' | 'br';

/** Invisible touch target on a frame corner; dragging it resizes the frame within the photo. */
function CornerHandle({ corner, geometry: g, values: v }: { corner: Corner; geometry: Geometry; values: CropValues }) {
  const start = useSharedValue({ x: 0, y: 0, w: 0, h: 0 });
  const left = corner === 'tl' || corner === 'bl';
  const top = corner === 'tl' || corner === 'tr';

  const gesture = Gesture.Pan()
    .onBegin(() => {
      start.set({ x: v.fx.get(), y: v.fy.get(), w: v.fw.get(), h: v.fh.get() });
    })
    .onUpdate((e) => {
      const s = start.get();
      const zoom = v.zoom.get();
      // The frame may cover only the visible part of the photo.
      const photoLeft = g.cx + v.tx.get() - (g.dw * zoom) / 2;
      const photoTop = g.cy + v.ty.get() - (g.dh * zoom) / 2;
      const minX = Math.max(photoLeft, EDGE);
      const maxX = Math.min(photoLeft + g.dw * zoom, g.width - EDGE);
      const minY = Math.max(photoTop, EDGE);
      const maxY = Math.min(photoTop + g.dh * zoom, g.height - EDGE);
      const minW = Math.min(MIN_FRAME, maxX - minX);
      const minH = Math.min(MIN_FRAME, maxY - minY);
      if (left) {
        const x = Math.min(Math.max(minX, s.x + e.translationX), s.x + s.w - minW);
        v.fx.set(x);
        v.fw.set(s.x + s.w - x);
      } else {
        v.fw.set(Math.min(maxX - s.x, Math.max(minW, s.w + e.translationX)));
      }
      if (top) {
        const y = Math.min(Math.max(minY, s.y + e.translationY), s.y + s.h - minH);
        v.fy.set(y);
        v.fh.set(s.y + s.h - y);
      } else {
        v.fh.set(Math.min(maxY - s.y, Math.max(minH, s.h + e.translationY)));
      }
    });

  const style = useAnimatedStyle(() => ({
    left: (left ? v.fx.get() : v.fx.get() + v.fw.get()) - HANDLE / 2,
    top: (top ? v.fy.get() : v.fy.get() + v.fh.get()) - HANDLE / 2,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.handle, style]} accessibilityLabel={`Resize crop ${corner}`} />
    </GestureDetector>
  );
}

interface CropViewProps {
  source: CropSource;
  onDone: (image: ImageAttachment) => void;
  onCancel: () => void;
}

/**
 * Full-screen photo cropper: one finger moves the photo, two fingers pinch to zoom (double-tap
 * zooms in or back out), and the frame corners resize the crop.
 */
export function CropView({ source, onDone, onCancel }: CropViewProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const windowSize = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  // Estimate the editing area from the window so the first frame isn't collapsed; onLayout refines it.
  const [stage, setStage] = useState(() => ({
    width: windowSize.width,
    height: Math.max(240, windowSize.height - insets.top - insets.bottom - 150),
  }));
  const g = geometryFor(stage, source);

  const values: CropValues = {
    zoom: useSharedValue(1),
    tx: useSharedValue(0),
    ty: useSharedValue(0),
    fx: useSharedValue(g.cx - g.dw / 2),
    fy: useSharedValue(g.cy - g.dh / 2),
    fw: useSharedValue(g.dw),
    fh: useSharedValue(g.dh),
  };
  const { zoom, tx, ty, fx, fy, fw, fh } = values;
  const panLast = useSharedValue({ x: 0, y: 0 });
  const pinchLast = useSharedValue(1);

  /** Whole photo, frame around all of it. */
  const reset = (next: Geometry, animate: boolean) => {
    const set = (value: SharedValue<number>, to: number) => value.set(animate ? withTiming(to, ANIMATION) : to);
    set(zoom, 1);
    set(tx, 0);
    set(ty, 0);
    set(fx, next.cx - next.dw / 2);
    set(fy, next.cy - next.dh / 2);
    set(fw, next.dw);
    set(fh, next.dh);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width === stage.width && height === stage.height) return;
    setStage({ width, height });
    reset(geometryFor({ width, height }, source), false);
  };

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      panLast.set({ x: 0, y: 0 });
    })
    .onUpdate((e) => {
      const last = panLast.get();
      const z = zoom.get();
      tx.set(clampOffset(tx.get() + e.translationX - last.x, g.cx, g.dw * z, fx.get(), fw.get()));
      ty.set(clampOffset(ty.get() + e.translationY - last.y, g.cy, g.dh * z, fy.get(), fh.get()));
      panLast.set({ x: e.translationX, y: e.translationY });
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      pinchLast.set(1);
    })
    .onUpdate((e) => {
      const next = zoomAround(g, values, e.scale / pinchLast.get(), e.focalX, e.focalY);
      pinchLast.set(e.scale);
      zoom.set(next.zoom);
      tx.set(next.tx);
      ty.set(next.ty);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e, success) => {
      if (!success) return;
      const min = minZoom(g, fw.get(), fh.get());
      const zoomedIn = zoom.get() > min * 1.05;
      const target = zoomedIn ? min : Math.min(MAX_ZOOM, Math.max(min, zoom.get()) * DOUBLE_TAP_ZOOM);
      const next = zoomAround(g, values, target / zoom.get(), e.x, e.y);
      zoom.set(withTiming(next.zoom, ANIMATION));
      tx.set(withTiming(next.tx, ANIMATION));
      ty.set(withTiming(next.ty, ANIMATION));
    });

  const gestures = Gesture.Simultaneous(pan, pinch, doubleTap);

  const photoStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: zoom.get() }],
  }));
  const frameStyle = useAnimatedStyle(() => ({ left: fx.get(), top: fy.get(), width: fw.get(), height: fh.get() }));
  const shadeTop = useAnimatedStyle(() => ({ height: fy.get() }));
  const shadeBottom = useAnimatedStyle(() => ({ top: fy.get() + fh.get() }));
  const shadeLeft = useAnimatedStyle(() => ({ top: fy.get(), height: fh.get(), width: fx.get() }));
  const shadeRight = useAnimatedStyle(() => ({ top: fy.get(), height: fh.get(), left: fx.get() + fw.get() }));

  const done = async () => {
    if (busy) return;
    setBusy(true);
    const z = zoom.get();
    const photo = {
      left: g.cx + tx.get() - (g.dw * z) / 2,
      top: g.cy + ty.get() - (g.dh * z) / 2,
      width: g.dw * z,
      height: g.dh * z,
    };
    const crop = frameToImageCrop({ x: fx.get(), y: fy.get(), w: fw.get(), h: fh.get() }, photo, source);
    try {
      onDone(await prepareImage(source.uri, source, crop));
    } catch {
      toast.error(t('chat.imageUnreadable'));
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.hint} pointerEvents="none">
        <AppText size={14} color="rgba(255,255,255,0.75)" align="center">
          {t('crop.hint')}
        </AppText>
      </View>

      <View style={styles.stage} onLayout={onLayout}>
        <GestureDetector gesture={gestures}>
          <View style={StyleSheet.absoluteFill}>
            <Animated.View
              style={[
                styles.photo,
                { left: g.cx - g.dw / 2, top: g.cy - g.dh / 2, width: g.dw, height: g.dh },
                photoStyle,
              ]}>
              <Image source={{ uri: source.uri }} style={StyleSheet.absoluteFill} contentFit="fill" />
            </Animated.View>
          </View>
        </GestureDetector>

        <Animated.View pointerEvents="none" style={[styles.shade, styles.shadeTop, shadeTop]} />
        <Animated.View pointerEvents="none" style={[styles.shade, styles.shadeBottom, shadeBottom]} />
        <Animated.View pointerEvents="none" style={[styles.shade, styles.shadeLeft, shadeLeft]} />
        <Animated.View pointerEvents="none" style={[styles.shade, styles.shadeRight, shadeRight]} />

        <Animated.View pointerEvents="none" style={[styles.frame, frameStyle]}>
          <View style={[styles.gridLine, styles.gridV, { left: '33.33%' }]} />
          <View style={[styles.gridLine, styles.gridV, { left: '66.66%' }]} />
          <View style={[styles.gridLine, styles.gridH, { top: '33.33%' }]} />
          <View style={[styles.gridLine, styles.gridH, { top: '66.66%' }]} />
          <View style={[styles.corner, styles.cTL]} />
          <View style={[styles.corner, styles.cTR]} />
          <View style={[styles.corner, styles.cBL]} />
          <View style={[styles.corner, styles.cBR]} />
        </Animated.View>

        {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
          <CornerHandle key={corner} corner={corner} geometry={g} values={values} />
        ))}
      </View>

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable onPress={onCancel} hitSlop={8} style={styles.textButton} accessibilityRole="button">
          <AppText weight="medium" size={17} color="#fff">
            {t('common.cancel')}
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => reset(g, true)}
          hitSlop={8}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={t('crop.reset')}>
          <RotateCcwIcon size={22} color="#fff" strokeWidth={1.8} />
        </Pressable>
        <Pressable
          onPress={done}
          disabled={busy}
          style={[styles.doneButton, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel={t('common.done')}>
          {busy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <AppText weight="semibold" size={17} color="#fff">
              {t('common.done')}
            </AppText>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const CORNER = 22;
const SHADE = 'rgba(0,0,0,0.6)';
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  hint: { paddingHorizontal: 24, paddingVertical: 12 },
  stage: { flex: 1, overflow: 'hidden' },
  photo: { position: 'absolute' },
  shade: { position: 'absolute', backgroundColor: SHADE },
  shadeTop: { top: 0, left: 0, right: 0 },
  shadeBottom: { left: 0, right: 0, bottom: 0 },
  shadeLeft: { left: 0 },
  shadeRight: { right: 0 },
  frame: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)' },
  gridLine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.35)' },
  gridV: { top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  gridH: { left: 0, right: 0, height: StyleSheet.hairlineWidth },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#fff' },
  cTL: { left: -3, top: -3, borderLeftWidth: 4, borderTopWidth: 4 },
  cTR: { right: -3, top: -3, borderRightWidth: 4, borderTopWidth: 4 },
  cBL: { left: -3, bottom: -3, borderLeftWidth: 4, borderBottomWidth: 4 },
  cBR: { right: -3, bottom: -3, borderRightWidth: 4, borderBottomWidth: 4 },
  handle: { position: 'absolute', width: HANDLE, height: HANDLE },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  textButton: { minWidth: 72, height: 44, justifyContent: 'center' },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  doneButton: { minWidth: 96, height: 44, borderRadius: 22, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
});
