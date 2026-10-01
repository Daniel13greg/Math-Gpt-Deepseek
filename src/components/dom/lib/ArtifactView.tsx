import { missedCount } from '@/lib/tools/adaptive';
import type { Artifact } from '@/lib/types';

import { DiagramView } from './DiagramView';
import { GraphPlot } from './GraphPlot';
import { Icon, type IconName } from './Icon';
import { InlineMarkdown, Markdown } from './Markdown';
import { PracticeQuestionCard } from './PracticeQuestionCard';

interface Props {
  artifact: Artifact;
  onOpen: () => void;
  onAnswered: (choice: number, correct: boolean) => void;
  onAnother: () => void;
  onPracticeMistakes: () => void;
}

function Head({ icon, title, sub }: { icon: IconName; title: string; sub: string }) {
  return (
    <div className="artifact-head">
      <div className="progress-icon">
        <Icon name={icon} size={22} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="artifact-title">{title}</div>
        <div className="artifact-sub">{sub}</div>
      </div>
    </div>
  );
}

/** Inline rendering of a tool result inside the chat transcript. */
export function ArtifactView({ artifact, onOpen, onAnswered, onAnother, onPracticeMistakes }: Props) {
  switch (artifact.kind) {
    case 'practice-question':
      return (
        <PracticeQuestionCard
          question={artifact.data}
          lastAnswer={artifact.lastAnswer}
          onAnswered={onAnswered}
          onAnother={onAnother}
        />
      );

    case 'practice-test': {
      const n = artifact.data.questions.length;
      const score = artifact.lastScore;
      return (
        <div className="card artifact-card fade-in">
          <Head icon="bookCheck" title={artifact.data.title} sub={`${n} questions · about ${Math.max(5, n * 2)} min`} />
          {score ? (
            <div className="preview-card">
              <div className="label">Last attempt</div>
              <strong>
                {score.correct}/{score.total}
              </strong>{' '}
              correct ({Math.round((score.correct / score.total) * 100)}%)
            </div>
          ) : null}
          <div className="artifact-foot">
            <button className="btn" onClick={onOpen}>
              {score ? 'Retake test' : 'Start test'} <Icon name="arrowRight" size={16} />
            </button>
            {missedCount(artifact.data, score?.answers) > 0 ? (
              <button className="btn secondary" onClick={onPracticeMistakes}>
                <Icon name="refreshCw" size={15} /> Practice my mistakes
              </button>
            ) : null}
          </div>
        </div>
      );
    }

    case 'flashcards': {
      const first = artifact.data.cards[0];
      return (
        <div className="card artifact-card fade-in">
          <Head icon="flashcards" title={artifact.data.title} sub={`${artifact.data.cards.length} flashcards`} />
          <div className="preview-card">
            <div className="label">First card</div>
            <InlineMarkdown text={first.front} />
          </div>
          <div className="artifact-foot">
            <button className="btn" onClick={onOpen}>
              Study cards <Icon name="arrowRight" size={16} />
            </button>
          </div>
        </div>
      );
    }

    case 'video': {
      const scenes = artifact.data.scenes.length;
      const words = artifact.data.scenes.reduce((n, s) => n + s.narration.split(/\s+/).length, 0);
      const minutes = Math.max(1, Math.round(words / 150));
      return (
        <div className="card artifact-card fade-in">
          <button className="video-thumb" style={{ width: '100%' }} onClick={onOpen} aria-label={`Play ${artifact.data.title}`}>
            <h3>{artifact.data.title}</h3>
            <span className="play">
              <Icon name="play" size={24} stroke={2.5} />
            </span>
          </button>
          <div className="artifact-sub" style={{ marginTop: 10 }}>
            Video lesson · {scenes} scenes · ~{minutes} min with narration
          </div>
        </div>
      );
    }

    case 'graph':
      return (
        <div className="card artifact-card fade-in">
          <div className="artifact-title" style={{ marginBottom: 10 }}>
            {artifact.data.title}
          </div>
          <GraphPlot spec={artifact.data} />
          {artifact.data.explanation ? <Markdown className="caption" text={artifact.data.explanation} /> : null}
        </div>
      );

    case 'diagram':
      return (
        <div className="card artifact-card fade-in">
          <div className="artifact-title" style={{ marginBottom: 10 }}>
            {artifact.data.title}
          </div>
          <DiagramView spec={artifact.data} />
        </div>
      );
  }
}
