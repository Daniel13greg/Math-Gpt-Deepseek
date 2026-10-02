import * as WebBrowser from 'expo-web-browser';
import { useState, type ReactNode } from 'react';
import { useHeaderHeight } from 'expo-router/react-navigation';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckIcon, KeyRoundIcon } from '@/components/icons';
import { AppText } from '@/components/ui/AppText';
import { Segmented } from '@/components/ui/Segmented';
import { APP_NAME } from '@/constants/app';
import { FontFamily, MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { deleteAllChatsWithFiles } from '@/lib/chat/controller';
import { streamChat } from '@/lib/deepseek/client';
import { toDeepSeekError } from '@/lib/deepseek/errors';
import { DEFAULT_BASE_URL, MODELS } from '@/lib/deepseek/models';
import { getSpeechLib } from '@/lib/speech/recognition';
import { useNotes } from '@/store/notes';
import { getApiKey, useSettings } from '@/store/settings';
import { toast } from '@/store/toast';

function Section({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <AppText weight="semibold" size={13} color={colors.textMuted} style={styles.sectionTitle}>
        {title.toUpperCase()}
      </AppText>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>{children}</View>
      {footer ? (
        <AppText size={13} color={colors.textMuted} style={styles.footer}>
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}

function Row({
  label,
  detail,
  children,
  onPress,
}: {
  label: string;
  detail?: string;
  children?: ReactNode;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && onPress && { backgroundColor: colors.surface }]}>
      <View style={styles.rowText}>
        <AppText size={16}>{label}</AppText>
        {detail ? (
          <AppText size={13} secondary>
            {detail}
          </AppText>
        ) : null}
      </View>
      {children}
    </Pressable>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.hairline }]} />;
}

function Field(props: React.ComponentProps<typeof TextInput>) {
  const { colors } = useTheme();
  return (
    <TextInput
      autoCapitalize="none"
      autoCorrect={false}
      placeholderTextColor={colors.textMuted}
      {...props}
      style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }, props.style]}
    />
  );
}

function confirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}

