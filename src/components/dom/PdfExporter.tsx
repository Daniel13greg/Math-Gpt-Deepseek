'use dom';

import type { DOMProps } from 'expo/dom';
import { useEffect, useRef } from 'react';

import { buildPrintHtml } from './lib/print';

interface Props {
  title: string;
  /** Markdown + LaTeX; each section starts on a new page. */
  sections: string[];
  meta?: string;
  /** Receives the finished, self-contained HTML document. */
  onHtml: (html: string) => Promise<void>;
  dom?: DOMProps;
}

/** Invisible: renders Markdown + LaTeX to a printable HTML document and hands it back to native code. */
export default function PdfExporter({ title, sections, meta, onHtml }: Props) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    onHtml(buildPrintHtml(title, sections, meta)).catch(() => {});
  }, [title, sections, meta, onHtml]);
  return <div aria-hidden />;
}
