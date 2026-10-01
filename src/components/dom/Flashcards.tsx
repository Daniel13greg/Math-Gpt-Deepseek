'use dom';

import './katex-inline.css';

import { IS_DOM, type DOMProps } from 'expo/dom';
import { useRef, useState, type PointerEvent } from 'react';

import { translator, type LanguageCode } from '@/i18n/strings';
import type { FlashcardDeck } from '@/lib/types';

import { Icon } from './lib/Icon';
import { Markdown } from './lib/Markdown';
import { BASE_CSS } from './lib/styles';

const PAGE_CSS = `html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: transparent; } #root { height: 100%; }`;
const CARDS_CSS = `
.mg.cards { display: flex; flex-direction: column; align-items: stretch; }
.mg .cards-inner { flex: 1; display: flex; flex-direction: column; max-width: 560px; width: 100%; margin: 0 auto; padding: 14px 18px 18px; min-height: 0; }
.mg .cards-top { display: flex; align-items: center; justify-content: space-between; font-size: 14px; color: var(--text-2); }
.mg .tally { display: flex; gap: 10px; }
.mg .tally span { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; }
.mg .bar { height: 6px; border-radius: 3px; background: var(--surface); overflow: hidden; margin: 10px 0 16px; }
.mg .bar > div { height: 100%; background: var(--primary); transition: width .25s; }
.mg .stage { flex: 1; perspective: 1400px; position: relative; min-height: 260px; touch-action: pan-y; }
.mg .flip { position: absolute; inset: 0; transition: transform .45s cubic-bezier(.2,.8,.2,1); transform-style: preserve-3d; cursor: pointer; }
.mg .flip.flipped { transform: rotateY(180deg); }
.mg .face {
  position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden;
  border-radius: 22px; border: 1px solid var(--border); background: var(--bg); box-shadow: var(--shadow);
  display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 26px; text-align: center; overflow-y: auto;
}
.mg .face.back { transform: rotateY(180deg); background: var(--primary-soft); }
.mg .face .md { font-size: 20px; line-height: 1.5; }
.mg .face.back .md { font-size: 18px; }
.mg .face .side { position: absolute; top: 14px; left: 18px; font-size: 12px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--text-3); }
.mg .face .tap { position: absolute; bottom: 14px; font-size: 13px; color: var(--text-3); }
.mg .swipe-hint { position: absolute; top: 18px; padding: 4px 12px; border-radius: 999px; font-weight: 700; font-size: 14px; color: #fff; opacity: 0; transition: opacity .1s; z-index: 2; }
.mg .swipe-hint.know { right: 18px; background: var(--success); }
.mg .swipe-hint.learn { left: 18px; background: var(--danger); }
.mg .card-actions { display: flex; gap: 10px; margin-top: 18px; }
.mg .card-actions .btn { flex: 1; height: 50px; }
.mg .btn.learn { background: var(--danger-soft); color: var(--danger); }
.mg .btn.know { background: var(--success-soft); color: var(--success); }
.mg .tools-row { display: flex; justify-content: center; gap: 6px; margin-top: 10px; }
.mg .done { text-align: center; margin: auto 0; }
.mg .done h2 { margin: 12px 0 6px; font-size: 24px; }
.mg .done .btn { margin-top: 12px; width: 100%; height: 48px; }
.mg .next-review { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; font-size: 14px; color: var(--primary-text); background: var(--primary-soft); border-radius: 999px; padding: 4px 12px; }
`;

interface Props {
  deck: FlashcardDeck;
  scheme: 'light' | 'dark';
  lang: LanguageCode;
  onFlip: () => Promise<void>;
  /** Saves the answer for spaced repetition (card index in the deck). */
  onGrade?: (card: number, gotIt: boolean) => Promise<void>;
  /** Cards to study, in order (review mode passes just the due ones). Defaults to the whole deck. */
  initialOrder?: number[];
  /** Shown when the session ends, e.g. "tomorrow". */
  nextReview?: string | null;
  dom?: DOMProps;
}