export default function SettingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const settings = useSettings();
  const [keyDraft, setKeyDraft] = useState(settings.apiKey);
  const [sttKeyDraft, setSttKeyDraft] = useState(settings.sttApiKey);
  const [customModel, setCustomModel] = useState(MODELS.some((m) => m.id === settings.model) ? '' : settings.model);
  const [testing, setTesting] = useState(false);
  const envKey = !settings.apiKey && Boolean(process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY);
  const deviceSpeech = getSpeechLib() !== null;

  const saveKey = async () => {
    await settings.setApiKey(keyDraft);
    toast.success(keyDraft.trim() ? 'API key saved' : 'API key removed');
  };

  const testConnection = async () => {
    if (keyDraft.trim() !== settings.apiKey) await settings.setApiKey(keyDraft);
    setTesting(true);
    try {
      const result = await streamChat(
        { apiKey: getApiKey(), baseUrl: useSettings.getState().baseUrl },
        {
          model: useSettings.getState().model,
          thinking: false,
          maxTokens: 8,
          messages: [{ role: 'user', content: 'Reply with OK.' }],
        },
      );
      toast.success(`Connected to ${result.model ?? 'DeepSeek'} ✓`);
    } catch (e) {
      toast.error(toDeepSeekError(e).message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={headerHeight}>
      <ScrollView
        style={{ backgroundColor: colors.surface }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled">
        <Section
          title="DeepSeek API"
          footer={
            envKey
              ? 'Using the key from EXPO_PUBLIC_DEEPSEEK_API_KEY. Saving a key here overrides it.'
              : 'Your key is stored in the device keychain and only sent to the API base URL below.'
          }>
          <View style={styles.block}>
            <View style={styles.labelRow}>
              <KeyRoundIcon size={17} color={colors.textSecondary} />
              <AppText size={15} weight="medium">
                API key
              </AppText>
              {settings.apiKey ? <CheckIcon size={16} color={colors.success} /> : null}
            </View>
            <Field
              value={keyDraft}
              onChangeText={setKeyDraft}
              placeholder="sk-..."
              secureTextEntry
              onSubmitEditing={saveKey}
              accessibilityLabel="DeepSeek API key"
            />
            <View style={styles.buttons}>
              <Pressable style={[styles.button, { backgroundColor: colors.primary }]} onPress={saveKey}>
                <AppText weight="semibold" size={15} color="#fff">
                  Save key
                </AppText>
              </Pressable>
              <Pressable
                style={[styles.button, { backgroundColor: colors.segmentBg }]}
                onPress={testConnection}
                disabled={testing}>
                {testing ? <ActivityIndicator size="small" color={colors.text} /> : null}
                <AppText weight="medium" size={15}>
                  Test connection
                </AppText>
              </Pressable>
            </View>
            <Pressable onPress={() => WebBrowser.openBrowserAsync('https://platform.deepseek.com/api_keys')} hitSlop={6}>
              <AppText size={14} color={colors.primary} weight="medium">
                Get an API key at platform.deepseek.com →
              </AppText>
            </Pressable>
          </View>
          <Divider />
          <View style={styles.block}>
            <AppText size={15} weight="medium">
              API base URL
            </AppText>
            <Field
              value={settings.baseUrl}
              onChangeText={(baseUrl) => settings.update({ baseUrl })}
              placeholder={DEFAULT_BASE_URL}
              keyboardType="url"
              accessibilityLabel="API base URL"
            />
            {settings.baseUrl !== DEFAULT_BASE_URL ? (
              <Pressable onPress={() => settings.update({ baseUrl: DEFAULT_BASE_URL })} hitSlop={6}>
                <AppText size={14} color={colors.primary}>
                  Reset to {DEFAULT_BASE_URL}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        </Section>

        <Section title="Model" footer="Photos are always sent to a vision-capable model (DeepSeek Flash).">
          {MODELS.map((m, i) => (
            <View key={m.id}>
              {i > 0 ? <Divider /> : null}
              <Row label={m.label} detail={m.description} onPress={() => settings.update({ model: m.id })}>
                {settings.model === m.id ? <CheckIcon size={20} color={colors.primary} /> : null}
              </Row>
            </View>
          ))}
          <Divider />
          <View style={styles.block}>
            <AppText size={15} weight="medium">
              Custom model ID
            </AppText>
            <Field
              value={customModel}
              onChangeText={setCustomModel}
              onEndEditing={() => customModel.trim() && settings.update({ model: customModel.trim() })}
              placeholder="e.g. deepseek-chat"
              accessibilityLabel="Custom model ID"
            />
          </View>
          <Divider />
          <Row label="Deep Think" detail="Reason step by step before answering. Slower, more accurate on hard problems.">
            <Switch
              value={settings.thinking}
              onValueChange={(thinking) => settings.update({ thinking })}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#fff"
            />
          </Row>
          {settings.thinking ? (
            <View style={styles.block}>
              <AppText size={15} weight="medium">
                Reasoning effort
              </AppText>
              <Segmented
                value={settings.reasoningEffort}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'high', label: 'High' },
                  { value: 'max', label: 'Max' },
                ]}
                onChange={(reasoningEffort) => settings.update({ reasoningEffort })}
              />
            </View>
          ) : null}
        </Section>

        <Section
          title="Speech to text"
          footer={
            deviceSpeech
              ? 'On-device recognition is free and works offline for many languages. Cloud transcription accepts any audio format.'
              : 'This build has no on-device speech recognition (Expo Go). Use a development build, or cloud transcription.'
          }>
          <View style={styles.block}>
            <Segmented
              value={settings.sttProvider}
              options={[
                { value: 'device', label: 'On device' },
                { value: 'cloud', label: 'Cloud (Whisper API)' },
              ]}
              onChange={(sttProvider) => settings.update({ sttProvider })}
            />
            <AppText size={15} weight="medium" style={styles.mt}>
              Language
            </AppText>
            <Field
              value={settings.speechLang}
              onChangeText={(speechLang) => settings.update({ speechLang })}
              placeholder="en-US"
              accessibilityLabel="Speech language"
            />
          </View>
          {settings.sttProvider === 'cloud' ? (
            <>
              <Divider />
              <View style={styles.block}>
                <AppText size={13} secondary>
                  Any OpenAI-compatible /audio/transcriptions endpoint works (OpenAI, Groq, a local whisper server). DeepSeek has
                  no speech API.
                </AppText>
                <AppText size={15} weight="medium">
                  Base URL
                </AppText>
                <Field
                  value={settings.sttBaseUrl}
                  onChangeText={(sttBaseUrl) => settings.update({ sttBaseUrl })}
                  placeholder="https://api.openai.com/v1"
                  keyboardType="url"
                />
                <AppText size={15} weight="medium">
                  Model
                </AppText>
                <Field
                  value={settings.sttModel}
                  onChangeText={(sttModel) => settings.update({ sttModel })}
                  placeholder="whisper-1"
                />
                <AppText size={15} weight="medium">
                  API key
                </AppText>
                <Field
                  value={sttKeyDraft}
                  onChangeText={setSttKeyDraft}
                  onEndEditing={async () => {
                    await settings.setSttApiKey(sttKeyDraft);
                    toast.success('Transcription key saved');
                  }}
                  placeholder="sk-..."
                  secureTextEntry
                />
              </View>
            </>
          ) : null}
        </Section>

        <Section title="Read aloud">
          <View style={styles.block}>
            <Segmented
              value={settings.ttsRate}
              options={[
                { value: 0.75, label: '0.75×' },
                { value: 1, label: '1×' },
                { value: 1.25, label: '1.25×' },
                { value: 1.5, label: '1.5×' },
              ]}
              onChange={(ttsRate) => settings.update({ ttsRate })}
            />
          </View>
        </Section>

        <Section title="Appearance">
          <View style={styles.block}>
            <Segmented
              value={settings.theme}
              options={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
              onChange={(theme) => settings.update({ theme })}
            />
          </View>
        </Section>

        <Section title="Data" footer="Chats and notes are stored only on this device.">
          <Row
            label="Delete all chats"
            onPress={() => confirm('Delete all chats?', 'This cannot be undone.', deleteAllChatsWithFiles)}
          />
          <Divider />
          <Row
            label="Delete all lecture notes"
            onPress={() =>
              confirm('Delete all notes?', 'This cannot be undone.', () => {
                const { notes, deleteNote } = useNotes.getState();
                Object.keys(notes).forEach(deleteNote);
              })
            }
          />
        </Section>

        <AppText size={13} color={colors.textMuted} align="center" style={styles.about}>
          {APP_NAME} · powered by DeepSeek{'\n'}Answers can be wrong — double-check important work.
        </AppText>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  section: { marginBottom: 22 },
  sectionTitle: { marginLeft: 6, marginBottom: 6, letterSpacing: 0.4 },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  footer: { marginTop: 6, marginHorizontal: 6, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 52 },
  rowText: { flex: 1, gap: 2 },
  divider: { height: 1, marginLeft: 16 },
  block: { padding: 16, gap: 10 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: FontFamily.regular,
  },
  buttons: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  mt: { marginTop: 4 },
  about: { marginTop: 6, lineHeight: 19 },
});
