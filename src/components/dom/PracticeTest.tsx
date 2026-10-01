'use dom';

import './katex-inline.css';

import { IS_DOM, type DOMProps } from 'expo/dom';
import { useRef, useState } from 'react';

import type { PracticeTest as PracticeTestData } from '@/lib/types';

import { Icon } from './lib/Icon';
import { InlineMarkdown, Markdown } from './lib/Markdown';
import { BASE_CSS, TRANSCRIPT_CSS } from './lib/styles';

const LETTERS = 'ABCDEFGH';
const PAGE_CSS = `html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: transparent; } #root { height: 100%; }`;
const TEST_CSS = `
.mg.test { display: flex; flex-direction: column; }
.mg .test-top { padding: 12px 18px 8px; max-width: 760px; width: 100%; margin: 0 auto; }
.mg .bar { height: 6px; border-radius: 3px; background: var(--surface); overflow: hidden; }
.mg .bar > div { height: 100%; background: var(--primary); border-radius: 3px; transition: width .25s; }
.mg .dots { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
.mg .dot { width: 30px; height: 30px; border-radius: 9px; font-size: 13px; font-weight: 600; background: var(--surface); color: var(--text-2); }
.mg .dot.answered { background: var(--primary-soft); color: var(--primary-text); }
.mg .dot.current { outline: 2px solid var(--primary); outline-offset: 1px; }
.mg .dot.ok { background: var(--success-soft); color: var(--success); }
.mg .dot.bad { background: var(--danger-soft); color: var(--danger); }
.mg .test-body { flex: 1; overflow-y: auto; }
.mg .test-inner { max-width: 760px; margin: 0 auto; padding: 8px 18px 24px; }
.mg .q-label { font-size: 13px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: .04em; margin: 6px 0 8px; }
.mg .test-foot { display: flex; gap: 10px; padding: 12px 18px; border-top: 1px solid var(--border); max-width: 760px; width: 100%; margin: 0 auto; }
.mg .test-foot .btn { flex: 1; height: 46px; }
.mg .score { text-align: center; padding: 18px 0 8px; }
.mg .ring { width: 132px; height: 132px; margin: 0 auto 12px; position: relative; }
.mg .ring span { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; font-weight: 700; font-size: 30px; }
.mg .ring small { font-size: 13px; font-weight: 500; color: var(--text-2); }
.mg .review { border: 1px solid var(--border); border-radius: 14px; padding: 14px; margin-top: 12px; }
.mg .review-head { display: flex; gap: 8px; align-items: center; font-weight: 600; margin-bottom: 8px; }
.mg .review-head .ok { color: var(--success); } .mg .review-head .bad { color: var(--danger); }
.mg .answer-line { font-size: 14.5px; margin-top: 6px; }
`;

interface Props {
  test: PracticeTestData;
  scheme: 'light' | 'dark';
  onFinish: (correct: number, total: number) => Promise<void>;
  onAnswerPick: () => Promise<void>;
  dom?: DOMProps;
}

