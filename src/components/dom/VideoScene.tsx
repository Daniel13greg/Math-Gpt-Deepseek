'use dom';

import './katex-inline.css';

import { IS_DOM, type DOMProps } from 'expo/dom';

import { Markdown } from './lib/Markdown';
import { BASE_CSS } from './lib/styles';

const PAGE_CSS = `html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: transparent; } #root { height: 100%; }`;
const SCENE_CSS = `
.mg.scene {
  --text: #f4f7fb; --text-2: #b9c6d6; --border: rgba(255,255,255,.18); --surface: rgba(255,255,255,.08);
  --primary-soft: rgba(52,144,221,.18); --primary-text: #8cc6f5; --code-bg: rgba(255,255,255,.06);
  background: radial-gradient(120% 90% at 10% 0%, #1f4d7a 0%, #0f2236 55%, #0b1520 100%);
  color: var(--text); display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.mg .slide { width: 100%; max-width: 680px; padding: 28px 26px; }
.mg .slide-index { font-size: 13px; letter-spacing: .12em; text-transform: uppercase; color: #8cc6f5; font-weight: 700; animation: mg-rise .5s ease-out both; }
.mg .slide h1 { font-size: 30px; line-height: 1.2; margin: 10px 0 18px; animation: mg-rise .55s .08s ease-out both; }
.mg .slide .md { font-size: 19px; line-height: 1.55; }
.mg .slide .md > * { animation: mg-rise .6s ease-out both; }
.mg .slide .md > *:nth-child(1) { animation-delay: .3s; }
.mg .slide .md > *:nth-child(2) { animation-delay: .9s; }
.mg .slide .md > *:nth-child(3) { animation-delay: 1.5s; }
.mg .slide .md > *:nth-child(n+4) { animation-delay: 2.1s; }
.mg .slide .md li { margin: 8px 0; }
.mg .slide .katex { font-size: 1.15em; }
.mg .slide .math-display { margin: 14px 0; }
.mg .paused .slide * { animation-play-state: paused !important; }
@keyframes mg-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
`;

interface Props {
  heading: string;
  body: string;
  index: number;
  total: number;
  playing: boolean;
  dom?: DOMProps;
}

/** One animated slide of a video lesson; re-keyed per scene so the entrance animation replays. */
export default function VideoScene({ heading, body, index, total, playing }: Props) {
  return (
    <div
      className={`mg scene${playing ? '' : ' paused'}`}
      data-scheme="dark"
      style={IS_DOM ? { position: 'fixed', inset: 0 } : { flex: 1, minHeight: 0, height: '100%' }}>
      <style>{(IS_DOM ? PAGE_CSS : '') + BASE_CSS + SCENE_CSS}</style>
      <div className="slide" key={index}>
        <div className="slide-index">
          Scene {index + 1} / {total}
        </div>
        <h1>{heading}</h1>
        <Markdown text={body} />
      </div>
    </div>
  );
}
