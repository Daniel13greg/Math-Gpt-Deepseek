import { buildRequestBody, chatCompletionsUrl, patchReasoningContent, streamChat, type ChatRequest } from '../client';
import { DeepSeekError } from '../errors';

/** Minimal Response stand-in whose body yields the given byte chunks. */
function fakeResponse(status: number, chunks: Uint8Array[], contentType = 'text/event-stream') {
  let i = 0;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    body: {
      getReader: () => ({
        read: async () => (i < chunks.length ? { done: false, value: chunks[i++] } : { done: true, value: undefined }),
        cancel: async () => {},
      }),
    },
    text: async () => new TextDecoder().decode(concat(chunks)),
  } as unknown as Response;
}

function concat(chunks: Uint8Array[]) {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/** Splits bytes into fixed-size chunks so multi-byte UTF-8 characters straddle boundaries. */
function chunked(text: string, size: number) {
  const bytes = new TextEncoder().encode(text);
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += size) chunks.push(bytes.slice(i, i + size));
  return chunks;
}

const sse = (payloads: unknown[]) => payloads.map((p) => `data: ${typeof p === 'string' ? p : JSON.stringify(p)}\n\n`).join('');

const baseRequest: ChatRequest = {
  model: 'deepseek-flash',
  thinking: false,
  messages: [{ role: 'user', content: 'Solve x^2 = 4' }],
};

describe('buildRequestBody', () => {
  it('always sends the thinking toggle and stream options', () => {
    expect(buildRequestBody(baseRequest, true)).toEqual({
      model: 'deepseek-flash',
      messages: baseRequest.messages,
      stream: true,
      stream_options: { include_usage: true },
      thinking: { type: 'disabled' },
    });
  });

  it('adds reasoning effort only in thinking mode and temperature only outside it', () => {
    const thinking = buildRequestBody({ ...baseRequest, thinking: true, reasoningEffort: 'max', temperature: 0.2 }, true);
    expect(thinking.thinking).toEqual({ type: 'enabled' });
    expect(thinking.reasoning_effort).toBe('max');
    expect(thinking.temperature).toBeUndefined();

    const fast = buildRequestBody({ ...baseRequest, reasoningEffort: 'max', temperature: 0.2, json: true, maxTokens: 900 }, true);
    expect(fast.reasoning_effort).toBeUndefined();
    expect(fast.temperature).toBe(0.2);
    expect(fast.response_format).toEqual({ type: 'json_object' });
    expect(fast.max_tokens).toBe(900);
  });
});

describe('chatCompletionsUrl', () => {
  it('normalizes trailing slashes and defaults to the DeepSeek API', () => {
    expect(chatCompletionsUrl(undefined)).toBe('https://api.deepseek.com/chat/completions');
    expect(chatCompletionsUrl('https://proxy.example.com/v1///')).toBe('https://proxy.example.com/v1/chat/completions');
  });
});

