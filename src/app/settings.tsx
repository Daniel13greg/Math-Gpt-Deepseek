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
import { isStringKey, LANGUAGES, useT, type StringKey } from '@/i18n';
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
  const { t } = useT();
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
      toast.error(e instanceof Error && e.message ? e.message : t('backup.exportFailed'));
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
      toast.error(e instanceof BackupError ? e.message : t('backup.readFailed'));
    } finally {
      setRestoring(false);
    }
  };

  const saveKey = async () => {
    await settings.setApiKey(keyDraft);
    toast.success(keyDraft.trim() ? t('settings.keySaved') : t('settings.keyRemoved'));
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
      toast.success(t('settings.connected', { model: result.model ?? 'DeepSeek' }));
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
          title={t('settings.api')}
          footer={
            envKey
              ? t('settings.api.envFooter')
              : t('settings.api.footer')
          }>
          <View style={styles.block}>
            <View style={styles.labelRow}>
              <KeyRoundIcon size={17} color={colors.textSecondary} />
              <AppText size={15} weight="medium">
                {t('settings.apiKey')}
              </AppText>
              {settings.apiKey ? <CheckIcon size={16} color={colors.success} /> : null}
            </View>
            <Field
              value={keyDraft}
              onChangeText={setKeyDraft}
              placeholder="sk-..."
              secureTextEntry
              onSubmitEditing={saveKey}
              accessibilityLabel={t('settings.apiKey.a11y')}
            />
            <View style={styles.buttons}>
              <Pressable
                accessibilityRole="button"
                style={[styles.button, { backgroundColor: colors.primary }]}
                onPress={saveKey}>
                <AppText weight="semibold" size={15} color="#fff">
                  {t('settings.saveKey')}
                </AppText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[styles.button, { backgroundColor: colors.segmentBg }]}
                onPress={testConnection}
                disabled={testing}>
                {testing ? <ActivityIndicator size="small" color={colors.text} /> : null}
                <AppText weight="medium" size={15}>
                  {t('settings.testConnection')}
                </AppText>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => WebBrowser.openBrowserAsync('https://platform.deepseek.com/api_keys')}
              hitSlop={6}>
              <AppText size={14} color={colors.primary} weight="medium">
                {t('settings.getKey')}
              </AppText>
            </Pressable>
          </View>
          <Divider />
          <View style={styles.block}>
            <AppText size={15} weight="medium">
              {t('settings.baseUrl')}
            </AppText>
            <Field
              value={settings.baseUrl}
              onChangeText={(baseUrl) => settings.update({ baseUrl })}
              placeholder={DEFAULT_BASE_URL}
              keyboardType="url"
              accessibilityLabel={t('settings.baseUrl')}
            />
            {settings.baseUrl !== DEFAULT_BASE_URL ? (
              <Pressable accessibilityRole="button" onPress={() => settings.update({ baseUrl: DEFAULT_BASE_URL })} hitSlop={6}>
                <AppText size={14} color={colors.primary}>
                  {t('settings.resetTo', { url: DEFAULT_BASE_URL })}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        </Section>

        <Section title={t('attach.model')} footer={t('settings.model.footer')}>
          {MODELS.map((m, i) => (
            <View key={m.id}>
              {i > 0 ? <Divider /> : null}
              <Row
                label={m.label}
                detail={isStringKey(`model.${m.id}.description`) ? t(`model.${m.id}.description` as StringKey) : m.description}
                onPress={() => settings.update({ model: m.id })}>
                {settings.model === m.id ? <CheckIcon size={20} color={colors.primary} /> : null}
              </Row>
            </View>
          ))}
          <Divider />
          <View style={styles.block}>
            <AppText size={15} weight="medium">
              {t('settings.customModel')}
            </AppText>
            <Field
              value={customModel}
              onChangeText={setCustomModel}
              onEndEditing={() => customModel.trim() && settings.update({ model: customModel.trim() })}
              placeholder={t('settings.customModel.placeholder')}
              accessibilityLabel={t('settings.customModel')}
            />
          </View>
          <Divider />
          <Row
            label={t('deepThink.title')}
            detail={t('settings.deepThink.detail')}>
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
                {t('settings.effort')}
              </AppText>
              <Segmented
                value={settings.reasoningEffort}
                options={[
                  { value: 'low', label: t('settings.effort.low') },
                  { value: 'high', label: t('settings.effort.high') },
                  { value: 'max', label: t('settings.effort.max') },
                ]}
                onChange={(reasoningEffort) => settings.update({ reasoningEffort })}
              />
            </View>
          ) : null}
        </Section>

        <Section title={t('answerStyle.title')} footer={t('settings.answerStyle.footer')}>
          {ANSWER_STYLES.map((style, i) => (
            <View key={style}>
              {i > 0 ? <Divider /> : null}
              <Row
                label={t(`answerStyle.${style}`)}
                detail={t(`answerStyle.${style}.description`)}
                onPress={() => settings.update({ answerStyle: style })}>
                {settings.answerStyle === style ? <CheckIcon size={20} color={colors.primary} /> : null}
              </Row>
            </View>
          ))}
        </Section>

        <Section
          title={t('settings.speech')}
          footer={
            deviceSpeech
              ? t('settings.speech.footer')
              : t('settings.speech.footerNoDevice')
          }>
          <View style={styles.block}>
            <Segmented
              value={settings.sttProvider}
              options={[
                { value: 'device', label: t('settings.speech.device') },
                { value: 'cloud', label: t('settings.speech.cloud') },
              ]}
              onChange={(sttProvider) => settings.update({ sttProvider })}
            />
            <AppText size={15} weight="medium" style={styles.mt}>
              {t('settings.speech.language')}
            </AppText>
            <Field
              value={settings.speechLang}
              onChangeText={(speechLang) => settings.update({ speechLang })}
              placeholder="en-US"
              accessibilityLabel={t('settings.speech.language')}
            />
          </View>
          {settings.sttProvider === 'cloud' ? (
            <>
              <Divider />
              <View style={styles.block}>
                <AppText size={13} secondary>
                  {t('settings.speech.cloudHelp')}
                </AppText>
                <AppText size={15} weight="medium">
                  {t('settings.speech.baseUrl')}
                </AppText>
                <Field
                  value={settings.sttBaseUrl}
                  onChangeText={(sttBaseUrl) => settings.update({ sttBaseUrl })}
                  placeholder="https://api.openai.com/v1"
                  keyboardType="url"
                />
                <AppText size={15} weight="medium">
                  {t('attach.model')}
                </AppText>
                <Field
                  value={settings.sttModel}
                  onChangeText={(sttModel) => settings.update({ sttModel })}
                  placeholder="whisper-1"
                />
                <AppText size={15} weight="medium">
                  {t('settings.apiKey')}
                </AppText>
                <Field
                  value={sttKeyDraft}
                  onChangeText={setSttKeyDraft}
                  onEndEditing={async () => {
                    await settings.setSttApiKey(sttKeyDraft);
                    toast.success(t('settings.speech.keySaved'));
                  }}
                  placeholder="sk-..."
                  secureTextEntry
                />
              </View>
            </>
          ) : null}
        </Section>

        <Section title={t('settings.readAloud')}>
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

        <Section title={t('settings.language')} footer={t('settings.language.footer')}>
          <Row label={t('settings.language.system')} onPress={() => settings.update({ language: 'system' })}>
            {settings.language === 'system' ? <CheckIcon size={20} color={colors.primary} /> : null}
          </Row>
          {LANGUAGES.map((language) => (
            <View key={language.code}>
              <Divider />
              <Row label={language.name} onPress={() => settings.update({ language: language.code })}>
                {settings.language === language.code ? <CheckIcon size={20} color={colors.primary} /> : null}
              </Row>
            </View>
          ))}
        </Section>

        <Section title={t('settings.appearance')}>
          <View style={styles.block}>
            <Segmented
              value={settings.theme}
              options={[
                { value: 'system', label: t('settings.theme.system') },
                { value: 'light', label: t('settings.theme.light') },
                { value: 'dark', label: t('settings.theme.dark') },
              ]}
              onChange={(theme) => settings.update({ theme })}
            />
          </View>
        </Section>

        <UsageSection />

        <Section
          title={t('backup.title')}
          footer={t('backup.footer')}>
          <Row
            label={backingUp ? t('backup.preparing') : t('backup.export')}
            detail={t('backup.export.detail')}
            onPress={backingUp ? undefined : runExport}>
            {backingUp ? <ActivityIndicator size="small" color={colors.textMuted} /> : null}
          </Row>
          <Divider />
          <Row label={restoring ? t('backup.restoring') : t('backup.restore')} onPress={restoring ? undefined : runImport}>
            {restoring ? <ActivityIndicator size="small" color={colors.textMuted} /> : null}
          </Row>
        </Section>

        <Section title={t('settings.data')} footer={t('settings.data.footer')}>
          <Row
            label={t('settings.deleteChats')}
            onPress={() =>
              confirm(t('settings.deleteChats.confirm'), t('common.cannotUndo'), () => {
                useChats.getState().deleteAllChats();
                useReviews.getState().forgetAll();
              })
            }
          />
          <Divider />
          <Row
            label={t('settings.deleteNotes')}
            onPress={() =>
              confirm(t('settings.deleteNotes.confirm'), t('common.cannotUndo'), () => {
                const { notes, deleteNote } = useNotes.getState();
                Object.keys(notes).forEach(deleteNote);
              })
            }
          />
        </Section>

        <AppText size={13} color={colors.textMuted} align="center" style={styles.about}>
          {t('settings.about', { app: APP_NAME })}
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
