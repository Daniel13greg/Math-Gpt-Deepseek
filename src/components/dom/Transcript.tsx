'use dom';

import './katex-inline.css';

import { IS_DOM, useDOMImperativeHandle, type DOMProps } from 'expo/dom';
import { memo, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type Ref } from 'react';

import { getTool, isArtifactTool, toolChipLabel } from '@/constants/tools';
import type { AssistantMessage, Message, UserMessage } from '@/lib/types';

import { ArtifactView } from './lib/ArtifactView';
import { Icon, type IconName } from './lib/Icon';
import { Markdown, MathText } from './lib/Markdown';
import { BASE_CSS, TRANSCRIPT_CSS } from './lib/styles';
import type { TranscriptAction, TranscriptHandle } from './transcriptTypes';

interface TranscriptProps {
  messages: Message[];
  chatId: string | null;
  scheme: 'light' | 'dark';
  busy: boolean;
  onAction: (action: TranscriptAction) => Promise<void>;
  ref?: Ref<TranscriptHandle>;
  dom?: DOMProps;
}

type Act = (action: TranscriptAction) => void;

/** Inside the native WebView the transcript owns the whole page. */
const PAGE_CSS = `html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: transparent; } #root { height: 100%; }`;

const TOOL_ICONS: Record<string, IconName> = {
  'check-work': 'clipboardCheck',
  video: 'play',
  'practice-test': 'bookCheck',
  'practice-question': 'circleQuestionMark',
  graph: 'chartScatter',
  diagram: 'pencilRuler',
  'study-guide': 'bookOpen',
  flashcards: 'flashcards',
};

function IconButton({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button className="icon-btn" aria-label={label} title={label} onClick={onClick}>
      <Icon name={icon} size={17} />
    </button>
  );
}

const UserTurn = memo(
  function UserTurn({ m, editable, act }: { m: UserMessage; editable: boolean; act: Act }) {
    return (
      <div className="turn user fade-in">
        {m.images?.length ? (
          <div className={`user-images${m.images.length > 1 ? ' many' : ''}`}>
            {m.images.map((img, i) => (
              <img
                key={img.id}
                src={img.thumb}
                alt="Attached problem"
                onClick={() => act({ type: 'open-image', messageId: m.id, index: i })}
              />
            ))}
          </div>
        ) : null}
        {m.tool ? (
          <span className="tag">
            <Icon name={TOOL_ICONS[m.tool.kind] ?? 'sparkles'} size={13} />
            {toolChipLabel({ kind: m.tool.kind, diagram: m.tool.diagram })}
          </span>
        ) : null}
        {m.text ? <MathText className="bubble" text={m.text} /> : null}
        {editable ? (
          <div className="user-actions">
            <IconButton icon="copy" label="Copy" onClick={() => act({ type: 'copy', messageId: m.id })} />
            <IconButton icon="pencil" label="Edit" onClick={() => act({ type: 'edit', messageId: m.id })} />
          </div>
        ) : null}
      </div>
    );
  },
  (a, b) =>
    a.m.id === b.m.id &&
    a.m.text === b.m.text &&
    a.editable === b.editable &&
    (a.m.images?.length ?? 0) === (b.m.images?.length ?? 0),
);

function Thinking({ m }: { m: AssistantMessage }) {
  const streaming = m.status === 'streaming';
  // Tool replies never stream text; they record thinkingMs once the JSON starts arriving.
  const live = streaming && !m.content && !m.thinkingMs;
  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = open ?? live;
  const seconds = m.thinkingMs ? Math.max(1, Math.round(m.thinkingMs / 1000)) : null;
  const label = live ? 'Thinking…' : seconds ? `Thought for ${seconds}s` : 'Thoughts';
  const reasoning = m.reasoning ?? '';

  return (
    <div className="thinking">
      <button className="thinking-toggle" onClick={() => setOpen(!expanded)} aria-expanded={expanded}>
        <Icon name="brain" size={16} />
        <span className={live ? 'pulse-text' : ''}>{label}</span>
        <Icon name="chevronRight" size={15} className={`chev${expanded ? ' open' : ''}`} />
      </button>
      {expanded && reasoning ? (
        streaming ? (
          <div className="thinking-body live" style={{ whiteSpace: 'pre-wrap' }}>
            {reasoning.slice(-2400)}
          </div>
        ) : (
          <div className="thinking-body">
            <Markdown text={reasoning} />
          </div>
        )
      ) : null}
    </div>
  );
}

