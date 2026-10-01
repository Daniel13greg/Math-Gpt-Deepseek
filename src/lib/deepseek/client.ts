import { DeepSeekError, errorFromResponse, toDeepSeekError } from './errors';
import { DEFAULT_BASE_URL, type ReasoningEffort } from './models';
import { SSEParser } from './sse';

export type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

export type ApiMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | ContentPart[] }
  | { role: 'assistant'; content: string; reasoning_content?: string };

export interface ChatRequest {
  model: string;
  messages: ApiMessage[];
  /** DeepSeek V4 thinking mode (`thinking.type`). The API defaults to enabled, so we always send it. */
  thinking: boolean;
  reasoningEffort?: ReasoningEffort;
  maxTokens?: number;
  /** Ignored by the API in thinking mode, so it is only sent when thinking is off. */
  temperature?: number;
  /** Ask for a JSON object (`response_format: json_object`). The prompt must mention "json". */
  json?: boolean;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  reasoningTokens?: number;
  cacheHitTokens?: number;
}

export interface ChatResult {
  content: string;
  reasoning: string;
  finishReason: string | null;
  usage?: Usage;
  model?: string;
}

export interface StreamHandlers {
  onContent?: (delta: string) => void;
  onReasoning?: (delta: string) => void;
}

export interface ClientConfig {
  apiKey: string;
  baseUrl?: string;
  /** Injected in tests; defaults to the global fetch (expo/fetch on native, which streams). */
  fetch?: typeof fetch;
}

export function chatCompletionsUrl(baseUrl: string | undefined): string {
  const base = (baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
  return `${base}/chat/completions`;
}

export function buildRequestBody(req: ChatRequest, stream: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
    stream,
    thinking: { type: req.thinking ? 'enabled' : 'disabled' },
  };
  if (stream) body.stream_options = { include_usage: true };
  if (req.thinking && req.reasoningEffort) body.reasoning_effort = req.reasoningEffort;
  if (req.maxTokens) body.max_tokens = req.maxTokens;
  if (!req.thinking && req.temperature !== undefined) body.temperature = req.temperature;
  if (req.json) body.response_format = { type: 'json_object' };
  return body;
}

/**
 * Thinking mode in DeepSeek V4 wants prior turns' `reasoning_content` echoed back,
 * while older deployments rejected the field. When the API complains about it we
 * retry once with the field added (empty where unknown) or stripped.
 */
export function patchReasoningContent(messages: ApiMessage[], mode: 'add' | 'strip'): ApiMessage[] {
  return messages.map((m) => {
    if (m.role !== 'assistant') return m;
    if (mode === 'strip') {
      const { reasoning_content: _omit, ...rest } = m;
      return rest;
    }
    return { ...m, reasoning_content: m.reasoning_content ?? '' };
  });
}

function extractApiMessage(text: string): string | undefined {
  if (!text) return undefined;
  try {
    const json = JSON.parse(text);
    return json?.error?.message ?? json?.message ?? text.slice(0, 300);
  } catch {
    return text.slice(0, 300);
  }
}

function mapUsage(raw: any): Usage | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  return {
    promptTokens: raw.prompt_tokens ?? 0,
    completionTokens: raw.completion_tokens ?? 0,
    reasoningTokens: raw.completion_tokens_details?.reasoning_tokens,
    cacheHitTokens: raw.prompt_cache_hit_tokens,
  };
}

/** Accumulates streamed chunks (or a single non-streamed body) into a ChatResult. */
class ResultBuilder {
  content = '';
  reasoning = '';
  finishReason: string | null = null;
  usage: Usage | undefined;
  model: string | undefined;
  done = false;

  constructor(private handlers: StreamHandlers) {}

  /** Handles one SSE `data:` payload. */
  handleData(data: string) {
    if (data === '[DONE]') {
      this.done = true;
      return;
    }
    let json: any;
    try {
      json = JSON.parse(data);
    } catch {
      return; // Ignore malformed keep-alive noise.
    }
    if (json.error) {
      const message = json.error.message ?? 'Unknown error';
      throw new DeepSeekError('server', `DeepSeek reported an error: ${message}`, { apiMessage: message });
    }
    if (json.model) this.model = json.model;
    const choice = json.choices?.[0];
    if (choice) {
      const delta = choice.delta ?? choice.message ?? {};
      if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
        this.reasoning += delta.reasoning_content;
        this.handlers.onReasoning?.(delta.reasoning_content);
      }
      if (typeof delta.content === 'string' && delta.content) {
        this.content += delta.content;
        this.handlers.onContent?.(delta.content);
      }
      if (choice.finish_reason) this.finishReason = choice.finish_reason;
    }
    if (json.usage) this.usage = mapUsage(json.usage);
  }

  result(): ChatResult {
    return {
      content: this.content,
      reasoning: this.reasoning,
      finishReason: this.finishReason,
      usage: this.usage,
      model: this.model,
    };
  }
}

async function attempt(
  config: ClientConfig,
  req: ChatRequest,
  handlers: StreamHandlers,
  signal: AbortSignal | undefined,
): Promise<ChatResult> {
  if (!config.apiKey) {
    throw new DeepSeekError('missing_key', 'Add your DeepSeek API key in Settings to start solving.');
  }
  const fetchImpl = config.fetch ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(chatCompletionsUrl(config.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(buildRequestBody(req, true)),
      signal,
    });
  } catch (error) {
    throw toDeepSeekError(error);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw errorFromResponse(response.status, extractApiMessage(text));
  }

  const builder = new ResultBuilder(handlers);
  const contentType = response.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('application/json')) {
      // Server ignored `stream: true`; treat the whole body as one message.
      builder.handleData(await response.text());
      return builder.result();
    }

    const parser = new SSEParser();
    const body = response.body as ReadableStream<Uint8Array> | null;
    if (!body || typeof body.getReader !== 'function') {
      // Fetch implementation without streaming support: parse once the body has arrived.
      for (const message of [...parser.feed(await response.text()), ...parser.end()]) {
        builder.handleData(message.data);
      }
      return builder.result();
    }

    const reader = body.getReader();
    const decoder = new TextDecoder();
    while (!builder.done) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const message of parser.feed(decoder.decode(value, { stream: true }))) {
        builder.handleData(message.data);
        if (builder.done) break;
      }
    }
    for (const message of [...parser.feed(decoder.decode()), ...parser.end()]) {
      builder.handleData(message.data);
    }
    if (builder.done) reader.cancel().catch(() => {});
  } catch (error) {
    throw toDeepSeekError(error);
  }

  return builder.result();
}

/**
 * Sends a chat completion request and streams the reply.
 * Resolves with the full content once the stream completes; rejects with a DeepSeekError.
 */
export async function streamChat(
  config: ClientConfig,
  req: ChatRequest,
  handlers: StreamHandlers = {},
  signal?: AbortSignal,
): Promise<ChatResult> {
  try {
    return await attempt(config, req, handlers, signal);
  } catch (error) {
    const apiMessage = error instanceof DeepSeekError ? error.apiMessage : undefined;
    if (error instanceof DeepSeekError && error.kind === 'bad_request' && apiMessage && /reasoning_content/i.test(apiMessage)) {
      const mode = /must be passed|missing|required/i.test(apiMessage) ? 'add' : 'strip';
      return attempt(config, { ...req, messages: patchReasoningContent(req.messages, mode) }, handlers, signal);
    }
    throw error;
  }
}
