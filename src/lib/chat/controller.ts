import type { SubjectId } from '@/constants/subjects';
import { getDiagramKind, getTool, type ToolSelection } from '@/constants/tools';
import { apiConfig } from '@/lib/api';
import { streamChat } from '@/lib/deepseek/client';
import { toDeepSeekError } from '@/lib/deepseek/errors';
import { DEFAULT_VISION_MODEL, isKnownVisionModel, utilityModel } from '@/lib/deepseek/models';
import { makeId } from '@/lib/id';
import { deleteImageFiles, imageToDataUrl } from '@/lib/images';
import { toUnicodeMath } from '@/lib/math';
import { titlePrompt, toolSystemPrompt, toolUserPrompt, tutorSystemPrompt } from '@/lib/prompts';
import { ArtifactError } from '@/lib/tools/normalize';
import { generateArtifact } from '@/lib/tools/generate';
import type { AssistantMessage, ImageAttachment, UserMessage } from '@/lib/types';
import { getChat, useChats } from '@/store/chats';
import { useSettings } from '@/store/settings';

import { fitToBudget, toApiMessages } from './history';

/**
 * Tokens of conversation history sent with each request. Older turns are dropped beyond this,
 * which keeps long chats fast and cheap and well inside the context window.
 */
const HISTORY_TOKEN_BUDGET = 48_000;

/** One in-flight request per chat. */
const inflight = new Map<string, AbortController>();

export function isGenerating(chatId: string | null | undefined): boolean {
  return !!chatId && inflight.has(chatId);
}

export function stopGeneration(chatId: string | null | undefined) {
  if (chatId) inflight.get(chatId)?.abort();
}

/** Requests made for a chat (replies, answer checks, its title) count towards its usage. */
function chatApiConfig(chatId: string) {
  return apiConfig((usage, model) => useChats.getState().addChatUsage(chatId, model, usage));
}

export function toolRequestText(tool: ToolSelection, topic: string): string {
  const t = topic.trim();
  if (tool.kind === 'diagram') {
    const name = getDiagramKind(tool.diagram).title.toLowerCase();
    return t ? `Create a ${name} of ${t}` : `Create a ${name}`;
  }
  const { request } = getTool(tool.kind);
  return t ? `${request} ${t}` : request.replace(/\s+(on|about|of)$/, '');
}

export interface SendInput {
  text: string;
  images: ImageAttachment[];
  tool: ToolSelection | null;
  subject: SubjectId;
}

/** Appends the user's message to the active chat (creating one if needed) and streams the reply. */
export async function sendMessage(input: SendInput): Promise<void> {
  const store = useChats.getState();
  let chatId = store.activeChatId;
  if (!chatId || !store.chats[chatId]) chatId = store.createChat(input.subject);
  if (isGenerating(chatId)) return;

  const text = input.text.trim();
  const message: UserMessage = {
    id: makeId('m'),
    role: 'user',
    createdAt: Date.now(),
    text: input.tool ? toolRequestText(input.tool, text) : text,
    images: input.images.length ? input.images : undefined,
    tool: input.tool ? { kind: input.tool.kind, diagram: input.tool.diagram, topic: text } : undefined,
  };

  const chat = getChat(chatId)!;
  if (chat.subject !== input.subject) store.setChatSubject(chatId, input.subject);
  if (chat.messages.length === 0) {
    const provisional = toUnicodeMath(message.text) || (message.images ? 'Photo problem' : 'New chat');
    store.renameChat(chatId, provisional.length > 48 ? `${provisional.slice(0, 47)}…` : provisional, false);
  }
  store.addMessage(chatId, message);
  await runAssistant(chatId);
}

/** Drops the given assistant reply (and anything after it) and asks again. */
export async function regenerate(chatId: string, assistantId: string): Promise<void> {
  if (isGenerating(chatId)) return;
  const chat = getChat(chatId);
  const index = chat?.messages.findIndex((m) => m.id === assistantId) ?? -1;
  if (!chat || index < 1 || chat.messages[index - 1].role !== 'user') return;
  useChats.getState().truncateFrom(chatId, assistantId);
  await runAssistant(chatId);
}

/** Removes a user message and everything after it, returning it so the UI can put it back in the composer. */
export function editFrom(chatId: string, userMessageId: string): UserMessage | undefined {
  if (isGenerating(chatId)) return undefined;
  const message = getChat(chatId)?.messages.find((m): m is UserMessage => m.id === userMessageId && m.role === 'user');
  if (message) useChats.getState().truncateFrom(chatId, userMessageId);
  return message;
}

/** Batches streamed deltas into store updates (~16 per second) to keep rendering smooth. */
function createUpdater(chatId: string, messageId: string) {
  let content = '';
  let reasoning = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    useChats.getState().updateAssistant(chatId, messageId, { content, reasoning: reasoning || undefined });
  };
  const schedule = () => {
    if (!timer) timer = setTimeout(flush, 60);
  };
  return {
    content: (delta: string) => {
      content += delta;
      schedule();
    },
    reasoning: (delta: string) => {
      reasoning += delta;
      schedule();
    },
    flush,
  };
}

