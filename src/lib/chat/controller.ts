import type { SubjectId } from '@/constants/subjects';
import { isArtifactTool, toolRequestLabel, type ToolSelection } from '@/constants/tools';
import { t } from '@/i18n';
import { apiConfig } from '@/lib/api';
import { streamChat } from '@/lib/ai/client';
import { toApiError } from '@/lib/ai/errors';
import { DEFAULT_VISION_MODEL, isKnownVisionModel, utilityModel } from '@/lib/ai/models';
import { makeId } from '@/lib/id';
import { deleteImageFiles, imageToDataUrl } from '@/lib/images';
import { toUnicodeMath } from '@/lib/math';
import {
  lectureChatContext,
  lectureToolContext,
  titlePrompt,
  toolSystemPrompt,
  toolUserPrompt,
  tutorSystemPrompt,
} from '@/lib/prompts';
import { ArtifactError } from '@/lib/tools/normalize';
import { generateArtifact } from '@/lib/tools/generate';
import { followUpContext, mistakesContext, nextDifficulty } from '@/lib/tools/adaptive';
import type { Artifact, AssistantMessage, ImageAttachment, UserMessage } from '@/lib/types';
import { getChat, useChats } from '@/store/chats';
import { useNotes } from '@/store/notes';
import { useReviews } from '@/store/reviews';
import { useSettings } from '@/store/settings';

import { useProblemPicker } from '@/store/problemPicker';

import { fitToBudget, toApiMessages } from './history';
import { detectProblems, problemRequest } from './problems';

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
  return toolRequestLabel(tool, topic.trim(), t);
}

