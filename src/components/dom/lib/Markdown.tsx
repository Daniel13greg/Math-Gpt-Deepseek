import { memo, useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';

import { renderInline, renderMarkdown, renderMathText } from './markdown';

/** Blocks that scroll sideways when they're wider than the column. */
const SCROLLERS = '.math-display, .table-wrap';
/** A display equation up to this much too wide is shrunk to fit instead of scrolling. */
const MIN_SCALE = 0.85;

/** Fades whichever side of a sideways-scrolling block still hides content. */
function markOverflow(el: HTMLElement) {
  const max = el.scrollWidth - el.clientWidth;
  el.classList.toggle('more-right', max > 1 && el.scrollLeft < max - 1);
  el.classList.toggle('more-left', max > 1 && el.scrollLeft > 1);
}

function fit(el: HTMLElement) {
  if (el.classList.contains('math-display')) {
    el.style.fontSize = '';
    const scale = el.clientWidth / el.scrollWidth;
    // KaTeX sizes everything in em, so a smaller font size scales the whole equation.
    if (scale < 1 && scale >= MIN_SCALE) el.style.fontSize = `${Math.floor(scale * 100) - 1}%`;
  }
  markOverflow(el);
}

/** Keeps wide equations and tables readable: shrink a little, else scroll with an edge fade. */
function useFittedBlocks(ref: RefObject<HTMLDivElement | null>, html: string) {
  useLayoutEffect(() => {
    ref.current?.querySelectorAll<HTMLElement>(SCROLLERS).forEach(fit);
  }, [ref, html]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const refit = () => root.querySelectorAll<HTMLElement>(SCROLLERS).forEach(fit);
    // Scroll events don't bubble, so listen in the capture phase.
    const onScroll = (e: Event) => {
      if (e.target instanceof HTMLElement && e.target.matches(SCROLLERS)) markOverflow(e.target);
    };
    root.addEventListener('scroll', onScroll, true);
    let width = -1;
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(([entry]) => {
            const next = Math.round(entry.contentRect.width);
            if (next !== width) {
              width = next;
              refit();
            }
          });
    observer?.observe(root);
    // Equations are measured again once the math fonts have loaded.
    document.fonts?.ready.then(refit).catch(() => {});
    return () => {
      root.removeEventListener('scroll', onScroll, true);
      observer?.disconnect();
    };
  }, [ref]);
}

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
  const ref = useRef<HTMLDivElement>(null);
  const html = useMemo(() => renderMarkdown(text, { streaming, partial }), [text, streaming, partial]);
  useFittedBlocks(ref, html);
  return <div ref={ref} className={`md ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
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
