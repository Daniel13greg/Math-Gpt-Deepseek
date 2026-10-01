import type { ApiMessage, ContentPart } from '@/lib/deepseek/client';
import type { Artifact, ImageAttachment, Message } from '@/lib/types';

const LETTERS = 'ABCDEFGH';

/** Text stand-in for a tool artifact so follow-up questions ("explain question 3") have context. */
export function artifactSummary(artifact: Artifact): string {
  switch (artifact.kind) {
    case 'practice-question': {
      const q = artifact.data;
      return [
        `[I created a ${q.difficulty} practice question on ${q.topic}.]`,
        q.question,
        ...q.choices.map((c, i) => `${LETTERS[i]}) ${c}`),
        `Correct answer: ${LETTERS[q.answerIndex]}`,
        `Explanation: ${q.explanation}`,
      ].join('\n');
    }
    case 'practice-test': {
      const t = artifact.data;
      const lines = t.questions.map(
        (q, i) => `${i + 1}. ${q.question} (answer: ${LETTERS[q.answerIndex]}) ${q.choices[q.answerIndex] ?? ''}`,
      );
      const score = artifact.lastScore ? `\nThe student scored ${artifact.lastScore.correct}/${artifact.lastScore.total}.` : '';
      return `[I created a practice test "${t.title}" with ${t.questions.length} questions.]\n${lines.join('\n')}${score}`;
    }
    case 'flashcards':
      return `[I created ${artifact.data.cards.length} flashcards titled "${artifact.data.title}".]\n${artifact.data.cards
        .map((c) => `- ${c.front} → ${c.back}`)
        .join('\n')}`;
    case 'graph': {
      const g = artifact.data;
      const fns = g.functions.map((f) => f.label).join('; ');
      return `[I graphed ${fns} for x in [${g.xMin}, ${g.xMax}].]\n${g.explanation}`;
    }
    case 'diagram': {
      const d = artifact.data;
      let detail = '';
      if (d.type === 'flowchart') detail = d.nodes.map((n) => n.label).join(' → ');
      else if (d.type === 'mindmap') detail = `${d.root.label}: ${d.root.children.map((c) => c.label).join(', ')}`;
      else if (d.type === 'venn') detail = `Sets: ${d.sets.join(', ')}`;
      return `[I drew a diagram "${d.title}". ${detail}]\n${d.caption}`;
    }
    case 'video':
      return `[I created a video lesson "${artifact.data.title}".]\n${artifact.data.scenes
        .map((s, i) => `Scene ${i + 1} – ${s.heading}: ${s.narration}`)
        .join('\n')}`;
  }
}

export interface BuildOptions {
  /** Echo `reasoning_content` of earlier turns (DeepSeek thinking mode wants it back). */
  thinking: boolean;
  /** Only the most recent N image-bearing user messages keep their images. */
  maxImageMessages?: number;
  loadImage: (image: ImageAttachment) => Promise<string>;
}

/** Converts stored chat messages into DeepSeek API messages (after the system prompt). */
export async function toApiMessages(
  messages: Message[],
  opts: BuildOptions,
): Promise<{ messages: ApiMessage[]; hasImages: boolean }> {
  const keepImagesFrom = new Set(
    messages
      .filter((m) => m.role === 'user' && m.images?.length)
      .slice(-(opts.maxImageMessages ?? 3))
      .map((m) => m.id),
  );

  const out: ApiMessage[] = [];
  let hasImages = false;

  for (const m of messages) {
    if (m.role === 'user') {
      const text = m.text.trim() || (m.images?.length ? 'Solve the problem in this image step by step.' : '');
      if (m.images?.length && keepImagesFrom.has(m.id)) {
        hasImages = true;
        const parts: ContentPart[] = [{ type: 'text', text }];
        for (const image of m.images) parts.push({ type: 'image_url', image_url: { url: await opts.loadImage(image) } });
        out.push({ role: 'user', content: parts });
      } else {
        const note = m.images?.length ? `${text}\n[An image was attached earlier in the conversation.]` : text;
        out.push({ role: 'user', content: note });
      }
      continue;
    }

    // Failed or empty replies carry no information; skip them.
    const content = m.artifact ? artifactSummary(m.artifact) : m.content.trim();
    if (!content) continue;
    const assistant: ApiMessage = { role: 'assistant', content };
    if (opts.thinking && m.reasoning) assistant.reasoning_content = m.reasoning;
    out.push(assistant);
  }

  return { messages: mergeConsecutive(out), hasImages };
}

/** DeepSeek rejects some successive same-role turns; merge them. */
export function mergeConsecutive(messages: ApiMessage[]): ApiMessage[] {
  const out: ApiMessage[] = [];
  for (const m of messages) {
    const prev = out[out.length - 1];
    if (!prev || prev.role !== m.role || m.role === 'system') {
      out.push(m);
      continue;
    }
    if (prev.role === 'user' && m.role === 'user') {
      const toParts = (c: string | ContentPart[]): ContentPart[] => (typeof c === 'string' ? [{ type: 'text', text: c }] : c);
      const merged = [...toParts(prev.content), ...toParts(m.content)];
      out[out.length - 1] = {
        role: 'user',
        content: merged.every((p) => p.type === 'text') ? merged.map((p) => (p as { text: string }).text).join('\n\n') : merged,
      };
    } else if (prev.role === 'assistant' && m.role === 'assistant') {
      out[out.length - 1] = { ...prev, content: `${prev.content}\n\n${m.content}` };
    }
  }
  return out;
}