export interface SendInput {
  text: string;
  images: ImageAttachment[];
  tool: ToolSelection | null;
  subject: SubjectId;
  /** Hidden source material for a tool (lecture notes, missed questions). */
  context?: string;
  /** Visible message text, when it should differ from the generated tool request. */
  label?: string;
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
    text: input.label ?? (input.tool ? toolRequestText(input.tool, text) : text),
    images: input.images.length ? input.images : undefined,
    tool: input.tool
      ? { kind: input.tool.kind, diagram: input.tool.diagram, topic: text, context: input.context }
      : undefined,
  };

  const chat = getChat(chatId)!;
  if (chat.subject !== input.subject) store.setChatSubject(chatId, input.subject);
  if (chat.messages.length === 0 && !chat.titleLocked) {
    const provisional = toUnicodeMath(message.text) || (message.images ? t('chat.photoProblem') : t('drawer.newChat'));
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
    if (tool && isArtifactTool(tool.kind)) {
      update({ progress: t('progress.starting') });
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
        context: tool.context,
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
      // A bare photo may hold several exercises: ask which one before solving.
      if (!tool && userMessage.images?.length === 1 && !userMessage.text.trim()) {
        update({ progress: t('progress.readingPhoto') });
        const problems = await detectProblems(await imageToDataUrl(userMessage.images[0]), config, controller.signal).catch(
          (error) => {
            if (controller.signal.aborted) throw error;
            return [];
          },
        );
        update({ progress: problems.length > 1 ? t('picker.title') : undefined });
        if (problems.length > 1) {
          const choice = await useProblemPicker.getState().ask(problems, controller.signal);
          useChats.getState().updateUser(chatId, userMessage.id, { text: problemRequest(choice) });
          update({ progress: undefined });
        }
      }

      // Study guides are standalone documents; chat replies and work checks see the whole conversation.
      const history = getChat(chatId)?.messages ?? chat.messages;
      const built =
        tool?.kind === 'study-guide'
          ? {
              messages: [{ role: 'user' as const, content: toolUserPrompt('study-guide', tool.topic, undefined, tool.context) }],
              hasImages: false,
            }
          : await toApiMessages(history, { thinking, loadImage: imageToDataUrl });
      const note = chat.noteId ? useNotes.getState().notes[chat.noteId] : undefined;
      const system =
        (tool ? toolSystemPrompt(tool.kind, chat.subject) : tutorSystemPrompt(chat.subject, settings.answerStyle)) +
        (note && tool?.kind !== 'study-guide' ? lectureChatContext(note.title, note.notes, note.transcript) : '');
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
          temperature: tool?.kind === 'study-guide' ? 0.6 : tool?.kind === 'check-work' ? 0.2 : 0.3,
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
    const error = e instanceof ArtifactError ? e : toApiError(e);
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

function findArtifact<K extends Artifact['kind']>(chatId: string, messageId: string, kind: K) {
  const m = getChat(chatId)?.messages.find((x) => x.id === messageId);
  return m?.role === 'assistant' && m.artifact?.kind === kind ? (m.artifact as Extract<Artifact, { kind: K }>) : undefined;
}

/** Remembers the student's answer to a practice question (the card reopens answered; follow-ups adapt). */
export function recordAnswer(chatId: string, messageId: string, choice: number, correct: boolean) {
  useChats
    .getState()
    .updateAssistant(chatId, messageId, (m) =>
      m.artifact?.kind === 'practice-question' ? { artifact: { ...m.artifact, lastAnswer: { choice, correct, at: Date.now() } } } : {},
    );
}

/** "Another question": harder after a right answer, easier on the same idea after a wrong one. */
export async function anotherQuestion(chatId: string, messageId: string): Promise<void> {
  const artifact = findArtifact(chatId, messageId, 'practice-question');
  const chat = getChat(chatId);
  if (!artifact || !chat) return;
  const q = artifact.data;
  const level = nextDifficulty(q.difficulty, artifact.lastAnswer);
  useChats.getState().setActiveChat(chatId);
  await sendMessage({
    text: q.topic,
    images: [],
    tool: { kind: 'practice-question' },
    subject: chat.subject,
    context: followUpContext(q, artifact.lastAnswer),
    label: t(`adaptive.another.${level}`, { topic: q.topic }),
  });
}

/** "Practice my mistakes": a new test aimed at the questions missed in the last attempt. */
export async function practiceMistakes(chatId: string, messageId: string): Promise<void> {
  const artifact = findArtifact(chatId, messageId, 'practice-test');
  const chat = getChat(chatId);
  const context = artifact?.lastScore?.answers ? mistakesContext(artifact.data, artifact.lastScore.answers) : null;
  if (!artifact || !chat || !context) return;
  useChats.getState().setActiveChat(chatId);
  await sendMessage({
    text: artifact.data.topic,
    images: [],
    tool: { kind: 'practice-test' },
    subject: chat.subject,
    context,
    label: t('adaptive.mistakes', { topic: artifact.data.topic }),
  });
}

export type LectureTool = 'flashcards' | 'practice-test' | 'study-guide';


/** Starts a new chat that turns a lecture note into flashcards, a practice test or a study guide. */
export async function studyFromNote(noteId: string, kind: LectureTool, subject: SubjectId): Promise<void> {
  const note = useNotes.getState().notes[noteId];
  if (!note) return;
  useChats.getState().createChat(subject);
  await sendMessage({
    text: note.title,
    images: [],
    tool: { kind },
    subject,
    context: lectureToolContext(note.title, note.notes, note.transcript),
    label: t(`lecture.${kind}`, { title: note.title }),
  });
}

/** Opens a new chat whose answers are grounded in a lecture note. */
export function askAboutNote(noteId: string, subject: SubjectId): void {
  const note = useNotes.getState().notes[noteId];
  if (!note) return;
  const chatId = useChats.getState().createChat(subject, undefined, { noteId });
  useChats.getState().renameChat(chatId, t('lecture.chatTitle', { title: note.title }), true);
}

/** Deletes a chat, the image files it owns and its flashcard review schedules. */
export function deleteChatWithFiles(chatId: string) {
  stopGeneration(chatId);
  const chat = getChat(chatId);
  chat?.messages.forEach((m) => m.role === 'user' && deleteImageFiles(m.images));
  useChats.getState().deleteChat(chatId);
  useReviews.getState().forgetChat(chatId);
}

/** Deletes every chat, the image files they own and their flashcard schedules. */
export function deleteAllChatsWithFiles() {
  for (const chat of Object.values(useChats.getState().chats)) {
    stopGeneration(chat.id);
    chat.messages.forEach((m) => m.role === 'user' && deleteImageFiles(m.images));
  }
  useChats.getState().deleteAllChats();
  useReviews.getState().forgetAll();
}
