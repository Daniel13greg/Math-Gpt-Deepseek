import type { SubjectId } from '@/constants/subjects';
import type { ArtifactToolKind, DiagramKind } from '@/constants/tools';
import { streamChat, type ApiMessage, type ClientConfig } from '@/lib/ai/client';
import { ApiError } from '@/lib/ai/errors';
import type { ReasoningEffort } from '@/lib/ai/models';
import { extractJson } from '@/lib/json';
import { toolSystemPrompt, toolUserPrompt } from '@/lib/prompts';
import type { Artifact, MultipleChoiceQuestion } from '@/lib/types';

import {
  ArtifactError,
  normalizeDiagram,
  normalizeFlashcards,
  normalizeGraph,
  normalizePracticeQuestion,
  normalizePracticeTest,
  normalizeVideo,
} from './normalize';
import { applyKeyChecks, checkAnswerKeys } from './verify';
import { t } from '@/i18n';

export type { ArtifactToolKind };

export function buildArtifact(kind: ArtifactToolKind, raw: unknown, topic: string, diagram?: DiagramKind): Artifact {
  switch (kind) {
    case 'practice-question':
      return { kind, data: normalizePracticeQuestion(raw, topic) };
    case 'practice-test':
      return { kind, data: normalizePracticeTest(raw, topic) };
    case 'flashcards':
      return { kind, data: normalizeFlashcards(raw, topic) };
    case 'graph':
      return { kind, data: normalizeGraph(raw, topic) };
    case 'diagram':
      return { kind, data: normalizeDiagram(raw, diagram ?? 'flowchart', topic) };
    case 'video':
      return { kind, data: normalizeVideo(raw, topic) };
  }
}

/** Friendly progress label computed from the partial JSON streamed so far. */
export function progressLabel(kind: ArtifactToolKind, partial: string): string {
  const count = (key: string) => (partial.match(new RegExp(`"${key}"\\s*:`, 'g')) ?? []).length;
  switch (kind) {
    case 'practice-test': {
      const n = count('question');
      return n > 0 ? t('progress.question', { n }) : t('progress.planTest');
    }
    case 'flashcards': {
      const n = count('front');
      return n > 0 ? t('progress.card', { n }) : t('progress.planCards');
    }
    case 'video': {
      const n = count('heading');
      return n > 0 ? t('progress.scene', { n }) : t('progress.planVideo');
    }
    case 'practice-question':
      return partial.includes('"explanation"') ? t('progress.solution') : t('progress.writeQuestion');
    case 'graph':
      return t('progress.graph');
    case 'diagram':
      return t('progress.diagram');
  }
}

export interface GenerateArtifactOptions {
  config: ClientConfig;
  model: string;
  kind: ArtifactToolKind;
  diagram?: DiagramKind;
  subject: SubjectId;
  topic: string;
  /** Source material the artifact must be based on, e.g. lecture notes or a student's mistakes. */
  context?: string;
  /** Re-solve multiple-choice questions to confirm the answer key (default true). */
  verify?: boolean;
  /** Deep Think: reason before writing the JSON. */
  thinking: boolean;
  reasoningEffort?: ReasoningEffort;
  signal?: AbortSignal;
  onProgress?: (label: string) => void;
  onReasoning?: (delta: string) => void;
  /** Called when the first JSON arrives, i.e. once the model has finished thinking. */
  onThinkingDone?: () => void;
}

/** Generates and validates one artifact. If the reply can't be parsed, the model gets one chance to correct itself. */
async function generateOnce(opts: GenerateArtifactOptions): Promise<Artifact> {
  const messages: ApiMessage[] = [
    { role: 'system', content: toolSystemPrompt(opts.kind, opts.subject, opts.diagram) },
    { role: 'user', content: toolUserPrompt(opts.kind, opts.topic, opts.diagram, opts.context) },
  ];

  for (let attempt = 0; ; attempt++) {
    let partial = '';
    let lastLabel = '';
    let thinkingLabelShown = false;
    const result = await streamChat(
      opts.config,
      {
        model: opts.model,
        messages,
        thinking: opts.thinking,
        reasoningEffort: opts.reasoningEffort,
        json: true,
        maxTokens: opts.thinking ? 32768 : 8192,
        temperature: 0.7,
      },
      {
        onReasoning: (delta) => {
          if (!thinkingLabelShown) {
            thinkingLabelShown = true;
            opts.onProgress?.(t('progress.thinking'));
          }
          opts.onReasoning?.(delta);
        },
        onContent: (delta) => {
          if (!partial) opts.onThinkingDone?.();
          partial += delta;
          const label = progressLabel(opts.kind, partial);
          if (label !== lastLabel) {
            lastLabel = label;
            opts.onProgress?.(label);
          }
        },
      },
      opts.signal,
    );

    try {
      if (!result.content.trim()) throw new ArtifactError(t('artifactError.empty'));
      return buildArtifact(opts.kind, extractJson(result.content), opts.topic, opts.diagram);
    } catch (error) {
      if (error instanceof ApiError || attempt >= 1) {
        if (error instanceof ArtifactError || error instanceof ApiError) throw error;
        throw new ArtifactError(t('artifactError.unreadable'));
      }
      const reason = error instanceof Error ? error.message : 'invalid JSON';
      opts.onProgress?.(t('progress.fixing'));
      messages.push(
        { role: 'assistant', content: result.content, ...(opts.thinking ? { reasoning_content: result.reasoning } : {}) },
        {
          role: 'user',
          content: `That reply could not be used (${reason}). Reply again with only the complete, valid JSON object in exactly the required format.`,
        },
      );
    }
  }
}

/** A practice test keeps at least this many questions before mismatched ones are kept (flagged) instead of dropped. */
const MIN_TEST_QUESTIONS = 4;

/**
 * Generates a tool artifact in JSON mode. Multiple-choice answer keys are then
 * checked by an independent solve: a test drops questions whose key disagrees, and a single
 * question is rewritten once (and flagged if the rewrite disagrees too).
 */
export async function generateArtifact(opts: GenerateArtifactOptions): Promise<Artifact> {
  const artifact = await generateOnce(opts);
  if (opts.verify === false) return artifact;
  const check = (questions: MultipleChoiceQuestion[]) => {
    opts.onProgress?.(t('progress.checking'));
    return checkAnswerKeys(questions, {
      config: opts.config,
      model: opts.model,
      subject: opts.subject,
      thinking: opts.thinking,
      reasoningEffort: opts.reasoningEffort,
      signal: opts.signal,
    });
  };

  if (artifact.kind === 'practice-test') {
    const checks = await check(artifact.data.questions);
    return {
      ...artifact,
      data: { ...artifact.data, questions: applyKeyChecks(artifact.data.questions, checks, MIN_TEST_QUESTIONS) },
    };
  }

  if (artifact.kind === 'practice-question') {
    const [ok] = await check([artifact.data]);
    if (ok !== false) return artifact;
    opts.onProgress?.(t('progress.rewriting'));
    const retry = await generateOnce(opts);
    if (retry.kind !== 'practice-question') return retry;
    const [retryOk] = await check([retry.data]);
    return retryOk === false ? { ...retry, data: { ...retry.data, unverified: true } } : retry;
  }

  return artifact;
}
