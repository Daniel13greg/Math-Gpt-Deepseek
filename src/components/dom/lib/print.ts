import { escapeHtml, renderMarkdown } from './markdown';

/**
 * Print styles. Math is printed from KaTeX's MathML output, which the system WebViews used by
 * expo-print typeset natively, so no fonts or KaTeX CSS need embedding.
 */
const PRINT_CSS = `
@page { margin: 18mm 16mm; }
* { box-sizing: border-box; }
body { font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 11.5pt; line-height: 1.55; color: #111; margin: 0; }
.doc-title { font-size: 20pt; margin: 0 0 4pt; line-height: 1.25; }
.doc-meta { color: #666; font-size: 9.5pt; margin: 0 0 16pt; padding-bottom: 8pt; border-bottom: 1px solid #ddd; }
h1 { font-size: 17pt; } h2 { font-size: 14.5pt; } h3 { font-size: 12.5pt; margin-top: 16pt; }
h1, h2, h3, h4 { line-height: 1.3; break-after: avoid; }
p, li { orphans: 3; widows: 3; }
table { border-collapse: collapse; margin: 8pt 0; break-inside: avoid; }
th, td { border: 1px solid #ccc; padding: 4pt 8pt; text-align: left; }
th { background: #f3f4f6; }
pre { background: #f6f7f9; padding: 8pt; border-radius: 4pt; white-space: pre-wrap; font-size: 9.5pt; }
code { font-family: Menlo, Consolas, monospace; font-size: 0.92em; }
blockquote { margin: 8pt 0; padding-left: 10pt; border-left: 3px solid #ccc; color: #444; }
img { max-width: 100%; }
.katex-html, .code-copy, button { display: none !important; }
.katex-display { margin: 10pt 0; text-align: center; overflow: visible; }
math { font-size: 1.12em; font-family: "STIX Two Math", "Cambria Math", "Latin Modern Math", math; }
math[display="block"] { margin: 6pt auto; }
.page-break { break-before: page; }
`;

/** Each section starts on a new page (e.g. a worksheet, then its answer key). */
export function buildPrintHtml(title: string, sections: string[], meta?: string): string {
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${PRINT_CSS}</style></head><body>`,
    `<h1 class="doc-title">${escapeHtml(title)}</h1>`,
    meta ? `<div class="doc-meta">${escapeHtml(meta)}</div>` : '',
    sections.map((md, i) => `<section${i > 0 ? ' class="page-break"' : ''}>${renderMarkdown(md)}</section>`).join(''),
    '</body></html>',
  ].join('');
}
