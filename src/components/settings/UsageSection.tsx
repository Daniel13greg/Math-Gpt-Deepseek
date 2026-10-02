import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/hooks/useTheme';
import { t, tp, useT } from '@/i18n';
import { MODELS, modelLabel } from '@/lib/ai/models';
import type { UsageByModel } from '@/lib/types';
import {
  costByModel,
  formatCost,
  formatTokens,
  mergeByModel,
  monthKey,
  totalUsage,
  type ModelPrice,
} from '@/lib/usage';
import { useSettings } from '@/store/settings';
import { toast } from '@/store/toast';
import { useUsage } from '@/store/usage';

import { confirm, Divider, Field, Row, Section } from './SettingsUI';

function summary(byModel: UsageByModel | undefined, prices: Record<string, ModelPrice>): string {
  const total = totalUsage(byModel);
  if (total.requests === 0) return t('usage.none');
  const tokens = total.cacheHitTokens
    ? t('usage.tokensCached', {
        input: formatTokens(total.promptTokens),
        cached: formatTokens(total.cacheHitTokens),
        output: formatTokens(total.completionTokens),
      })
    : t('usage.tokens', { input: formatTokens(total.promptTokens), output: formatTokens(total.completionTokens) });
  const cost = costByModel(byModel, prices);
  return `${tokens}\n${tp('usage.requests', total.requests)}${cost === null ? '' : ` · ${formatCost(cost)}`}`;
}

const PRICE_FIELDS: (keyof ModelPrice)[] = ['input', 'cachedInput', 'output'];

function PriceEditor({ model }: { model: string }) {
  const { t } = useT();
  const price = useUsage((s) => s.prices[model]);
  const setPrice = useUsage((s) => s.setPrice);
  const [draft, setDraft] = useState<Record<keyof ModelPrice, string>>({
    input: price ? String(price.input) : '',
    cachedInput: price ? String(price.cachedInput) : '',
    output: price ? String(price.output) : '',
  });

  const commit = () => {
    const values = PRICE_FIELDS.map((key) => draft[key].trim().replace(',', '.'));
    if (values.every((v) => v === '')) return setPrice(model, null);
    const numbers = values.map(Number);
    if (values.some((v) => v === '') || numbers.some((n) => !Number.isFinite(n) || n < 0)) {
      toast.error(t('usage.priceError'));
      return;
    }
    setPrice(model, { input: numbers[0], cachedInput: numbers[1], output: numbers[2] });
  };

  return (
    <View style={styles.block}>
      <AppText size={15} weight="medium">
        {modelLabel(model)}
      </AppText>
      <View style={styles.prices}>
        {PRICE_FIELDS.map((key) => (
          <View key={key} style={styles.price}>
            <AppText size={12} secondary>
              {t(`usage.price.${key}`)}
            </AppText>
            <Field
              value={draft[key]}
              onChangeText={(v) => setDraft((d) => ({ ...d, [key]: v }))}
              onEndEditing={commit}
              keyboardType="decimal-pad"
              placeholder="0.00"
              accessibilityLabel={t('usage.price.a11y', { model: modelLabel(model), field: t(`usage.price.${key}`) })}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

/** Token usage this month and overall, with optional prices to turn tokens into cost. */
export function UsageSection() {
  const { colors } = useTheme();
  const { t } = useT();
  const months = useUsage((s) => s.months);
  const prices = useUsage((s) => s.prices);
  const selected = useSettings((s) => s.model);
  const thisMonth = months[monthKey()];
  const allTime = mergeByModel(...Object.values(months));
  const models = [...new Set([...MODELS.map((m) => m.id), selected, ...Object.keys(allTime)])];

  return (
    <>
      <Section
        title={t('usage.title')}
        footer={t('usage.footer')}>
        <Row label={t('usage.thisMonth')} detail={summary(thisMonth, prices)} />
        {Object.keys(thisMonth ?? {}).length > 1
          ? Object.entries(thisMonth ?? {}).map(([model, usage]) => (
              <View key={model}>
                <Divider />
                <Row label={`  ${modelLabel(model)}`} detail={summary({ [model]: usage }, prices)} />
              </View>
            ))
          : null}
        <Divider />
        <Row label={t('usage.allTime')} detail={summary(allTime, prices)} />
        <Divider />
        <Row
          label={t('usage.reset')}
          onPress={() =>
            confirm(t('usage.resetConfirm'), t('usage.resetMessage'), () => useUsage.getState().resetStats(), t('usage.reset'))
          }
        />
      </Section>

      <Section
        title={t('usage.prices')}
        footer={t('usage.prices.footer')}>
        {models.map((model, i) => (
          <View key={model}>
            {i > 0 ? <Divider /> : null}
            <PriceEditor model={model} />
          </View>
        ))}
        <Divider />
        <Pressable
          style={styles.block}
          onPress={() => WebBrowser.openBrowserAsync('https://api-docs.deepseek.com/quick_start/pricing')}
          accessibilityRole="link">
          <AppText size={14} color={colors.primary} weight="medium">
            {t('usage.openPricing')}
          </AppText>
        </Pressable>
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  block: { padding: 16, gap: 10 },
  prices: { flexDirection: 'row', gap: 8 },
  price: { flex: 1, gap: 4 },
});
