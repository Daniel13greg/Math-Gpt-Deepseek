/** Appends math typed in the math keyboard to the composer as inline LaTeX, which the chat renders and DeepSeek reads. */
export function insertMath(draft: string, latex: string): string {
  const tex = latex.trim();
  if (!tex) return draft;
  const before = draft.replace(/\s+$/, '');
  return `${before}${before ? ' ' : ''}\\(${tex}\\) `;
}
