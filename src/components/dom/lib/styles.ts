/**
 * Styles for every DOM component. Everything is scoped under `.mg` because on web
 * DOM components render inline in the app's own document.
 */
export const BASE_CSS = `
.mg {
  --bg: #ffffff;
  --text: #0a0a0a;
  --text-2: #5f6368;
  --text-3: #9ca2ae;
  --border: #e6e7eb;
  --surface: #f4f4f5;
  --surface-2: #fafafa;
  --primary: #3490dd;
  --primary-soft: #e8f2fc;
  --primary-text: #1f6fb5;
  --success: #2f9e5e;
  --success-soft: #e7f6ee;
  --danger: #e5484d;
  --danger-soft: #fdecec;
  --warning: #b45309;
  --warning-soft: #fef3e2;
  --code-bg: #f6f7f9;
  --shadow: 0 1px 2px rgba(0,0,0,.04), 0 6px 18px rgba(0,0,0,.06);
  color: var(--text);
  background: var(--bg);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, "Helvetica Neue", Arial, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -webkit-text-size-adjust: 100%;
  -webkit-tap-highlight-color: transparent;
  box-sizing: border-box;
}
.mg[data-scheme="dark"] {
  --bg: #0e0f11;
  --text: #ecedee;
  --text-2: #a0a4ab;
  --text-3: #6f747c;
  --border: #2a2c31;
  --surface: #1d1f23;
  --surface-2: #16171a;
  --primary-soft: #16283a;
  --primary-text: #7cb8ee;
  --success-soft: #12301f;
  --danger-soft: #3a1d1f;
  --warning: #f2b45a;
  --warning-soft: #3a2a12;
  --code-bg: #16171a;
  --shadow: 0 1px 2px rgba(0,0,0,.3);
}
.mg *, .mg *::before, .mg *::after { box-sizing: border-box; }
.mg button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
.mg button:disabled { cursor: default; }

/* ---------- Markdown ---------- */
.mg .md { overflow-wrap: anywhere; }
.mg .md > :first-child { margin-top: 0; }
.mg .md > :last-child { margin-bottom: 0; }
.mg .md p { margin: 0 0 12px; }
.mg .md h1, .mg .md h2, .mg .md h3, .mg .md h4 { line-height: 1.3; margin: 20px 0 8px; font-weight: 650; }
.mg .md h1 { font-size: 1.45em; }
.mg .md h2 { font-size: 1.25em; }
.mg .md h3 { font-size: 1.1em; }
.mg .md h4 { font-size: 1em; }
.mg .md ul, .mg .md ol { margin: 0 0 12px; padding-left: 1.4em; }
.mg .md li { margin: 4px 0; }
.mg .md li > p { margin: 0 0 6px; }
.mg .md strong { font-weight: 650; }
.mg .md a { color: var(--primary-text); text-decoration: underline; text-underline-offset: 2px; }
.mg .md hr { border: 0; border-top: 1px solid var(--border); margin: 18px 0; }
.mg .md blockquote {
  margin: 0 0 14px; padding: 10px 14px; border-left: 3px solid var(--primary);
  background: var(--primary-soft); border-radius: 0 10px 10px 0; color: var(--text);
}
.mg .md blockquote p:last-child { margin-bottom: 0; }
.mg .md code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .88em; background: var(--code-bg); border: 1px solid var(--border); border-radius: 6px; padding: 1px 5px; }
.mg .md .code-block { margin: 0 0 14px; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: var(--code-bg); }
.mg .md .code-head { display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; font-size: 12px; color: var(--text-2); border-bottom: 1px solid var(--border); }
.mg .md .code-head button { font-size: 12px; color: var(--text-2); }
.mg .md pre { margin: 0; padding: 12px; overflow-x: auto; }
.mg .md pre code { border: 0; background: none; padding: 0; font-size: 13.5px; line-height: 1.5; }
.mg .md .table-wrap { overflow-x: auto; margin: 0 0 14px; border: 1px solid var(--border); border-radius: 10px; }
.mg .md table { border-collapse: collapse; min-width: 100%; font-size: .95em; }
.mg .md th, .mg .md td { padding: 8px 12px; border-bottom: 1px solid var(--border); text-align: left; white-space: nowrap; }
.mg .md th { background: var(--surface); font-weight: 600; }
.mg .md tr:last-child td { border-bottom: 0; }

/* ---------- Math ---------- */
.mg .katex { font-size: 1.08em; }
.mg .math-display { overflow-x: auto; overflow-y: hidden; margin: 6px 0 14px; padding: 2px 0; }
.mg .math-display .katex-display { margin: 0; }
.mg .math-error { color: var(--danger); }
.mg .math-pending, .mg .shimmer {
  height: 22px; border-radius: 6px; margin: 4px 0 12px; max-width: 220px;
  background: linear-gradient(90deg, var(--surface) 0%, var(--border) 50%, var(--surface) 100%);
  background-size: 200% 100%; animation: mg-shimmer 1.2s linear infinite;
}
@keyframes mg-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }

/* ---------- Shared bits ---------- */
.mg .card { border: 1px solid var(--border); border-radius: 16px; background: var(--bg); box-shadow: var(--shadow); }
.mg .btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: 40px; padding: 0 18px; border-radius: 999px; font-weight: 600; font-size: 15px;
  background: var(--primary); color: #fff;
}
.mg .btn:active { filter: brightness(.92); }
.mg .btn.secondary { background: var(--surface); color: var(--text); }
.mg .btn.ghost { background: none; color: var(--primary-text); padding: 0 8px; }
.mg .btn:disabled { opacity: .45; }
.mg .muted { color: var(--text-2); }
.mg .tag {
  display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--primary-text);
  background: var(--primary-soft); border-radius: 999px; padding: 3px 10px;
}
.mg .fade-in { animation: mg-fade .25s ease-out both; }
@keyframes mg-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
`;