async function runAssistant(chatId: string): Promise<void> {
  const settings = useSettings.getState();
  const chat = getChat(chatId);
  const userMessage = chat?.messages[chat.messages.length - 1];
  if (!chat || !userMessage || userMessage.role !== 'user') return;

  const tool = userMessage.tool;
  // Deep Think applies to every model (Flash included) and to study tools as well as chat.
  const thinking = settings.thinking;
  const assistantId = makeId('m');
  const startedAt = Date.now();
  useChats.getState().addMessage(chatId, {
    id: assistantId,
    role: 'assistant',
    createdAt: startedAt,
    content: '',
    status: 'streaming',
    thinking,
    tool: tool?.kind,
    model: settings.model,
  });

  const controller = new AbortController();
  inflight.set(chatId, controller);
  const update = (patch: Partial<AssistantMessage>) => useChats.getState().updateAssistant(chatId, assistantId, patch);
  const config = chatApiConfig(chatId);

  try {
    if (tool && tool.kind !== 'study-guide') {
      update({ progress: 'Getting started…' });
      const updater = createUpdater(chatId, assistantId);
      let reasoned = false;
      let thinkingMs: number | undefined;
      const artifact = await generateArtifact({
        config,
        model: settings.model,
        kind: tool.kind,
        diagram: tool.diagram,
        subject: chat.subject,
        topic: tool.topic,
        thinking,
        reasoningEffort: settings.reasoningEffort,
        signal: controller.signal,
        onProgress: (progress) => update({ progress }),
        onReasoning: (delta) => {
          reasoned = true;
          updater.reasoning(delta);
        },
        onThinkingDone: () => {
          updater.flush();
          if (reasoned && thinkingMs === undefined) {
            thinkingMs = Date.now() - startedAt;
            update({ thinkingMs });
          }
        },
      });
      updater.flush();
      update({ artifact, status: 'done', progress: undefined, content: '' });
    } else {
      // Study guides are standalone documents; chat replies see the whole conversation.
      const built = tool
        ? {
            messages: [{ role: 'user' as const, content: toolUserPrompt('study-guide', tool.topic) }],
            hasImages: false,
          }
        : await toApiMessages(chat.messages, { thinking, loadImage: imageToDataUrl });
      const system = tool ? toolSystemPrompt('study-guide', chat.subject) : tutorSystemPrompt(chat.subject);
      const messages = [{ role: 'system' as const, content: system }, ...fitToBudget(built.messages, HISTORY_TOKEN_BUDGET)];
      const model = built.hasImages && !isKnownVisionModel(settings.model) ? DEFAULT_VISION_MODEL : settings.model;

      const updater = createUpdater(chatId, assistantId);
      let firstContentAt: number | null = null;
      const result = await streamChat(
        config,
        {
          model,
          messages,
          thinking,
          reasoningEffort: settings.reasoningEffort,
          maxTokens: thinking ? 32768 : 8192,
          temperature: tool ? 0.6 : 0.3,
        },
        {
          onReasoning: updater.reasoning,
          onContent: (delta) => {
            if (firstContentAt === null) firstContentAt = Date.now();
            updater.content(delta);
          },
        },
        controller.signal,
      );
      updater.flush();
      update({
        content: result.content,
        reasoning: result.reasoning || undefined,
        status: 'done',
        model: result.model ?? model,
        finishReason: result.finishReason,
        thinkingMs: thinking && result.reasoning ? (firstContentAt ?? Date.now()) - startedAt : undefined,
      });
    }
  } catch (e) {
    const error = e instanceof ArtifactError ? e : toDeepSeekError(e);
    if ('kind' in error && error.kind === 'aborted') {
      update({ status: 'stopped', progress: undefined });
    } else {
      update({
        status: 'error',
        progress: undefined,
        error: error.message,
        errorKind: 'kind' in error ? error.kind : 'artifact',
      });
    }
  } finally {
    inflight.delete(chatId);
  }

  void maybeGenerateTitle(chatId);
}

async function maybeGenerateTitle(chatId: string) {
  const chat = getChat(chatId);
  if (!chat || chat.titleLocked) return;
  const user = chat.messages.find((m) => m.role === 'user');
  const reply = chat.messages.find((m): m is AssistantMessage => m.role === 'assistant' && m.status === 'done');
  if (!user || !reply) return;

  const replyText = reply.artifact ? '' : reply.content.slice(0, 400);
  try {
    const result = await streamChat(chatApiConfig(chatId), {
      model: utilityModel(useSettings.getState().model),
      thinking: false,
      maxTokens: 24,
      temperature: 0.3,
      messages: [
        { role: 'system', content: titlePrompt() },
        {
          role: 'user',
          content: `Message: ${user.role === 'user' ? user.text || '(photo of a problem)' : ''}\nReply begins: ${replyText}`,
        },
      ],
    });
    const title = result.content
      .replace(/^["'“”#*\s]+|["'“”.*\s]+$/g, '')
      .split('\n')[0]
      .slice(0, 60);
    if (title) useChats.getState().renameChat(chatId, title, true);
  } catch {
    // Keep the provisional title.
  }
}

/** Deletes a chat and the image files it owns. */
export function deleteChatWithFiles(chatId: string) {
  stopGeneration(chatId);
  const chat = getChat(chatId);
  chat?.messages.forEach((m) => m.role === 'user' && deleteImageFiles(m.images));
  useChats.getState().deleteChat(chatId);
}
