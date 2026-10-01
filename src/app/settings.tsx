import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckIcon, KeyRoundIcon } from '@/components/icons';
import { confirm, Divider, Field, Row, Section } from '@/components/settings/SettingsUI';
import { UsageSection } from '@/components/settings/UsageSection';
import { AppText } from '@/components/ui/AppText';
import { Segmented } from '@/components/ui/Segmented';
import { ANSWER_STYLES } from '@/constants/answerStyles';
import { APP_NAME } from '@/constants/app';
import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { apiConfig } from '@/lib/api';
import { BackupError } from '@/lib/backup';
import { exportBackup, importBackup } from '@/lib/backupActions';
import { streamChat } from '@/lib/deepseek/client';
import { toDeepSeekError } from '@/lib/deepseek/errors';
import { DEFAULT_BASE_URL, MODELS } from '@/lib/deepseek/models';
import { getSpeechLib } from '@/lib/speech/recognition';
import { useChats } from '@/store/chats';
import { useNotes } from '@/store/notes';
import { useReviews } from '@/store/reviews';
import { useSettings } from '@/store/settings';
import { toast } from '@/store/toast';

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

  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const runExport = async () => {
    setBackingUp(true);
    try {
      await exportBackup();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Couldn't create the backup.");
    } finally {
      setBackingUp(false);
    }
  };

  const runImport = async () => {
    setRestoring(true);
    try {
      const summary = await importBackup();
      if (summary) toast.success(summary);
    } catch (e) {
      toast.error(e instanceof BackupError ? e.message : "Couldn't read that backup.");
    } finally {
      setRestoring(false);
    }
  };

  const saveKey = async () => {
    await settings.setApiKey(keyDraft);
    toast.success(keyDraft.trim() ? 'API key saved' : 'API key removed');
  };

  const testConnection = async () => {
    if (keyDraft.trim() !== settings.apiKey) await settings.setApiKey(keyDraft);
    setTesting(true);
    try {
      const result = await streamChat(apiConfig(), {
        model: useSettings.getState().model,
        thinking: false,
        maxTokens: 8,
        messages: [{ role: 'user', content: 'Reply with OK.' }],
      });
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
              : 'Your key is stored in the device keychain and only sent to the API base URL above.'
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
              <Pressable
                accessibilityRole="button"
                style={[styles.button, { backgroundColor: colors.primary }]}
                onPress={saveKey}>
                <AppText weight="semibold" size={15} color="#fff">
                  Save key
                </AppText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[styles.button, { backgroundColor: colors.segmentBg }]}
                onPress={testConnection}
                disabled={testing}>
                {testing ? <ActivityIndicator size="small" color={colors.text} /> : null}
                <AppText weight="medium" size={15}>
                  Test connection
                </AppText>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => WebBrowser.openBrowserAsync('https://platform.deepseek.com/api_keys')}
              hitSlop={6}>
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
              <Pressable accessibilityRole="button" onPress={() => settings.update({ baseUrl: DEFAULT_BASE_URL })} hitSlop={6}>
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
          <Row
            label="Deep Think"
            detail="Reason step by step before answers, study tools and notes, on every model. Slower, more accurate.">
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

        <Section title="Answer style" footer="Applies to chat answers. Change it any time from the + menu.">
          {ANSWER_STYLES.map((style, i) => (
            <View key={style.id}>
              {i > 0 ? <Divider /> : null}
              <Row label={style.label} detail={style.description} onPress={() => settings.update({ answerStyle: style.id })}>
                {settings.answerStyle === style.id ? <CheckIcon size={20} color={colors.primary} /> : null}
              </Row>
            </View>
          ))}
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

        <UsageSection />

        <Section
          title="Backup"
          footer="A backup file holds your chats (with photos), lecture notes, flashcard progress, usage and settings, but never your API keys. Restoring adds what's missing and keeps the newer copy of anything on both.">
          <Row
            label={backingUp ? 'Preparing backup…' : 'Back up to a file'}
            detail="Save it to Files, Drive or anywhere you like"
            onPress={backingUp ? undefined : runExport}>
            {backingUp ? <ActivityIndicator size="small" color={colors.textMuted} /> : null}
          </Row>
          <Divider />
          <Row label={restoring ? 'Restoring…' : 'Restore from a backup'} onPress={restoring ? undefined : runImport}>
            {restoring ? <ActivityIndicator size="small" color={colors.textMuted} /> : null}
          </Row>
        </Section>

        <Section title="Data" footer="Chats and notes are stored only on this device. Back them up above.">
          <Row
            label="Delete all chats"
            onPress={() =>
              confirm('Delete all chats?', 'This cannot be undone.', () => {
                useChats.getState().deleteAllChats();
                useReviews.getState().forgetAll();
              })
            }
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
  block: { padding: 16, gap: 10 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttons: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  mt: { marginTop: 4 },
  about: { marginTop: 6, lineHeight: 19 },
});