const AssistantTurn = memo(
  function AssistantTurn({ m, isLast, busy, act }: { m: AssistantMessage; isLast: boolean; busy: boolean; act: Act }) {
    const streaming = m.status === 'streaming';
    const generatingArtifact = streaming && m.tool && isArtifactTool(m.tool);
    const hasText = m.content.trim().length > 0;
    const settingsError = m.errorKind === 'missing_key' || m.errorKind === 'auth';

    return (
      <div className="turn assistant">
        {m.tool === 'study-guide' ? (
          <span className="tag" style={{ marginBottom: 10 }}>
            <Icon name="bookOpen" size={13} /> Study guide
          </span>
        ) : m.tool === 'check-work' ? (
          <span className="tag" style={{ marginBottom: 10 }}>
            <Icon name="clipboardCheck" size={13} /> Work check
          </span>
        ) : null}

        {m.thinking && (m.reasoning || (streaming && !hasText && !generatingArtifact && !m.progress)) ? <Thinking m={m} /> : null}

        {streaming && !hasText && !m.reasoning && m.progress && !generatingArtifact ? (
          <div className="step-progress pulse-text">{m.progress}</div>
        ) : null}

        {generatingArtifact ? (
          <div className="card progress-card fade-in">
            <div className="progress-icon">
              <Icon name={TOOL_ICONS[m.tool!] ?? 'sparkles'} size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="artifact-title">{getTool(m.tool!).title.replace('Create ', 'Creating ')}</div>
              <div className="artifact-sub pulse-text">{m.progress ?? 'Working…'}</div>
              <div className="shimmer" />
            </div>
          </div>
        ) : null}

        {streaming && !hasText && !m.thinking && !generatingArtifact && !m.progress ? (
          <div className="typing" aria-label="MathGPT is typing">
            <span />
            <span />
            <span />
          </div>
        ) : null}

        {hasText ? <Markdown text={m.content} streaming={streaming} partial={m.status === 'stopped'} /> : null}

        {m.artifact ? (
          <ArtifactView
            artifact={m.artifact}
            onOpen={() => act({ type: 'open-artifact', messageId: m.id })}
            onAnswered={(choice, correct) => act({ type: 'answered', messageId: m.id, choice, correct })}
            onAnother={() => act({ type: 'another-question', messageId: m.id })}
            onPracticeMistakes={() => act({ type: 'practice-mistakes', messageId: m.id })}
          />
        ) : null}

        {m.status === 'error' ? (
          <div className="error-card fade-in">
            <div className="row">
              <Icon name="circleAlert" size={18} />
              <div>{m.error ?? 'Something went wrong.'}</div>
            </div>
            {settingsError ? (
              <button className="btn" onClick={() => act({ type: 'open-settings' })}>
                <Icon name="settings" size={15} /> Open Settings
              </button>
            ) : isLast && !busy ? (
              <button className="btn secondary" onClick={() => act({ type: 'regenerate', messageId: m.id })}>
                <Icon name="refreshCw" size={15} /> Try again
              </button>
            ) : null}
          </div>
        ) : null}

        {m.status === 'stopped' ? <div className="notice">Stopped</div> : null}
        {m.status === 'done' && m.finishReason === 'length' ? (
          <div className="notice">The answer hit the length limit. Ask “continue” to get the rest.</div>
        ) : null}

        {!streaming && m.status !== 'error' ? (
          <div className="actions">
            {hasText ? (
              <>
                <IconButton icon="copy" label="Copy" onClick={() => act({ type: 'copy', messageId: m.id })} />
                <IconButton icon="volume2" label="Read aloud" onClick={() => act({ type: 'speak', messageId: m.id })} />
                <IconButton icon="share2" label="Share" onClick={() => act({ type: 'share', messageId: m.id })} />
                <IconButton icon="fileDown" label="Save as PDF" onClick={() => act({ type: 'export-pdf', messageId: m.id })} />
              </>
            ) : null}
            {isLast && !busy ? (
              <IconButton icon="refreshCw" label="Regenerate" onClick={() => act({ type: 'regenerate', messageId: m.id })} />
            ) : null}
          </div>
        ) : null}
      </div>
    );
  },
  (a, b) =>
    a.isLast === b.isLast &&
    a.busy === b.busy &&
    a.m.id === b.m.id &&
    a.m.status === b.m.status &&
    a.m.content === b.m.content &&
    a.m.reasoning === b.m.reasoning &&
    a.m.progress === b.m.progress &&
    a.m.error === b.m.error &&
    a.m.thinkingMs === b.m.thinkingMs &&
    !!a.m.artifact === !!b.m.artifact &&
    JSON.stringify(a.m.artifact?.kind === 'practice-test' ? a.m.artifact.lastScore : null) ===
      JSON.stringify(b.m.artifact?.kind === 'practice-test' ? b.m.artifact.lastScore : null) &&
    a.m.artifact?.data === b.m.artifact?.data,
);

