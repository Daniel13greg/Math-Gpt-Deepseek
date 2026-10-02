import type { ClientConfig } from '@/lib/ai/client';
import type { MultipleChoiceQuestion } from '@/lib/types';

import { generateArtifact } from '../generate';
import { normalizeGraph, onSomeCurve } from '../normalize';
import { applyKeyChecks, checkUserPrompt, compareKeys } from '../verify';
import { compileExpr } from '@/lib/mathExpr';

const q = (answerIndex: number, question = 'What is 2 + 2?'): MultipleChoiceQuestion => ({
  question,
  choices: ['3', '4', '5', '6'],
  answerIndex,
  explanation: '2 + 2 = 4',
});

describe('compareKeys', () => {
  it('matches letters to answer indexes and treats "none" as a disagreement', () => {
    const questions = [q(1), q(2), q(1), q(1)];
    const checks = compareKeys(questions, {
      answers: [
        { q: 1, answer: 'B' },
        { q: 2, answer: '(b)' },
        { q: 3, answer: 'none' },
        { q: 4, answer: 'the second one' },
      ],
    });
    expect(checks).toEqual([true, false, false, null]);
  });

  it('returns unknown for unreadable replies', () => {
    expect(compareKeys([q(0)], { nope: true })).toEqual([null]);
    expect(compareKeys([q(0)], null)).toEqual([null]);
  });

  it('hides the key from the checker', () => {
    const prompt = checkUserPrompt([{ ...q(1), hint: 'add', explanation: 'SECRET' }]);
    expect(prompt).toContain('B) 4');
    expect(prompt).not.toContain('SECRET');
  });
});

describe('applyKeyChecks', () => {
  it('drops disagreeing questions while enough remain', () => {
    const questions = [q(0, 'a'), q(0, 'b'), q(0, 'c'), q(0, 'd'), q(0, 'e')];
    const kept = applyKeyChecks(questions, [true, false, null, true, true], 4);
    expect(kept.map((x) => x.question)).toEqual(['a', 'c', 'd', 'e']);
  });

  it('keeps and flags disagreeing questions when too few would remain', () => {
    const kept = applyKeyChecks([q(0, 'a'), q(0, 'b')], [false, true], 4);
    expect(kept).toEqual([{ ...q(0, 'a'), unverified: true }, q(0, 'b')]);
  });
});

/** Fake DeepSeek: tool prompts get `tool` replies in turn, checker prompts get `checks` replies in turn. */
function fakeApi(tool: unknown[], checks: unknown[]) {
  const calls: { system: string; user: string }[] = [];
  const fetchImpl = jest.fn(async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body);
    const system = body.messages[0].content as string;
    calls.push({ system, user: body.messages[1].content });
    const reply = system.includes('examiner') ? checks.shift() : tool.shift();
    const text = JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) }, finish_reason: 'stop' }] });
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => text,
    } as unknown as Response;
  });
  const config: ClientConfig = { apiKey: 'sk', fetch: fetchImpl as unknown as typeof fetch, retryDelaysMs: [] };
  return { config, calls };
}

const rawQuestion = (answerIndex: number) => ({
  topic: 'Arithmetic',
  difficulty: 'easy',
  question: 'What is 2 + 2?',
  choices: ['3', '4', '5', '6'],
  answerIndex,
  explanation: '2 + 2 = 4',
});

const base = { model: 'deepseek-flash', subject: 'math' as const, topic: 'arithmetic', thinking: false };

describe('generateArtifact answer checks', () => {
  it('returns a practice question whose key is confirmed', async () => {
    const { config, calls } = fakeApi([rawQuestion(1)], [{ answers: [{ q: 1, answer: 'B' }] }]);
    const artifact = await generateArtifact({ ...base, config, kind: 'practice-question' });
    expect(artifact.kind === 'practice-question' && artifact.data.unverified).toBeFalsy();
    expect(calls).toHaveLength(2);
  });

  it('rewrites a practice question once when the check disagrees, then flags it if needed', async () => {
    const { config, calls } = fakeApi(
      [rawQuestion(0), rawQuestion(2)],
      [{ answers: [{ q: 1, answer: 'B' }] }, { answers: [{ q: 1, answer: 'B' }] }],
    );
    const artifact = await generateArtifact({ ...base, config, kind: 'practice-question' });
    expect(calls).toHaveLength(4);
    expect(artifact.kind === 'practice-question' && artifact.data.answerIndex).toBe(2);
    expect(artifact.kind === 'practice-question' && artifact.data.unverified).toBe(true);
  });

  it('drops test questions with a disputed key', async () => {
    const test = {
      title: 'T',
      topic: 'Arithmetic',
      questions: [1, 1, 1, 0, 1].map((answerIndex, i) => ({ ...rawQuestion(answerIndex), question: `Q${i}` })),
    };
    const { config } = fakeApi([test], [{ answers: [1, 2, 3, 4, 5].map((n) => ({ q: n, answer: 'B' })) }]);
    const artifact = await generateArtifact({ ...base, config, kind: 'practice-test' });
    expect(artifact.kind === 'practice-test' && artifact.data.questions.map((x) => x.question)).toEqual([
      'Q0',
      'Q1',
      'Q2',
      'Q4',
    ]);
  });

  it('keeps the artifact when the checker fails', async () => {
    const { config } = fakeApi([rawQuestion(1)], ['not json at all']);
    const artifact = await generateArtifact({ ...base, config, kind: 'practice-question' });
    expect(artifact.kind).toBe('practice-question');
  });

  it('includes source material in the request', async () => {
    const { config, calls } = fakeApi([rawQuestion(1)], [{ answers: [{ q: 1, answer: 'B' }] }]);
    await generateArtifact({ ...base, config, kind: 'practice-question', context: 'Lecture notes:\nAddition facts' });
    expect(calls[0].user).toBe('Topic: arithmetic\n\nLecture notes:\nAddition facts');
  });
});

describe('graph point checks', () => {
  it('accepts rounded coordinates and holes, rejects points off every curve', () => {
    const sqrt = compileExpr('sqrt(x)');
    expect(onSomeCurve([sqrt], 3, 1.73, 10)).toBe(true);
    expect(onSomeCurve([sqrt], 3, 2, 10)).toBe(false);
    const hole = compileExpr('(x^2 - 1)/(x - 1)');
    expect(onSomeCurve([hole], 1, 2, 10)).toBe(true);
  });

  it('drops wrong key points from a graph', () => {
    const graph = normalizeGraph(
      {
        functions: [{ expr: 'x^2 - 4' }, { expr: 'x + 2' }],
        xMin: -6,
        xMax: 6,
        yMin: -6,
        yMax: 10,
        points: [
          { x: -2, y: 0, label: 'intersection' },
          { x: 3, y: 5, label: 'intersection' },
          { x: 0, y: -4, label: 'vertex' },
          { x: 1, y: 2, label: 'wrong vertex' },
        ],
      },
      'parabola',
    );
    expect(graph.points.map((p) => p.label)).toEqual(['intersection', 'intersection', 'vertex']);
  });
});
