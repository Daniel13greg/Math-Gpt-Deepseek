'use dom';

import './katex-inline.css';

import { IS_DOM, type DOMProps } from 'expo/dom';
import { MathfieldElement } from 'mathlive';
import { useEffect, useRef } from 'react';

import { translator, type LanguageCode } from '@/i18n/strings';

import { BASE_CSS } from './lib/styles';

// KaTeX's fonts are already inlined by katex-inline.css (MathLive uses the same families), so
// nothing is fetched and the editor works offline. No keypress sounds.
MathfieldElement.fontsDirectory = null;
MathfieldElement.soundsDirectory = null;

const PAGE_CSS = `html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: transparent; } #root { height: 100%; }`;
const EDITOR_CSS = `
.mg.math-editor { display: flex; flex-direction: column; }
.mg .math-editor-field { padding: 18px 16px 8px; max-width: 760px; width: 100%; margin: 0 auto; }
.mg math-field {
  display: block; width: 100%; font-size: 26px; padding: 14px 12px; border-radius: 14px;
  border: 1.5px solid var(--primary); background: var(--bg); color: var(--text);
  --caret-color: var(--primary); --selection-background-color: var(--primary-soft); --contains-highlight-background-color: transparent;
}
.mg math-field:focus, .mg math-field:focus-within { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
.mg math-field::part(virtual-keyboard-toggle), .mg math-field::part(menu-toggle) { display: none; }
.mg .math-editor-hint { color: var(--text-3); font-size: 13.5px; margin: 10px 4px 0; line-height: 1.45; }
`;

interface Props {
  /** LaTeX to start from. */
  initialLatex?: string;
  scheme: 'light' | 'dark';
  lang: LanguageCode;
  /** Called with the LaTeX after every edit. */
  onChange: (latex: string) => Promise<void>;
  dom?: DOMProps;
}

/** Structured math input (fractions, powers, roots…) with MathLive's on-screen math keyboard. */
export default function MathEditor({ initialLatex = '', scheme, lang, onChange }: Props) {
  const { t } = translator(lang);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const field = new MathfieldElement();
    field.value = initialLatex;
    field.smartFence = true;
    field.mathVirtualKeyboardPolicy = 'manual';
    field.setAttribute('aria-label', t('math.input'));
    const keyboard = window.mathVirtualKeyboard;
    keyboard.layouts = ['numeric', 'symbols', 'alphabetic', 'greek'];
    const show = () => keyboard.show({ animate: true });
    field.addEventListener('focusin', show);
    field.addEventListener('input', () => onChange(field.getValue('latex')).catch(() => {}));
    host.current?.appendChild(field);
    field.focus();
    show();
    // The screen's opening transition can take focus back (seen on web), so try again once it settles.
    const refocus = setTimeout(() => {
      if (!field.hasFocus()) field.focus();
    }, 400);
    return () => {
      clearTimeout(refocus);
      keyboard.hide();
      field.remove();
    };
    // The field is created once; later prop changes are ignored on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.style.colorScheme = scheme;
    document.body.classList.toggle('dark', scheme === 'dark');
  }, [scheme]);

  return (
    <div
      className="mg math-editor"
      data-scheme={scheme}
      style={IS_DOM ? { position: 'fixed', inset: 0 } : { flex: 1, minHeight: 0, height: '100%' }}>
      <style>{(IS_DOM ? PAGE_CSS : '') + BASE_CSS + EDITOR_CSS}</style>
      <div className="math-editor-field">
        <div ref={host} />
        <div className="math-editor-hint">
          {t('math.hint')}
        </div>
      </div>
    </div>
  );
}
