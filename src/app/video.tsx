import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import VideoScene from '@/components/dom/VideoScene';
import { PauseIcon, PlayIcon, RotateCcwIcon, SkipBackIcon, SkipForwardIcon, Volume2Icon, XIcon } from '@/components/icons';
import { AppText } from '@/components/ui/AppText';
import { useArtifact } from '@/hooks/useArtifact';
import { useSettings } from '@/store/settings';

/** Rough speaking time: ~2.6 words per second at 1× rate. */
function estimateMs(text: string, rate: number) {
  const words = text.trim().split(/\s+/).length;
  return Math.max(2500, (words / 2.6 / rate) * 1000);
}

function SceneBar({ state, durationMs, playing }: { state: 'done' | 'current' | 'todo'; durationMs: number; playing: boolean }) {
  const progress = useSharedValue(state === 'done' ? 1 : 0);
  const previous = useRef(state);
  useEffect(() => {
    if (state === 'current') {
      // A scene that just became current starts from empty; a resumed one continues.
      if (previous.current !== 'current') progress.set(0);
      if (playing) progress.set(withTiming(1, { duration: durationMs * (1 - progress.get()), easing: Easing.linear }));
      else cancelAnimation(progress);
    } else {
      cancelAnimation(progress);
      progress.set(state === 'done' ? 1 : 0);
    }
    previous.current = state;
  }, [state, playing, durationMs, progress]);
  const fill = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));
  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.segmentFill, fill]} />
    </View>
  );
}

/** "Create Video" player: animated slides narrated with on-device text-to-speech. */
export default function VideoScreen() {
  const { artifact } = useArtifact('video');
  const insets = useSafeAreaInsets();
  const rate = useSettings((s) => s.ttsRate);
  const language = useSettings((s) => s.speechLang);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [ended, setEnded] = useState(false);
  const token = useRef(0);

  const scenes = artifact?.data.scenes ?? [];
  const scene = scenes[index];
  const duration = scene ? estimateMs(scene.narration, rate) : 0;

  useEffect(() => {
    if (!scene || !playing) return;
    const my = ++token.current;
    let advanced = false;
    const advance = () => {
      if (advanced || token.current !== my) return;
      advanced = true;
      setTimeout(() => {
        if (token.current !== my) return;
        if (index < scenes.length - 1) setIndex((i) => i + 1);
        else {
          setPlaying(false);
          setEnded(true);
        }
      }, 700);
    };
    const startedAt = Date.now();
    let speechFallback: ReturnType<typeof setTimeout> | undefined;
    // If text-to-speech fails (no engine or voice installed), keep the scene up for its estimated length.
    const onSpeechError = () => {
      speechFallback = setTimeout(advance, Math.max(0, duration - (Date.now() - startedAt)));
    };
    if (!muted) {
      Speech.speak(scene.narration, { rate, language, onDone: advance, onError: onSpeechError });
    }
    // Speech callbacks aren't guaranteed everywhere; never get stuck on a scene.
    const fallback = setTimeout(advance, muted ? duration : duration * 1.8 + 3000);
    return () => {
      clearTimeout(fallback);
      if (speechFallback) clearTimeout(speechFallback);
      void Speech.stop();
    };
  }, [index, playing, muted, scene, scenes.length, rate, language, duration]);

  useEffect(() => () => void Speech.stop(), []);

  if (!artifact || !scene) {
    return (
      <View style={[styles.screen, styles.center]}>
        <AppText color="#fff">This video lesson is no longer available.</AppText>
      </View>
    );
  }

  const goTo = (i: number) => {
    token.current++;
    setEnded(false);
    setIndex(Math.max(0, Math.min(scenes.length - 1, i)));
  };

  const togglePlay = () => {
    if (ended) {
      setEnded(false);
      setIndex(0);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.roundButton}
          accessibilityLabel="Close video">
          <XIcon size={22} color="#fff" />
        </Pressable>
        <AppText weight="semibold" size={16} color="#fff" numberOfLines={1} style={styles.title}>
          {artifact.data.title}
        </AppText>
        <Pressable
          accessibilityRole="button"
          onPress={() => setMuted((m) => !m)}
          hitSlop={12}
          style={[styles.roundButton, muted && styles.mutedButton]}
          accessibilityLabel={muted ? 'Unmute narration' : 'Mute narration'}>
          <Volume2Icon size={20} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.bars}>
        {scenes.map((_, i) => (
          <SceneBar
            key={i}
            state={ended || i < index ? 'done' : i === index ? 'current' : 'todo'}
            durationMs={i === index ? duration : 0}
            playing={playing && i === index}
          />
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        style={styles.stage}
        onPress={togglePlay}
        accessibilityLabel={playing ? 'Pause' : 'Play'}>
        <VideoScene
          heading={scene.heading}
          body={scene.body}
          index={index}
          total={scenes.length}
          playing={playing}
          dom={{ style: { flex: 1 }, containerStyle: { flex: 1 }, scrollEnabled: false, bounces: false }}
        />
      </Pressable>

      <View style={styles.caption}>
        <AppText size={16} color="#E8EEF5" align="center" style={styles.captionText} numberOfLines={4}>
          {scene.narration}
        </AppText>
      </View>

      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 14) + 6 }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => goTo(index - 1)}
          disabled={index === 0}
          hitSlop={10}
          style={[styles.control, index === 0 && styles.disabled]}
          accessibilityLabel="Previous scene">
          <SkipBackIcon size={26} color="#fff" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={togglePlay}
          style={styles.play}
          accessibilityLabel={ended ? 'Replay' : playing ? 'Pause' : 'Play'}>
          {ended ? (
            <RotateCcwIcon size={28} color="#0F2236" />
          ) : playing ? (
            <PauseIcon size={28} color="#0F2236" fill="#0F2236" />
          ) : (
            <PlayIcon size={28} color="#0F2236" fill="#0F2236" />
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => goTo(index + 1)}
          disabled={index >= scenes.length - 1}
          hitSlop={10}
          style={[styles.control, index >= scenes.length - 1 && styles.disabled]}
          accessibilityLabel="Next scene">
          <SkipForwardIcon size={26} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B1520' },
  center: { alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 10 },
  title: { flex: 1, textAlign: 'center' },
  roundButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutedButton: { opacity: 0.45 },
  bars: { flexDirection: 'row', gap: 4, paddingHorizontal: 16, paddingBottom: 10 },
  segment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' },
  segmentFill: { height: '100%', backgroundColor: '#FFFFFF' },
  stage: { flex: 1 },
  caption: { paddingHorizontal: 22, paddingVertical: 14, minHeight: 92, justifyContent: 'center' },
  captionText: { lineHeight: 23 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 44, paddingTop: 6 },
  control: { padding: 6 },
  disabled: { opacity: 0.3 },
  play: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});
