import { renderMarkdown, splitDanglingMath } from '../markdown';

const mathCount = (html: string) => (html.match(/class="katex"/g) ?? []).length;
const displayCount = (html: string) => (html.match(/class="math-display"/g) ?? []).length;

describe('renderMarkdown math', () => {
  it('renders all four delimiter styles', () => {
    const html = renderMarkdown('Inline \\(x^2\\) and $y_1$.\n\n\\[ \\int_0^1 x\\,dx \\]\n\n$$\\frac{a}{b}$$');
    expect(mathCount(html)).toBe(4);
    expect(displayCount(html)).toBe(2);
  });

  it('keeps dollar amounts as text (pandoc rules)', () => {
    const html = renderMarkdown('It costs $5 and $10, or $5-$10 in total. Revenue was $1,200.');
    expect(mathCount(html)).toBe(0);
    expect(html).toContain('$5 and $10');
  });

  it('does not let markdown emphasis break math', () => {
    const html = renderMarkdown('Here $a_1 * b_2 * c_3$ is math');
    expect(mathCount(html)).toBe(1);
    expect(html).not.toContain('<em>');
  });

  it('handles multi-line display math whose lines look like markdown', () => {
    const html = renderMarkdown('Steps:\n\n\\[\n\\begin{aligned}\n- x + 2 &= 0 \\\\\n# x &= 2\n\\end{aligned}\n\\]\n\nDone.');
    expect(displayCount(html)).toBe(1);
    expect(html).not.toContain('<li>');
    expect(html).not.toContain('<h1>');
    expect(html).toContain('<p>Done.</p>');
  });

  it('renders bare align environments and mhchem', () => {
    const html = renderMarkdown('\\begin{align*}\na &= b\n\\end{align*}\n\nWater: \\(\\ce{2H2 + O2 -> 2H2O}\\)');
    expect(displayCount(html)).toBe(1);
    expect(mathCount(html)).toBe(2);
  });

  it('shows invalid TeX without throwing', () => {
    expect(() => renderMarkdown('\\(\\frac{1}{\\)')).not.toThrow();
  });
});

describe('renderMarkdown safety and formatting', () => {
  it('escapes raw HTML from the model', () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)"> <script>alert(2)</script>');
    expect(html).not.toMatch(/<img|<script/);
    expect(html).toContain('&lt;script&gt;');
  });

  it('marks external links and drops javascript: links', () => {
    expect(renderMarkdown('[site](https://example.com)')).toContain('data-external-link="1"');
    const js = renderMarkdown('[bad](javascript:alert(1))');
    expect(js).not.toContain('href');
    expect(js).toContain('bad');
  });

  it('wraps tables and code blocks', () => {
    const html = renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |\n\n```python\nprint("<hi>")\n```');
    expect(html).toContain('<div class="table-wrap"><table>');
    expect(html).toContain('data-copy-code');
    expect(html).toContain('print(&quot;&lt;hi&gt;&quot;)');
  });
});

describe('splitDanglingMath', () => {
  it('cuts an unclosed trailing equation while streaming', () => {
    expect(splitDanglingMath('Answer: \\[ x = \\frac{1')).toEqual({ text: 'Answer: ', pending: true });
    expect(splitDanglingMath('Use $$a$$ then $$b')).toEqual({ text: 'Use $$a$$ then ', pending: true });
  });

  it('hides a lone trailing backslash from a split delimiter', () => {
    expect(splitDanglingMath('Here \\')).toEqual({ text: 'Here ', pending: false });
    expect(splitDanglingMath('a \\\\')).toEqual({ text: 'a \\\\', pending: false });
  });

  it('leaves complete math alone', () => {
    expect(splitDanglingMath('Done $$a$$ and \\(b\\) and \\[c\\].')).toEqual({
      text: 'Done $$a$$ and \\(b\\) and \\[c\\].',
      pending: false,
    });
  });

  it('adds a placeholder only in streaming mode', () => {
    expect(renderMarkdown('x \\[ y', { streaming: true })).toContain('math-pending');
    expect(renderMarkdown('x \\[ y')).not.toContain('math-pending');
  });

  it('trims a cut-off equation from stopped replies without a placeholder', () => {
    const html = renderMarkdown('Factor it. \\[ x^2 - 5x', { partial: true });
    expect(html).not.toContain('x^2');
    expect(html).not.toContain('math-pending');
    expect(html).toContain('Factor it.');
  });
});
