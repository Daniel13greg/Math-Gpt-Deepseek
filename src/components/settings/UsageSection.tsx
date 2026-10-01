import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/hooks/useTheme';
import { MODELS, modelLabel } from '@/lib/deepseek/models';
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
  if (total.requests === 0) return 'No requests yet';
  const cached = total.cacheHitTokens ? ` (${formatTokens(total.cacheHitTokens)} cached)` : '';
  const cost = costByModel(byModel, prices);
  return [
    `${formatTokens(total.promptTokens)} in${cached} · ${formatTokens(total.completionTokens)} out`,
    `${total.requests} request${total.requests === 1 ? '' : 's'}${cost === null ? '' : ` · ${formatCost(cost)}`}`,
  ].join('\n');
}

const PRICE_FIELDS: { key: keyof ModelPrice; label: string }[] = [
  { key: 'input', label: 'Input' },
  { key: 'cachedInput', label: 'Cached input' },
  { key: 'output', label: 'Output' },
];

function PriceEditor({ model }: { model: string }) {
  const price = useUsage((s) => s.prices[model]);
  const setPrice = useUsage((s) => s.setPrice);
  const [draft, setDraft] = useState<Record<keyof ModelPrice, string>>({
    input: price ? String(price.input) : '',
    cachedInput: price ? String(price.cachedInput) : '',
    output: price ? String(price.output) : '',
  });

  const commit = () => {
    const values = PRICE_FIELDS.map(({ key }) => draft[key].trim().replace(',', '.'));
    if (values.every((v) => v === '')) return setPrice(model, null);
    const numbers = values.map(Number);
    if (values.some((v) => v === '') || numbers.some((n) => !Number.isFinite(n) || n < 0)) {
      toast.error('Enter all three prices as numbers, or clear them all.');
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
        {PRICE_FIELDS.map(({ key, label }) => (
          <View key={key} style={styles.price}>
            <AppText size={12} secondary>
              {label}
            </AppText>
            <Field
              value={draft[key]}
              onChangeText={(v) => setDraft((d) => ({ ...d, [key]: v }))}
              onEndEditing={commit}
              keyboardType="decimal-pad"
              placeholder="0.00"
              accessibilityLabel={`${modelLabel(model)} ${label.toLowerCase()} price, US dollars per million tokens`}
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
  const months = useUsage((s) => s.months);
  const prices = useUsage((s) => s.prices);
  const selected = useSettings((s) => s.model);
  const thisMonth = months[monthKey()];
  const allTime = mergeByModel(...Object.values(months));
  const models = [...new Set([...MODELS.map((m) => m.id), selected, ...Object.keys(allTime)])];

  return (
    <>
      <Section
        title="Usage"
        footer="Counted on this device from what DeepSeek reports for each request, including answer checks and titles. Your DeepSeek dashboard is the source of truth for billing.">
        <Row label="This month" detail={summary(thisMonth, prices)} />
        {Object.keys(thisMonth ?? {}).length > 1
          ? Object.entries(thisMonth ?? {}).map(([model, usage]) => (
              <View key={model}>
                <Divider />
                <Row label={`  ${modelLabel(model)}`} detail={summary({ [model]: usage }, prices)} />
              </View>
            ))
          : null}
        <Divider />
        <Row label="All time" detail={summary(allTime, prices)} />
        <Divider />
        <Row
          label="Reset usage stats"
          onPress={() => confirm('Reset usage stats?', 'Prices are kept.', () => useUsage.getState().resetStats(), 'Reset')}
        />
      </Section>

      <Section
        title="Prices (USD per 1M tokens)"
        footer="Fill these in from DeepSeek's pricing page to see costs next to token counts. Leave a model blank to show tokens only.">
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
            Open DeepSeek pricing →
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