export default function PracticeTest({ test, scheme, onFinish, onAnswerPick }: Props) {
  const total = test.questions.length;
  const [answers, setAnswers] = useState<(number | null)[]>(() => test.questions.map(() => null));
  const [index, setIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [onlyMistakes, setOnlyMistakes] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const body = useRef<HTMLDivElement>(null);

  const q = test.questions[index];
  const answeredCount = answers.filter((a) => a !== null).length;
  const correct = answers.filter((a, i) => a === test.questions[i].answerIndex).length;

  const go = (i: number) => {
    setIndex(Math.max(0, Math.min(total - 1, i)));
    body.current?.scrollTo({ top: 0 });
  };

  const unanswered = total - answeredCount;
  const submit = (force = false) => {
    // window.confirm isn't reliable inside native WebViews, so confirm in-page.
    if (unanswered > 0 && !force) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setSubmitted(true);
    body.current?.scrollTo({ top: 0 });
    onFinish(correct, total).catch(() => {});
  };

  const retake = () => {
    setAnswers(test.questions.map(() => null));
    setSubmitted(false);
    setOnlyMistakes(false);
    go(0);
  };

  const pct = Math.round((correct / total) * 100);
  const message =
    pct >= 90
      ? 'Outstanding! 🎉'
      : pct >= 70
        ? 'Great work!'
        : pct >= 50
          ? 'Good effort, review the misses.'
          : 'Keep practicing — you’ve got this.';

  return (
    <div
      className="mg test"
      data-scheme={scheme}
      style={IS_DOM ? { position: 'fixed', inset: 0 } : { flex: 1, minHeight: 0, height: '100%' }}>
      <style>{(IS_DOM ? PAGE_CSS : '') + BASE_CSS + TRANSCRIPT_CSS + TEST_CSS}</style>

      <div className="test-top">
        <div className="bar">
          <div style={{ width: `${((submitted ? total : answeredCount) / total) * 100}%` }} />
        </div>
        <div className="dots">
          {test.questions.map((question, i) => {
            const state = submitted
              ? answers[i] === question.answerIndex
                ? 'ok'
                : 'bad'
              : answers[i] !== null
                ? 'answered'
                : '';
            return (
              <button
                key={i}
                className={`dot ${state} ${!submitted && i === index ? 'current' : ''}`}
                onClick={() => (submitted ? document.getElementById(`r${i}`)?.scrollIntoView({ behavior: 'smooth' }) : go(i))}>
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div className="test-body" ref={body}>
        <div className="test-inner">
          {!submitted ? (
            <div className="fade-in" key={index}>
              <div className="q-label">
                Question {index + 1} of {total}
              </div>
              <Markdown className="quiz-q" text={q.question} />
              <div className="choices" role="radiogroup">
                {q.choices.map((choice, i) => (
                  <button
                    key={i}
                    role="radio"
                    aria-checked={answers[index] === i}
                    className={`choice ${answers[index] === i ? 'selected' : ''}`}
                    onClick={() => {
                      setAnswers((a) => a.map((v, j) => (j === index ? i : v)));
                      onAnswerPick().catch(() => {});
                    }}>
                    <span className="letter">{LETTERS[i]}</span>
                    <InlineMarkdown text={choice} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="fade-in">
              <div className="score">
                <div className="ring">
                  <svg viewBox="0 0 120 120" width="132" height="132">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="var(--surface)" strokeWidth="10" />
                    <circle
                      cx="60"
                      cy="60"
                      r="52"
                      fill="none"
                      stroke={pct >= 70 ? 'var(--success)' : pct >= 50 ? '#F59E0B' : 'var(--danger)'}
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${(pct / 100) * 326.7} 326.7`}
                      transform="rotate(-90 60 60)"
                    />
                  </svg>
                  <span>
                    {correct}/{total}
                    <small>{pct}%</small>
                  </span>
                </div>
                <div style={{ fontWeight: 650, fontSize: 18 }}>{message}</div>
                <label
                  className="muted"
                  style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginTop: 12, fontSize: 14 }}>
                  <input type="checkbox" checked={onlyMistakes} onChange={(e) => setOnlyMistakes(e.target.checked)} /> Show only
                  mistakes
                </label>
              </div>
              {test.questions.map((question, i) => {
                const ok = answers[i] === question.answerIndex;
                if (onlyMistakes && ok) return null;
                return (
                  <div className="review" id={`r${i}`} key={i}>
                    <div className="review-head">
                      <span className={ok ? 'ok' : 'bad'}>
                        <Icon name={ok ? 'check' : 'x'} size={18} stroke={3} />
                      </span>
                      Question {i + 1}
                    </div>
                    <Markdown text={question.question} />
                    <div className="answer-line">
                      Your answer:{' '}
                      {answers[i] === null ? (
                        <em className="muted">skipped</em>
                      ) : (
                        <>
                          <strong>{LETTERS[answers[i]!]}.</strong> <InlineMarkdown text={question.choices[answers[i]!]} />
                        </>
                      )}
                    </div>
                    {!ok ? (
                      <div className="answer-line">
                        Correct: <strong>{LETTERS[question.answerIndex]}.</strong>{' '}
                        <InlineMarkdown text={question.choices[question.answerIndex]} />
                      </div>
                    ) : null}
                    <div className="solution">
                      <Markdown text={question.explanation} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {confirming && !submitted ? (
        <div className="test-foot" style={{ flexDirection: 'column', gap: 8 }}>
          <div style={{ fontWeight: 600 }}>
            {unanswered} question{unanswered > 1 ? 's are' : ' is'} unanswered. Submit anyway?
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn secondary" style={{ flex: 1 }} onClick={() => setConfirming(false)}>
              Keep working
            </button>
            <button className="btn" style={{ flex: 1 }} onClick={() => submit(true)}>
              Submit
            </button>
          </div>
        </div>
      ) : null}

      <div className="test-foot" style={confirming && !submitted ? { display: 'none' } : undefined}>
        {!submitted ? (
          <>
            <button className="btn secondary" disabled={index === 0} onClick={() => go(index - 1)}>
              <Icon name="chevronLeft" size={18} /> Back
            </button>
            {index < total - 1 ? (
              <button className="btn" onClick={() => go(index + 1)}>
                Next <Icon name="chevronRight" size={18} />
              </button>
            ) : (
              <button className="btn" onClick={() => submit()}>
                Submit test
              </button>
            )}
          </>
        ) : (
          <button className="btn" onClick={retake}>
            <Icon name="rotateCcw" size={17} /> Retake test
          </button>
        )}
      </div>
    </div>
  );
}