function shuffled(n: number) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Flashcards({ deck, scheme, lang, onFlip, onGrade, initialOrder, nextReview }: Props) {
  const { t, tp } = translator(lang);
  const [start] = useState(() => (initialOrder?.length ? initialOrder : deck.cards.map((_, i) => i)));
  const [order, setOrder] = useState(start);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(() => new Set());
  const [learning, setLearning] = useState<Set<number>>(() => new Set());
  const [dragX, setDragX] = useState(0);
  const drag = useRef<{ x: number; id: number; moved: boolean } | null>(null);

  const done = pos >= order.length;
  const card = done ? null : deck.cards[order[pos]];

  const mark = (gotIt: boolean) => {
    if (done) return;
    const id = order[pos];
    onGrade?.(id, gotIt).catch(() => {});
    setKnown((s) => {
      const n = new Set(s);
      if (gotIt) n.add(id);
      else n.delete(id);
      return n;
    });
    setLearning((s) => {
      const n = new Set(s);
      if (gotIt) n.delete(id);
      else n.add(id);
      return n;
    });
    setFlipped(false);
    setDragX(0);
    setPos((p) => p + 1);
  };

  const restart = (subset?: number[]) => {
    setOrder(subset ?? start);
    setPos(0);
    setFlipped(false);
    if (!subset) {
      setKnown(new Set());
      setLearning(new Set());
    }
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, id: e.pointerId, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    const dx = e.clientX - drag.current.x;
    if (Math.abs(dx) > 8) drag.current.moved = true;
    setDragX(dx);
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (Math.abs(dragX) > 90) mark(dragX > 0);
    else {
      setDragX(0);
      if (!d.moved) {
        setFlipped((f) => !f);
        onFlip().catch(() => {});
      }
    }
  };

  return (
    <div
      className="mg cards"
      data-scheme={scheme}
      style={IS_DOM ? { position: 'fixed', inset: 0 } : { flex: 1, minHeight: 0, height: '100%' }}>
      <style>{(IS_DOM ? PAGE_CSS : '') + BASE_CSS + CARDS_CSS}</style>
      <div className="cards-inner">
        <div className="cards-top">
          <span>{done ? `${order.length} / ${order.length}` : `${pos + 1} / ${order.length}`}</span>
          <div className="tally">
            <span style={{ color: 'var(--danger)' }}>
              <Icon name="x" size={14} stroke={3} /> {learning.size}
            </span>
            <span style={{ color: 'var(--success)' }}>
              <Icon name="check" size={14} stroke={3} /> {known.size}
            </span>
          </div>
        </div>
        <div className="bar">
          <div style={{ width: `${(Math.min(pos, order.length) / order.length) * 100}%` }} />
        </div>

        {card ? (
          <>
            <div
              className="stage"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}>
              <div className="swipe-hint know" style={{ opacity: Math.max(0, Math.min(1, dragX / 90)) }}>
                {t('cards.gotIt')}
              </div>
              <div className="swipe-hint learn" style={{ opacity: Math.max(0, Math.min(1, -dragX / 90)) }}>
                {t('cards.stillLearning')}
              </div>
              {/* The fade lives on a wrapper: its fill-mode would otherwise pin transform and block the flip. */}
              <div key={order[pos]} className="fade-in" style={{ position: 'absolute', inset: 0, perspective: 1400 }}>
                <div
                  className={`flip ${flipped ? 'flipped' : ''}`}
                  style={
                    dragX
                      ? {
                          transform: `translateX(${dragX}px) rotate(${dragX / 25}deg) ${flipped ? 'rotateY(180deg)' : ''}`,
                          transition: 'none',
                        }
                      : undefined
                  }>
                  <div className="face front">
                    <span className="side">{t('cards.term')}</span>
                    <Markdown text={card.front} />
                    <span className="tap">{t('cards.tapHint')}</span>
                  </div>
                  <div className="face back">
                    <span className="side">{t('cards.definition')}</span>
                    <Markdown text={card.back} />
                  </div>
                </div>
              </div>
            </div>
            <div className="card-actions">
              <button className="btn learn" onClick={() => mark(false)}>
                <Icon name="x" size={18} stroke={2.5} /> {t('cards.stillLearning')}
              </button>
              <button className="btn know" onClick={() => mark(true)}>
                <Icon name="check" size={18} stroke={2.5} /> {t('cards.gotIt')}
              </button>
            </div>
            <div className="tools-row">
              <button
                className="icon-btn"
                aria-label={t('cards.previous')}
                disabled={pos === 0}
                onClick={() => {
                  setPos((p) => Math.max(0, p - 1));
                  setFlipped(false);
                }}>
                <Icon name="chevronLeft" size={20} />
              </button>
              <button
                className="icon-btn"
                aria-label={t('cards.shuffle')}
                onClick={() => {
                  setOrder(shuffled(deck.cards.length));
                  setPos(0);
                  setFlipped(false);
                }}>
                <Icon name="shuffle" size={19} />
              </button>
              <button className="icon-btn" aria-label={t('cards.restart')} onClick={() => restart()}>
                <Icon name="rotateCcw" size={19} />
              </button>
            </div>
          </>
        ) : (
          <div className="done fade-in">
            <div style={{ fontSize: 46 }}>{learning.size === 0 ? '🎉' : '💪'}</div>
            <h2>
              {t('cards.youKnow', { known: known.size, total: order.length })}
            </h2>
            <div className="muted">
              {learning.size === 0
                ? t('cards.allMastered')
                : tp('cards.needPractice', learning.size)}
            </div>
            {nextReview ? (
              <div className="next-review">
                <Icon name="clock" size={15} /> {t('cards.nextReview', { when: nextReview })}
              </div>
            ) : null}
            {learning.size > 0 ? (
              <button className="btn" onClick={() => restart([...learning])}>
                {tp('cards.practiceMissed', learning.size)}
              </button>
            ) : null}
            <button className="btn secondary" onClick={() => restart()}>
              {t('cards.startOver')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
