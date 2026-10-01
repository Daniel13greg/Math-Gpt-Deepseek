import { Image } from 'expo-image';
import { useRef } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { getSubject, type SubjectId } from '@/constants/subjects';
import { toolChipLabel, toolPlaceholder, type ToolSelection } from '@/constants/tools';
import { ArrowUpIcon, BrainIcon, MicIcon, PlusIcon, SquareIcon, ToolCaseIcon, XIcon } from '@/components/icons';
import { AppText } from '@/components/ui/AppText';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { ImageAttachment } from '@/lib/types';

import { ToolIcon } from './ToolIcon';

export interface ComposerProps {
  subject: SubjectId;
  draft: string;
  onDraftChange: (text: string) => void;
  images: ImageAttachment[];
  onRemoveImage: (id: string) => void;
  tool: ToolSelection | null;
  onClearTool: () => void;
  thinking: boolean;
  onToggleThinking: () => void;
  busy: boolean;
  listening: boolean;
  onSend: () => void;
  onStop: () => void;
  onPlus: () => void;
  onTools: () => void;
  onMic: () => void;
}

/** The rounded input card: text field, "+" attachments, Tools, mic and the blue send button. */
export function Composer(props: ComposerProps) {
  const { colors, dark } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const { tool, images } = props;

  const placeholder = tool ? toolPlaceholder(tool) : `Type your ${getSubject(props.subject).noun} question here`;
  const canSend = props.draft.trim().length > 0 || images.length > 0 || tool !== null;

  const send = () => {
    if (props.busy) return props.onStop();
    if (!canSend) return inputRef.current?.focus();
    props.onSend();
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, !dark && styles.cardShadow]}>
      {images.length > 0 ? (
        <Animated.View entering={FadeIn} layout={LinearTransition} style={styles.thumbs}>
          {images.map((img) => (
            <View key={img.id} style={styles.thumbWrap}>
              <Image source={{ uri: img.thumb }} style={[styles.thumb, { borderColor: colors.border }]} contentFit="cover" />
              <Pressable
                onPress={() => props.onRemoveImage(img.id)}
                hitSlop={8}
                style={styles.thumbRemove}
                accessibilityLabel="Remove image">
                <XIcon size={12} color="#FFFFFF" strokeWidth={3} />
              </Pressable>
            </View>
          ))}
        </Animated.View>
      ) : null}

      <TextInput
        ref={inputRef}
        value={props.draft}
        onChangeText={props.onDraftChange}
        placeholder={props.listening ? 'Listening…' : placeholder}
        placeholderTextColor={colors.textMuted}
        multiline
        style={[styles.input, { color: colors.text }]}
        accessibilityLabel="Question"
        submitBehavior={Platform.OS === 'web' ? 'submit' : 'newline'}
        onSubmitEditing={Platform.OS === 'web' ? send : undefined}
      />

      <View style={styles.row}>
        <Pressable onPress={props.onPlus} hitSlop={8} style={styles.iconButton} accessibilityLabel="Add photo or options">
          <PlusIcon size={25} color={colors.icon} strokeWidth={1.8} />
        </Pressable>

        {tool ? (
          <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)}>
            <Pressable
              onPress={props.onClearTool}
              style={[styles.chip, { backgroundColor: colors.primarySoft }]}
              accessibilityLabel={`Remove ${toolChipLabel(tool)} tool`}>
              <ToolIcon kind={tool.kind} size={17} color={colors.primary} />
              <AppText size={14} weight="medium" color={colors.primary} numberOfLines={1} style={styles.chipText}>
                {toolChipLabel(tool)}
              </AppText>
              <XIcon size={14} color={colors.primary} strokeWidth={2.4} />
            </Pressable>
          </Animated.View>
        ) : (
          <Pressable onPress={props.onTools} hitSlop={6} style={styles.tools} accessibilityLabel="Tools">
            <ToolCaseIcon size={20} color={colors.icon} strokeWidth={1.8} />
            <AppText size={15} color={colors.icon}>
              Tools
            </AppText>
          </Pressable>
        )}

        {props.thinking ? (
          <Pressable
            onPress={props.onToggleThinking}
            hitSlop={4}
            style={[styles.chip, styles.thinkChip, tool && styles.thinkChipCompact, { backgroundColor: colors.primarySoft }]}
            accessibilityRole="button"
            accessibilityLabel="Deep Think is on. Tap to turn it off">
            <BrainIcon size={15} color={colors.primary} />
            {tool ? null : (
              <AppText size={13} weight="medium" color={colors.primary}>
                Deep Think
              </AppText>
            )}
          </Pressable>
        ) : null}

        <View style={styles.spacer} />

        <Pressable
          onPress={props.onMic}
          hitSlop={8}
          style={[styles.iconButton, props.listening && { backgroundColor: colors.dangerSoft, borderRadius: 18 }]}
          accessibilityLabel={props.listening ? 'Stop dictation' : 'Dictate question'}>
          <MicIcon size={21} color={props.listening ? colors.danger : colors.icon} strokeWidth={1.8} />
        </Pressable>

        <Pressable
          onPress={send}
          accessibilityRole="button"
          accessibilityLabel={props.busy ? 'Stop generating' : 'Send'}
          style={({ pressed }) => [
            styles.send,
            { backgroundColor: props.busy ? colors.icon : pressed ? colors.primaryPressed : colors.primary },
          ]}>
          {props.busy ? (
            <SquareIcon size={13} color={colors.background} fill={colors.background} />
          ) : (
            <ArrowUpIcon size={21} color={colors.onPrimary} strokeWidth={2.4} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 17,
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  thumbs: { flexDirection: 'row', gap: 8, paddingHorizontal: 6, paddingTop: 4, paddingBottom: 6 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 58, height: 58, borderRadius: 10, borderWidth: 1 },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    fontFamily: FontFamily.regular,
    fontSize: 15.5,
    lineHeight: 22,
    minHeight: 46,
    maxHeight: 150,
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 8,
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, height: 36 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 11,
    marginLeft: 4,
    maxWidth: 190,
  },
  chipText: { flexShrink: 1 },
  thinkChip: { height: 28, paddingHorizontal: 9, gap: 4 },
  // Next to a tool chip there is only room for the icon.
  thinkChipCompact: { width: 28, paddingHorizontal: 0, justifyContent: 'center' },
  spacer: { flex: 1 },
  send: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
});