export const TRANSCRIPT_CSS = `
.mg.transcript { overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; }
.mg .thread { max-width: 760px; margin: 0 auto; padding: 18px 18px 28px; }
.mg .turn { margin-bottom: 22px; }
.mg .user { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.mg .bubble {
  max-width: 86%; background: var(--surface); border-radius: 20px; padding: 10px 15px;
  white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.5;
}
.mg .user-images { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; max-width: 86%; }
.mg .user-images img { width: 168px; max-width: 100%; border-radius: 14px; border: 1px solid var(--border); display: block; object-fit: cover; }
.mg .user-images.many img { width: 110px; height: 110px; }
.mg .user-actions { display: flex; gap: 2px; }
.mg .assistant { position: relative; }
.mg .actions { display: flex; gap: 2px; margin-top: 8px; margin-left: -8px; }
.mg .icon-btn { width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; border-radius: 9px; color: var(--text-3); }
.mg .icon-btn:active { background: var(--surface); }
.mg .icon-btn.small { width: 30px; height: 30px; }
.mg .notice { font-size: 13px; color: var(--text-3); margin-top: 6px; }

.mg .thinking { margin: 0 0 12px; }
.mg .thinking-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: var(--text-2); font-weight: 500; }
.mg .thinking-toggle .chev { transition: transform .18s; }
.mg .thinking-toggle .chev.open { transform: rotate(90deg); }
.mg .thinking-body {
  margin-top: 8px; padding: 2px 0 2px 14px; border-left: 2px solid var(--border);
  color: var(--text-2); font-size: 14.5px; line-height: 1.55;
}
.mg .thinking-body.live { max-height: 240px; overflow: hidden; -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 40px); mask-image: linear-gradient(to bottom, transparent 0, #000 40px); display: flex; flex-direction: column; justify-content: flex-end; }
.mg .pulse-text { background: linear-gradient(90deg, var(--text-2) 0%, var(--text-3) 50%, var(--text-2) 100%); background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: mg-shimmer 1.6s linear infinite; }

.mg .typing { display: inline-flex; gap: 5px; padding: 10px 0; }
.mg .typing span { width: 7px; height: 7px; border-radius: 50%; background: var(--text-3); animation: mg-bounce 1.2s infinite ease-in-out; }
.mg .typing span:nth-child(2) { animation-delay: .15s; }
.mg .typing span:nth-child(3) { animation-delay: .3s; }
@keyframes mg-bounce { 0%, 80%, 100% { transform: scale(.6); opacity: .5; } 40% { transform: scale(1); opacity: 1; } }

.mg .error-card { background: var(--danger-soft); border-radius: 14px; padding: 12px 14px; color: var(--text); font-size: 15px; }
.mg .error-card .row { display: flex; gap: 10px; align-items: flex-start; }
.mg .error-card svg { color: var(--danger); flex: none; margin-top: 2px; }
.mg .error-card .btn { margin-top: 10px; height: 34px; font-size: 14px; padding: 0 14px; }

.mg .progress-card { padding: 16px; display: flex; gap: 14px; align-items: center; }
.mg .progress-icon { width: 44px; height: 44px; border-radius: 12px; background: var(--primary-soft); color: var(--primary); display: flex; align-items: center; justify-content: center; flex: none; }
.mg .progress-card .shimmer { height: 10px; margin: 8px 0 0; max-width: 160px; }

.mg .artifact-card { padding: 16px; }
.mg .artifact-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.mg .tag { white-space: nowrap; }
.mg .artifact-title { font-weight: 650; font-size: 16.5px; line-height: 1.3; }
.mg .artifact-sub { font-size: 13.5px; color: var(--text-2); margin-top: 2px; }
.mg .artifact-body { margin-top: 14px; }
.mg .artifact-foot { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; align-items: center; }

/* Practice question */
.mg .quiz-q { font-size: 16px; }
.mg .choices { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
.mg .choice {
  display: flex; gap: 12px; align-items: center; text-align: left; width: 100%;
  border: 1.5px solid var(--border); border-radius: 12px; padding: 10px 12px; background: var(--bg);
}
.mg .choice .letter { width: 26px; height: 26px; border-radius: 50%; background: var(--surface); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 13px; flex: none; }
.mg .choice.selected { border-color: var(--primary); }
.mg .choice.selected .letter { background: var(--primary); color: #fff; }
.mg .choice.correct { border-color: var(--success); background: var(--success-soft); }
.mg .choice.correct .letter { background: var(--success); color: #fff; }
.mg .choice.wrong { border-color: var(--danger); background: var(--danger-soft); }
.mg .choice.wrong .letter { background: var(--danger); color: #fff; }
.mg .choice .md p { margin: 0; }
.mg .feedback { margin-top: 12px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.mg .feedback.ok { color: var(--success); }
.mg .feedback.bad { color: var(--danger); }
.mg .unverified { margin-top: 10px; display: flex; gap: 8px; align-items: flex-start; background: var(--warning-soft); color: var(--warning); border-radius: 12px; padding: 9px 12px; font-size: 14px; line-height: 1.45; }
.mg .unverified svg { flex: none; margin-top: 2px; }
.mg .hint { margin-top: 12px; background: var(--surface); border-radius: 12px; padding: 10px 12px; font-size: 15px; }
.mg .solution { margin-top: 12px; border-top: 1px solid var(--border); padding-top: 12px; }

/* Graph + diagram */
.mg .plot { width: 100%; touch-action: none; user-select: none; -webkit-user-select: none; display: block; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--border); }
.mg .plot-tools { display: flex; gap: 4px; justify-content: flex-end; margin-top: 6px; }
.mg .legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 10px; font-size: 14px; }
.mg .legend > span { display: inline-flex; align-items: center; gap: 6px; }
.mg .legend > span > i { width: 14px; height: 3px; border-radius: 2px; display: inline-block; flex: none; }
.mg .diagram-img { width: 100%; display: block; background: #fff; border-radius: 12px; border: 1px solid var(--border); }
.mg .diagram-svg { width: 100%; height: auto; display: block; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--border); }
.mg .caption { margin-top: 10px; font-size: 15px; }

.mg .preview-card { margin-top: 12px; border-radius: 12px; background: var(--surface); padding: 12px 14px; font-size: 15px; }
.mg .preview-card .label { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-3); font-weight: 600; margin-bottom: 4px; }
.mg .video-thumb {
  position: relative; border-radius: 14px; overflow: hidden; aspect-ratio: 16 / 9;
  background: linear-gradient(135deg, #1d3d5e, #3490dd); color: #fff; display: flex; align-items: center; justify-content: center; text-align: center; padding: 18px;
}
.mg .video-thumb .play { position: absolute; width: 56px; height: 56px; border-radius: 50%; background: rgba(255,255,255,.95); color: #1d3d5e; display: flex; align-items: center; justify-content: center; bottom: 14px; right: 14px; }
.mg .video-thumb h3 { margin: 0; font-size: 20px; line-height: 1.3; max-width: 80%; }
`;
