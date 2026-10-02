import { buildPrintHtml } from '@/components/dom/lib/print';

import { flashcardsMarkdown, pdfFileName, practiceTestSections } from '../printable';

const test = {
  title: 'Derivatives',
  topic: 'Derivatives',
  questions: [
    { question: 'What is \\(\\frac{d}{dx} x^2\\)?', choices: ['\\(2x\\)', '\\(x\\)'], answerIndex: 0, explanation: 'Power rule.' },
  ],
};

describe('printable', () => {
  it('puts the questions first and the answer key on its own page', () => {
    const [questions, key] = practiceTestSections(test);
    expect(questions).toContain('**1.** What is');
    expect(questions).toContain('A) \\(2x\\)');
    expect(questions).not.toContain('Power rule');
    expect(key).toContain('### Answer key');
    expect(key).toContain('**1. A)** \\(2x\\)');
    expect(key).toContain('Power rule.');
  });

  it('lays flashcards out as a table, escaping pipes', () => {
    expect(flashcardsMarkdown({ title: 'T', cards: [{ front: '|x|', back: 'abs\nvalue' }] })).toBe(
      '| Front | Back |\n|---|---|\n| \\|x\\| | abs value |',
    );
  });

  it('makes safe file names', () => {
    expect(pdfFileName('Derivatives & the "Power" Rule: part 1/2')).toBe('Derivatives the Power Rule part 1 2.pdf');
    expect(pdfFileName('???')).toBe('Document.pdf');
  });
});

describe('buildPrintHtml', () => {
  it('prints math as MathML, escapes the title and breaks pages between sections', () => {
    const html = buildPrintHtml('A <b>title</b>', ['First \\(x^2\\)', 'Second'], 'Oct 1');
    expect(html).toContain('<title>A &lt;b&gt;title&lt;/b&gt;</title>');
    expect(html).toContain('<math');
    expect(html).toContain('.katex-html');
    expect(html).toContain('<section class="page-break">');
    expect(html).toContain('Oct 1');
  });
});
