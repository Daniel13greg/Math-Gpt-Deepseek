import { streamChat, type ClientConfig } from '@/lib/deepseek/client';
import { DEFAULT_VISION_MODEL } from '@/lib/deepseek/models';
import { extractJson } from '@/lib/json';
import { toUnicodeMath } from '@/lib/math';
import { t } from '@/i18n';

export interface DetectedProblem {
  /** As printed on the page ("3", "4b"), or a running number. */
  label: string;
  /** Short plain-text statement for the picker. */
  text: string;
}

export function detectProblemsPrompt(): string {
  return [
    'You look at a photo a student took of their homework or textbook and list the separate problems in it.',
    'Count problems the way the page numbers them. Sub-parts (a, b, c) of one problem stay together as one problem unless the page clearly treats them as separate exercises.',
    'If the photo shows only one problem, return just that one. Ignore page headers, worked examples and answers that are already filled in.',
    'Reply with a single valid JSON object and nothing else: {"problems":[{"label":"3","text":"Solve x² − 5x + 6 = 0"}]}',
    '"label" is the problem number as printed (or 1, 2, 3 if unnumbered). "text" is a short plain-text statement (max 120 characters) with math in Unicode symbols (x², √, ½, π, ≤), never LaTeX.',
  ].join('\n');
}

export function parseProblems(raw: unknown): DetectedProblem[] {
  const list =
    raw && typeof raw === 'object' && Array.isArray((raw as { problems?: unknown }).problems)
      ? ((raw as { problems: unknown[] }).problems as unknown[])
      : [];
  const out: DetectedProblem[] = [];
  list.forEach((item, i) => {
    if (!item || typeof item !== 'object') return;
    const p = item as { label?: unknown; text?: unknown };
    const text = typeof p.text === 'string' ? toUnicodeMath(p.text.trim()).slice(0, 160) : '';
    if (!text) return;
    const label = typeof p.label === 'string' || typeof p.label === 'number' ? String(p.label).trim() : '';
    out.push({ label: label || String(i + 1), text });
  });
  return out.slice(0, 12);
}

/** Lists the problems in a photo with a fast, non-thinking vision call. */
export async function detectProblems(imageDataUrl: string, config: ClientConfig, signal?: AbortSignal): Promise<DetectedProblem[]> {
  const result = await streamChat(
    config,
    {
      model: DEFAULT_VISION_MODEL,
      thinking: false,
      json: true,
      maxTokens: 1500,
      temperature: 0,
      messages: [
        { role: 'system', content: detectProblemsPrompt() },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'List the problems in this photo.' },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
    },
    {},
    signal,
  );
  return parseProblems(extractJson(result.content));
}

/** The visible message once the student has chosen. */
export function problemRequest(choice: DetectedProblem | 'all'): string {
  return choice === 'all' ? t('picker.solveAll') : t('picker.solveOne', { label: choice.label, text: choice.text });
}