describe('streamChat', () => {
  const config = (fetchImpl: jest.Mock, retryDelaysMs: number[] = []) => ({
    apiKey: 'sk-test',
    fetch: fetchImpl as unknown as typeof fetch,
    retryDelaysMs,
  });

  it('streams reasoning and content deltas, tolerating keep-alives and split UTF-8', async () => {
    const body =
      ': keep-alive\n\n' +
      sse([
        { model: 'deepseek-flash', choices: [{ delta: { reasoning_content: 'Think: √4 ' } }] },
        { choices: [{ delta: { reasoning_content: '= ±2' } }] },
        { choices: [{ delta: { content: 'The roots are ' } }] },
        { choices: [{ delta: { content: '$x = \\pm 2$ ✓' }, finish_reason: 'stop' }] },
        { choices: [], usage: { prompt_tokens: 12, completion_tokens: 30, completion_tokens_details: { reasoning_tokens: 8 } } },
        '[DONE]',
      ]);
    const fetchImpl = jest.fn().mockResolvedValue(fakeResponse(200, chunked(body, 7)));
    const reasoning: string[] = [];
    const content: string[] = [];

    const result = await streamChat(
      config(fetchImpl),
      { ...baseRequest, thinking: true },
      {
        onReasoning: (d) => reasoning.push(d),
        onContent: (d) => content.push(d),
      },
    );

    expect(result.reasoning).toBe('Think: √4 = ±2');
    expect(result.content).toBe('The roots are $x = \\pm 2$ ✓');
    expect(result.finishReason).toBe('stop');
    expect(result.model).toBe('deepseek-flash');
    expect(result.usage).toEqual({ promptTokens: 12, completionTokens: 30, reasoningTokens: 8, cacheHitTokens: undefined });
    expect(reasoning.join('')).toBe(result.reasoning);
    expect(content.join('')).toBe(result.content);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.deepseek.com/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
    expect(JSON.parse(init.body).thinking).toEqual({ type: 'enabled' });
  });

  it('accepts a non-streamed JSON body', async () => {
    const json = JSON.stringify({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }] });
    const fetchImpl = jest.fn().mockResolvedValue(fakeResponse(200, chunked(json, 1000), 'application/json'));
    const result = await streamChat(config(fetchImpl), baseRequest);
    expect(result.content).toBe('{"ok":true}');
  });

  it.each([
    [401, 'auth'],
    [402, 'balance'],
    [429, 'rate_limit'],
    [503, 'overloaded'],
    [500, 'server'],
  ])('maps HTTP %i to %s', async (status, kind) => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(fakeResponse(status, chunked(JSON.stringify({ error: { message: 'nope' } }), 100), 'application/json'));
    await expect(streamChat(config(fetchImpl), baseRequest)).rejects.toMatchObject({ kind, status });
  });

  it('requires an API key before making a request', async () => {
    const fetchImpl = jest.fn();
    await expect(streamChat({ apiKey: '', fetch: fetchImpl as any }, baseRequest)).rejects.toMatchObject({ kind: 'missing_key' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('wraps network failures and aborts', async () => {
    const network = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    await expect(streamChat(config(network), baseRequest)).rejects.toMatchObject({ kind: 'network' });

    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const aborted = jest.fn().mockRejectedValue(abortError);
    await expect(streamChat(config(aborted), baseRequest)).rejects.toMatchObject({ kind: 'aborted' });
  });

  it('surfaces errors sent inside the stream', async () => {
    const body = sse([{ choices: [{ delta: { content: 'partial' } }] }, { error: { message: 'Content risk' } }]);
    const fetchImpl = jest.fn().mockResolvedValue(fakeResponse(200, chunked(body, 64)));
    await expect(streamChat(config(fetchImpl), baseRequest)).rejects.toBeInstanceOf(DeepSeekError);
  });

  it('retries once with reasoning_content echoed back when the API asks for it', async () => {
    const error = JSON.stringify({
      error: { message: 'The `reasoning_content` in the thinking mode must be passed back to the API.' },
    });
    const ok = sse([{ choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] }, '[DONE]']);
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(fakeResponse(400, chunked(error, 100), 'application/json'))
      .mockResolvedValueOnce(fakeResponse(200, chunked(ok, 100)));

    const req: ChatRequest = {
      ...baseRequest,
      thinking: true,
      messages: [
        { role: 'user', content: 'a' },
        { role: 'assistant', content: 'b' },
        { role: 'user', content: 'c' },
      ],
    };
    const result = await streamChat(config(fetchImpl), req);
    expect(result.content).toBe('ok');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const retried = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(retried.messages[1]).toEqual({ role: 'assistant', content: 'b', reasoning_content: '' });
  });
  it('retries rate limits and network errors with backoff before anything streams', async () => {
    const limited = JSON.stringify({ error: { message: 'Rate limit reached' } });
    const ok = sse([{ choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] }, '[DONE]']);
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(fakeResponse(429, chunked(limited, 100), 'application/json'))
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(fakeResponse(200, chunked(ok, 100)));
    const result = await streamChat(config(fetchImpl, [0, 0]), baseRequest);
    expect(result.content).toBe('ok');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('gives up after the last retry and never retries auth errors', async () => {
    const overloaded = () => fakeResponse(503, chunked('{}', 100), 'application/json');
    const busy = jest.fn().mockImplementation(async () => overloaded());
    await expect(streamChat(config(busy, [0, 0]), baseRequest)).rejects.toMatchObject({ kind: 'overloaded' });
    expect(busy).toHaveBeenCalledTimes(3);

    const denied = jest.fn().mockResolvedValue(fakeResponse(401, chunked('{}', 100), 'application/json'));
    await expect(streamChat(config(denied, [0, 0]), baseRequest)).rejects.toMatchObject({ kind: 'auth' });
    expect(denied).toHaveBeenCalledTimes(1);
  });

  it('does not retry once text has streamed, so output is never duplicated', async () => {
    const body = sse([{ choices: [{ delta: { content: 'partial' } }] }, { error: { message: 'Server busy' } }]);
    const fetchImpl = jest.fn().mockImplementation(async () => fakeResponse(200, chunked(body, 64)));
    await expect(streamChat(config(fetchImpl, [0, 0]), baseRequest)).rejects.toMatchObject({ kind: 'server' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('stops waiting to retry when aborted', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    const controller = new AbortController();
    const pending = streamChat(config(fetchImpl, [60_000]), baseRequest, {}, controller.signal);
    await Promise.resolve();
    controller.abort();
    await expect(pending).rejects.toMatchObject({ kind: 'aborted' });
  });

  it('drops JSON mode when the API refuses it alongside thinking', async () => {
    const error = JSON.stringify({ error: { message: 'response_format json_object is not supported in thinking mode' } });
    const ok = sse([{ choices: [{ delta: { content: '{"a":1}' }, finish_reason: 'stop' }] }, '[DONE]']);
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(fakeResponse(400, chunked(error, 100), 'application/json'))
      .mockResolvedValueOnce(fakeResponse(200, chunked(ok, 100)));
    const result = await streamChat(config(fetchImpl), { ...baseRequest, thinking: true, json: true });
    expect(result.content).toBe('{"a":1}');
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).response_format).toEqual({ type: 'json_object' });
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).response_format).toBeUndefined();
  });
});

describe('patchReasoningContent', () => {
  it('strips or fills reasoning_content on assistant turns only', () => {
    const messages = [
      { role: 'system' as const, content: 's' },
      { role: 'assistant' as const, content: 'a', reasoning_content: 'r' },
    ];
    expect(patchReasoningContent(messages, 'strip')[1]).toEqual({ role: 'assistant', content: 'a' });
    expect(patchReasoningContent(messages, 'add')[1]).toEqual({ role: 'assistant', content: 'a', reasoning_content: 'r' });
    expect(patchReasoningContent(messages, 'add')[0]).toBe(messages[0]);
  });
});
