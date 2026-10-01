import type { Message } from '@/lib/types';

import { artifactSummary, mergeConsecutive, toApiMessages } from '../history';

const image = (id: string) => ({ id, uri: `file:///${id}.jpg`, thumb: 'data:thumb', width: 10, height: 10 });
const loadImage = async (img: { id: string }) => `data:image/jpeg;base64,${img.id}`;

describe('toApiMessages', () => {
  it('keeps images only for the most recent image messages and echoes reasoning in thinking mode', async () => {
    const messages: Message[] = [
      { id: 'u1', role: 'user', text: '', createdAt: 1, images: [image('a')] },
      { id: 'a1', role: 'assistant', content: 'Solved A', reasoning: 'thought A', status: 'done', createdAt: 2 },
      { id: 'u2', role: 'user', text: 'And this?', createdAt: 3, images: [image('b')] },
    ];
    const { messages: out, hasImages } = await toApiMessages(messages, { thinking: true, maxImageMessages: 1, loadImage });
    expect(hasImages).toBe(true);
    expect(out[0]).toEqual({
      role: 'user',
      content: 'Solve the problem in this image step by step.\n[An image was attached earlier in the conversation.]',
    });
    expect(out[1]).toEqual({ role: 'assistant', content: 'Solved A', reasoning_content: 'thought A' });
    expect(out[2]).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: 'And this?' },
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,b' } },
      ],
    });
  });

  it('skips failed replies and merges the resulting consecutive user turns', async () => {
    const messages: Message[] = [
      { id: 'u1', role: 'user', text: 'first', createdAt: 1 },
      { id: 'a1', role: 'assistant', content: '', status: 'error', error: 'boom', createdAt: 2 },
      { id: 'u2', role: 'user', text: 'second', createdAt: 3 },
    ];
    const { messages: out } = await toApiMessages(messages, { thinking: false, loadImage });
    expect(out).toEqual([{ role: 'user', content: 'first\n\nsecond' }]);
  });

  it('summarizes artifacts so follow-ups have context', async () => {
    const messages: Message[] = [
      { id: 'u1', role: 'user', text: 'Create a practice question on limits', createdAt: 1 },
      {
        id: 'a1',
        role: 'assistant',
        content: '',
        status: 'done',
        createdAt: 2,
        artifact: {
          kind: 'practice-question',
          data: {
            topic: 'limits',
            difficulty: 'easy',
            question: 'lim x→0 sin x / x?',
            choices: ['0', '1', '∞', 'undefined'],
            answerIndex: 1,
            explanation: 'Standard limit.',
          },
        },
      },
    ];
    const { messages: out } = await toApiMessages(messages, { thinking: false, loadImage });
    expect(out[1].content).toContain('Correct answer: B');
    expect(out[1]).not.toHaveProperty('reasoning_content');
  });
});

describe('mergeConsecutive', () => {
  it('keeps image parts when merging user turns', () => {
    const merged = mergeConsecutive([
      { role: 'user', content: 'a' },
      { role: 'user', content: [{ type: 'image_url', image_url: { url: 'x' } }] },
    ]);
    expect(merged).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'a' },
          { type: 'image_url', image_url: { url: 'x' } },
        ],
      },
    ]);
  });
});

describe('artifactSummary', () => {
  it('describes a flowchart by its steps', () => {
    const text = artifactSummary({
      kind: 'diagram',
      data: {
        type: 'flowchart',
        title: 'Loop',
        caption: 'cap',
        nodes: [
          { id: 'a', label: 'Start', shape: 'start' },
          { id: 'b', label: 'End', shape: 'end' },
        ],
        edges: [{ from: 'a', to: 'b' }],
      },
    });
    expect(text).toContain('Start → End');
  });
});