export default function Transcript({ messages, chatId, scheme, busy, onAction, ref }: TranscriptProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [live, setLive] = useState<Record<string, { content: string; reasoning: string }>>({});

  const act: Act = (action) => {
    onAction(action).catch(() => {});
  };

  const scrollToBottom = (smooth = false) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };

  useDOMImperativeHandle(
    ref as Ref<TranscriptHandle>,
    () => ({
      // Only one reply streams at a time, so keep just its latest text (ids are globally unique).
      patchMessage: (id, content, reasoning) =>
        setLive({ [String(id)]: { content: String(content ?? ''), reasoning: String(reasoning ?? '') } }),
      scrollToBottom: () => {
        pinned.current = true;
        scrollToBottom(true);
      },
    }),
    [],
  );

  // New chat: jump to the latest message.
  useLayoutEffect(() => {
    pinned.current = true;
    scrollToBottom();
  }, [chatId]);

  // A new user message always brings the view to the bottom.
  const lastId = messages[messages.length - 1]?.id;
  const lastRole = messages[messages.length - 1]?.role;
  useEffect(() => {
    if (lastRole === 'user' || lastRole === 'assistant') {
      if (lastRole === 'user') pinned.current = true;
      if (pinned.current) scrollToBottom(true);
    }
  }, [lastId, lastRole]);

  // Keep pinned to the bottom while content grows (streaming, KaTeX, images) or the view shrinks (keyboard).
  useEffect(() => {
    const el = scroller.current;
    const inner = thread.current;
    if (!el || !inner || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (pinned.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(inner);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // Links and code-copy buttons live inside rendered HTML, so handle them by delegation.
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a[data-external-link]');
    if (link) {
      e.preventDefault();
      act({ type: 'open-link', url: link.getAttribute('href') ?? '' });
      return;
    }
    const copy = target.closest('button[data-copy-code]') as HTMLButtonElement | null;
    if (copy) {
      const code = copy.closest('.code-block')?.querySelector('code')?.textContent ?? '';
      act({ type: 'copy-text', text: code });
      copy.textContent = 'Copied';
      setTimeout(() => (copy.textContent = 'Copy'), 1500);
    }
  };

  const lastIndex = messages.length - 1;
  const lastUserIndex = messages.map((m) => m.role).lastIndexOf('user');

  return (
    <div
      ref={scroller}
      className="mg transcript"
      data-scheme={scheme}
      onScroll={onScroll}
      onClick={onClick}
      style={IS_DOM ? { position: 'fixed', inset: 0 } : { flex: 1, minHeight: 0, height: '100%' }}>
      <style>{(IS_DOM ? PAGE_CSS : '') + BASE_CSS + TRANSCRIPT_CSS}</style>
      <div ref={thread} className="thread">
        {messages.map((m, i) => {
          if (m.role === 'user') {
            return <UserTurn key={m.id} m={m} editable={i === lastUserIndex && !busy} act={act} />;
          }
          const patch = m.status === 'streaming' ? live[m.id] : undefined;
          const merged =
            patch && patch.content.length >= m.content.length
              ? { ...m, content: patch.content, reasoning: patch.reasoning || m.reasoning }
              : m;
          return <AssistantTurn key={m.id} m={merged} isLast={i === lastIndex} busy={busy} act={act} />;
        })}
      </div>
    </div>
  );
}
