'use dom';

import './katex-inline.css';

import { IS_DOM, type DOMProps } from 'expo/dom';
import { useEffect, useRef, type MouseEvent } from 'react';

import { Markdown } from './lib/Markdown';
import { BASE_CSS } from './lib/styles';

const PAGE_CSS = `html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: transparent; } #root { height: 100%; }`;
const DOC_CSS = `
.mg.doc { overflow-y: auto; overflow-x: hidden; }
.mg .doc-body { max-width: 760px; margin: 0 auto; padding: 18px 20px 48px; }
.mg .doc-body .md h1 { font-size: 1.6em; margin-top: 4px; }
.mg .doc-body .md h3 { margin-top: 26px; padding-top: 12px; border-top: 1px solid var(--border); }
.mg .placeholder { color: var(--text-3); padding: 40px 0; text-align: center; }
`;

interface RichDocumentProps {
  markdown: string;
  scheme: 'light' | 'dark';
  streaming?: boolean;
  placeholder?: string;
  onLink: (url: string) => Promise<void>;
  onCopyCode: (text: string) => Promise<void>;
  dom?: DOMProps;
}

/** Full-screen Markdown + LaTeX document (lecture notes, study guides). */
export default function RichDocument({
  markdown,
  scheme,
  streaming = false,
  placeholder,
  onLink,
  onCopyCode,
}: RichDocumentProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  // Follow the text while it streams in, unless the reader scrolled up.
  useEffect(() => {
    const el = scroller.current;
    if (el && streaming && pinned.current) el.scrollTop = el.scrollHeight;
  }, [markdown, streaming]);

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a[data-external-link]');
    if (link) {
      e.preventDefault();
      onLink(link.getAttribute('href') ?? '').catch(() => {});
      return;
    }
    const copy = target.closest('button[data-copy-code]');
    if (copy) onCopyCode(copy.closest('.code-block')?.querySelector('code')?.textContent ?? '').catch(() => {});
  };

  return (
    <div
      ref={scroller}
      className="mg doc"
      data-scheme={scheme}
      onClick={onClick}
      onScroll={() => {
        const el = scroller.current;
        if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      }}
      style={IS_DOM ? { position: 'fixed', inset: 0 } : { flex: 1, minHeight: 0, height: '100%' }}>
      <style>{(IS_DOM ? PAGE_CSS : '') + BASE_CSS + DOC_CSS}</style>
      <div className="doc-body">
        {markdown ? <Markdown text={markdown} streaming={streaming} /> : <div className="placeholder">{placeholder}</div>}
        {streaming ? <div className="shimmer" style={{ marginTop: 16 }} /> : null}
      </div>
    </div>
  );
}
