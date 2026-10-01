import type { SubjectId } from '@/constants/subjects';
import type { DiagramKind, ToolKind } from '@/constants/tools';
import { streamChat, type ApiMessage, type ClientConfig } from '@/lib/deepseek/client';
import { DeepSeekError } from '@/lib/deepseek/errors';
import { extractJson } from '@/lib/json';
import { toolSystemPrompt, toolUserPrompt } from '@/lib/prompts';
import type { Artifact } from '@/lib/types';

import {
  ArtifactError,
  normalizeDiagram,
  normalizeFlashcards,
  normalizeGraph,
  normalizePracticeQuestion,
  normalizePracticeTest,
  normalizeVideo,
} from './normalize';

export type ArtifactToolKind = Exclude<ToolKind, 'study-guide'>;

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
      return n > 0 ? `Writing question ${n}…` : 'Planning your practice test…';
    }
    case 'flashcards': {
      const n = count('front');
      return n > 0 ? `Writing card ${n}…` : 'Choosing key terms…';
    }
    case 'video': {
      const n = count('heading');
      return n > 0 ? `Scripting scene ${n}…` : 'Planning your video lesson…';
    }
    case 'practice-question':
      return partial.includes('"explanation"') ? 'Writing the solution…' : 'Writing your question…';
    case 'graph':
      return 'Plotting your graph…';
    case 'diagram':
      return 'Drawing your diagram…';
  }
}

export interface GenerateArtifactOptions {
  config: ClientConfig;
  model: string;
  kind: ArtifactToolKind;
  diagram?: DiagramKind;
  subject: SubjectId;
  topic: string;
  signal?: AbortSignal;
  onProgress?: (label: string) => void;
}

/**
 * Generates a tool artifact with DeepSeek JSON mode. If the reply can't be parsed
 * or validated, the model gets one chance to correct itself.
 */
export async function generateArtifact(opts: GenerateArtifactOptions): Promise<Artifact> {
  const messages: ApiMessage[] = [
    { role: 'system', content: toolSystemPrompt(opts.kind, opts.subject, opts.diagram) },
    { role: 'user', content: toolUserPrompt(opts.kind, opts.topic, opts.diagram) },
  ];

  for (let attempt = 0; ; attempt++) {
    let partial = '';
    let lastLabel = '';
    const result = await streamChat(
      opts.config,
      { model: opts.model, messages, thinking: false, json: true, maxTokens: 8192, temperature: 0.7 },
      {
        onContent: (delta) => {
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
      if (!result.content.trim()) throw new ArtifactError('The reply was empty.');
      return buildArtifact(opts.kind, extractJson(result.content), opts.topic, opts.diagram);
    } catch (error) {
      if (error instanceof DeepSeekError || attempt >= 1) {
        if (error instanceof ArtifactError || error instanceof DeepSeekError) throw error;
        throw new ArtifactError("DeepSeek's reply couldn't be read. Please try again.");
      }
      const reason = error instanceof Error ? error.message : 'invalid JSON';
      opts.onProgress?.('Fixing a formatting issue…');
      messages.push(
        { role: 'assistant', content: result.content },
        {
          role: 'user',
          content: `That reply could not be used (${reason}). Reply again with only the complete, valid JSON object in exactly the required format.`,
        },
      );
    }
  }
}
