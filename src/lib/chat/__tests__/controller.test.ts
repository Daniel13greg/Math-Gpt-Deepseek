/**
 * Integration test of the chat flow: controller → DeepSeek client (fake fetch) → stores.
 * Storage is in memory; everything else is the real code.
 */
import type { AssistantMessage } from '@/lib/types';
import { useChats } from '@/store/chats';
import { DEFAULT_SETTINGS, useSettings } from '@/store/settings';
import { useUsage } from '@/store/usage';

import { isGenerating, sendMessage, stopGeneration } from '../controller';

jest.mock('@/lib/storage/kv', () => {
  const data = new Map<string, string>();
  return {
    kv: {
      getItemSync: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
      removeItem: (k: string) => data.delete(k),
    },
  };
});
// Chats and notes are saved on a timer; nothing needs to persist here.
jest.mock('@/lib/storage/collection', () => ({
  loadCollection: () => ({}),
  createCollectionSaver: () => ({ schedule: () => {}, flush: () => {} }),
}));
jest.mock('@/lib/storage/secure', () => ({ secure: { getSync: () => 'sk-test', set: async () => {} } }));
jest.mock('@/lib/images', () => ({
  imageToDataUrl: async () => 'data:image/jpeg;base64,AAAA',
  deleteImageFiles: () => {},
}));

type Reply = { reasoning?: string; content: string; usage?: { prompt_tokens: number; completion_tokens: number } };

/** Streams an OpenAI-style SSE body, one chunk per delta. */
function sseResponse({ reasoning = '', content, usage }: Reply): Response {
  const events = [
    ...(reasoning ? [{ choices: [{ delta: { reasoning_content: reasoning } }] }] : []),
    ...content.match(/.{1,12}/gs)!.map((piece) => ({ model: 'deepseek-flash', choices: [{ delta: { content: piece } }] })),
    { choices: [{ delta: {}, finish_reason: 'stop' }] },
    { choices: [], usage: usage ?? { prompt_tokens: 100, completion_tokens: 20 } },
  ];
  const chunks = [...events.map((e) => `data: ${JSON.stringify(e)}\n\n`), 'data: [DONE]\n\n'].map((s) =>
    new TextEncoder().encode(s),
  );
  let i = 0;
  return {
    ok: true,
    status: 200,
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'text/event-stream' : null) },
    body: {
      getReader: () => ({
        read: async () => (i < chunks.length ? { done: false, value: chunks[i++] } : { done: true, value: undefined }),
        cancel: async () => {},
      }),
    },
    text: async () => '',
  } as unknown as Response;
}

/** Routes each request by its system prompt, like the mock server. */
function installApi(route: (system: string, body: any) => Reply) {
  const calls: any[] = [];
  globalThis.fetch = jest.fn(async (_url: unknown, init: { body: string }) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    return sseResponse(route(body.messages[0]?.content ?? '', body));
  }) as unknown as typeof fetch;
  return calls;
}

const lastAssistant = () => {
  const chat = useChats.getState().chats[useChats.getState().activeChatId!];
  return chat.messages[chat.messages.length - 1] as AssistantMessage;
};

beforeEach(() => {
  useChats.getState().deleteAllChats();
  useSettings.setState({ ...DEFAULT_SETTINGS, apiKey: 'sk-test', baseUrl: 'https://api.test' });
  useUsage.getState().resetStats();
});

describe('sendMessage', () => {
  it('streams a reply with Deep Think into a new chat, then titles it and records usage', async () => {
    const calls = installApi((system) =>
      system.includes('short title')
        ? { content: 'Solving a Quadratic', usage: { prompt_tokens: 30, completion_tokens: 4 } }
        : { reasoning: 'factor it', content: 'Factor: (x-2)(x-3). **Final answer:** x = 2 or 3' },
    );

    await sendMessage({ text: 'Solve x^2 - 5x + 6 = 0', images: [], tool: null, subject: 'math' });
    await new Promise((r) => setTimeout(r, 0)); // title request runs after the reply

    const reply = lastAssistant();
    expect(reply.status).toBe('done');
    expect(reply.content).toContain('**Final answer:**');
    expect(reply.reasoning).toBe('factor it');
    expect(calls[0].thinking).toEqual({ type: 'enabled' });
    expect(calls[0].messages[0].content).toContain('Solve step by step');

    const chat = useChats.getState().chats[useChats.getState().activeChatId!];
    expect(chat.title).toBe('Solving a Quadratic');
    expect(calls[1].model).toBe('deepseek-flash');
    expect(calls[1].thinking).toEqual({ type: 'disabled' });
    expect(chat.usage?.['deepseek-flash']).toMatchObject({ requests: 2, promptTokens: 130 });
    expect(Object.values(useUsage.getState().months)[0]['deepseek-flash'].requests).toBe(2);
  });

  it('uses the tutor prompt when tutor mode is on', async () => {
    useSettings.setState({ answerStyle: 'tutor' });
    const calls = installApi(() => ({ content: 'Hint: what multiplies to 6?' }));
    await sendMessage({ text: 'Solve x^2 - 5x + 6 = 0', images: [], tool: null, subject: 'math' });
    expect(calls[0].messages[0].content).toContain('Socratic tutor');
  });

  it('generates a practice question with thinking and checks its key', async () => {
    const question = {
      topic: 'Quadratics',
      difficulty: 'easy',
      question: 'Roots of x^2 - 1?',
      choices: ['±1', '1', '0', '2'],
      answerIndex: 0,
      explanation: 'Difference of squares.',
    };
    const calls = installApi((system) =>
      system.includes('examiner')
        ? { content: JSON.stringify({ answers: [{ q: 1, answer: 'A' }] }) }
        : system.includes('short title')
          ? { content: 'Quadratics practice' }
          : { reasoning: 'plan', content: JSON.stringify(question) },
    );

    await sendMessage({ text: 'quadratics', images: [], tool: { kind: 'practice-question' }, subject: 'math' });

    const reply = lastAssistant();
    expect(reply.status).toBe('done');
    expect(reply.artifact?.kind).toBe('practice-question');
    expect(reply.thinkingMs).toBeGreaterThanOrEqual(0);
    expect(calls[0].thinking).toEqual({ type: 'enabled' });
    expect(calls[0].response_format).toEqual({ type: 'json_object' });
    expect(calls[1].messages[0].content).toContain('examiner');
  });

  it('marks the reply stopped when the student stops it', async () => {
    let release: () => void = () => {};
    globalThis.fetch = jest.fn(
      (_url: unknown, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          release = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          init.signal.addEventListener('abort', () => release());
        }),
    ) as unknown as typeof fetch;

    const pending = sendMessage({ text: 'Long question', images: [], tool: null, subject: 'math' });
    await new Promise((r) => setTimeout(r, 0));
    const chatId = useChats.getState().activeChatId!;
    expect(isGenerating(chatId)).toBe(true);
    stopGeneration(chatId);
    await pending;

    expect(lastAssistant().status).toBe('stopped');
    expect(isGenerating(chatId)).toBe(false);
  });

  it('shows a friendly error when the key is rejected', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      status: 401,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ error: { message: 'Authentication Fails' } }),
    })) as unknown as typeof fetch;

    await sendMessage({ text: 'Hi', images: [], tool: null, subject: 'math' });
    expect(lastAssistant()).toMatchObject({ status: 'error', errorKind: 'auth' });
    expect(lastAssistant().error).toContain('API key was rejected');
  });
});
