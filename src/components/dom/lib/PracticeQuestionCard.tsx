import { useState } from 'react';

import type { PracticeQuestion } from '@/lib/types';

import { Icon } from './Icon';
import { InlineMarkdown, Markdown } from './Markdown';

/** Shown when an independent re-solve disagreed with the answer key. */
export function UnverifiedNote() {
  return (
    <div className="unverified" role="note">
      <Icon name="circleAlert" size={16} />
      <span>A second check got a different answer for this one. Work it out yourself before trusting the key.</span>
    </div>
  );
}

const LETTERS = 'ABCDEFGH';

interface Props {
  question: PracticeQuestion;
  onAnswered?: (correct: boolean) => void;
  onAnother?: () => void;
}

/** Interactive multiple-choice question: pick, check, hint, worked solution. */
export function PracticeQuestionCard({ question, onAnswered, onAnother }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const correct = selected === question.answerIndex;

  const check = () => {
    if (selected === null) return;
    setChecked(true);
    onAnswered?.(selected === question.answerIndex);
  };

  return (
    <div className="card artifact-card fade-in">
      <div className="artifact-head">
        <span className="tag">
          <Icon name="circleQuestionMark" size={14} /> Practice question
        </span>
        <span className="muted" style={{ fontSize: 13 }}>
          {question.difficulty[0].toUpperCase() + question.difficulty.slice(1)} · {question.topic}
        </span>
      </div>
      <div className="artifact-body">
        <Markdown className="quiz-q" text={question.question} />
        <div className="choices" role="radiogroup">
          {question.choices.map((choice, i) => {
            let state = '';
            if (checked && i === question.answerIndex) state = 'correct';
            else if (checked && i === selected) state = 'wrong';
            else if (!checked && i === selected) state = 'selected';
            return (
              <button
                key={i}
                className={`choice ${state}`}
                role="radio"
                aria-checked={i === selected}
                disabled={checked}
                onClick={() => setSelected(i)}>
                <span className="letter">
                  {state === 'correct' ? (
                    <Icon name="check" size={15} stroke={3} />
                  ) : state === 'wrong' ? (
                    <Icon name="x" size={15} stroke={3} />
                  ) : (
                    LETTERS[i]
                  )}
                </span>
                <InlineMarkdown text={choice} />
              </button>
            );
          })}
        </div>

        {checked && question.unverified ? <UnverifiedNote /> : null}

        {checked ? (
          <div className={`feedback ${correct ? 'ok' : 'bad'}`}>
            <Icon name={correct ? 'check' : 'x'} size={18} stroke={3} />
            {correct ? 'Correct! Nice work.' : `Not quite — the answer is ${LETTERS[question.answerIndex]}.`}
          </div>
        ) : null}

        {showHint && question.hint && !checked ? (
          <div className="hint">
            <strong>Hint: </strong>
            <InlineMarkdown text={question.hint} />
          </div>
        ) : null}

        {showSolution ? (
          <div className="solution fade-in">
            <Markdown text={question.explanation} />
          </div>
        ) : null}

        <div className="artifact-foot">
          {!checked ? (
            <>
              <button className="btn" disabled={selected === null} onClick={check}>
                Check answer
              </button>
              {question.hint && !showHint ? (
                <button className="btn ghost" onClick={() => setShowHint(true)}>
                  <Icon name="lightbulb" size={16} /> Hint
                </button>
              ) : null}
            </>
          ) : (
            <>
              {!showSolution ? (
                <button className="btn" onClick={() => setShowSolution(true)}>
                  Show solution
                </button>
              ) : null}
              {onAnother ? (
                <button className="btn secondary" onClick={onAnother}>
                  <Icon name="refreshCw" size={15} /> Another question
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
