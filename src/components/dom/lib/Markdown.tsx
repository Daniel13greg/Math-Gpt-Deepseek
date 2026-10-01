import { memo, useMemo } from 'react';

import { renderInline, renderMarkdown, renderMathText } from './markdown';

/** Renders model Markdown + LaTeX. HTML is built by our renderer, which escapes raw HTML. */
export const Markdown = memo(function Markdown({
  text,
  streaming = false,
  partial = false,
  className = '',
}: {
  text: string;
  streaming?: boolean;
  /** The text was cut off mid-reply (stopped). */
  partial?: boolean;
  className?: string;
}) {
  const html = useMemo(() => renderMarkdown(text, { streaming, partial }), [text, streaming, partial]);
  return <div className={`md ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
});

/** Inline variant (no wrapping <p>) for short strings like choices and card faces. */
export const InlineMarkdown = memo(function InlineMarkdown({ text, className = '' }: { text: string; className?: string }) {
  const html = useMemo(() => (text.includes('\n') ? renderMarkdown(text) : renderInline(text)), [text]);
  return <span className={`md ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
});

/** Plain text that isn't Markdown (a student's message) with any math in it typeset: "6/4" shows as a stacked fraction. */
export const MathText = memo(function MathText({ text, className = '' }: { text: string; className?: string }) {
  const html = useMemo(() => renderMathText(text), [text]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
});
