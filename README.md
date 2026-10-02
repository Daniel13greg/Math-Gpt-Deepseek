# MathGPT

A React Native (Expo) STEM tutor app in the style of the **MathGPT** mobile app, running on its own math
models, **MathGPT Flash** and **MathGPT Pro**.
Ask any STEM question, snap a photo of a problem, record a lecture and get notes, or generate
practice tests, flashcards, graphs, diagrams, study guides and narrated video lessons.

![Chat, tools, answers and lecture notes](docs/screens-1.jpg)
![Practice question, graph, flashcards and video lesson](docs/screens-2.jpg)
![Flowchart, practice test, lecture notes and dark mode](docs/screens-3.jpg)

## Features

| | |
|---|---|
| **Math keyboard** | The **∑** button in the composer opens a structured math editor ([MathLive](https://mathlive.io), with an on-screen math keyboard) for fractions, powers, roots and symbols; **Insert** adds it to your question as LaTeX. Works offline. |
| **Chat** | Step-by-step answers for 10 subjects (Math, Physics, Accounting, Chemistry, Statistics, Biology, Economics, Finance, Computer Science, Engineering). Streaming Markdown with **LaTeX math** (KaTeX, incl. `\ce{}` chemistry), tables and code. Fractions are always stacked and symbols typeset, even when the model or student types plain text like `6/4`, `x^2`, `sqrt(16)` or `a <= b`. Copy, share, read aloud, regenerate, edit. A new chat opens with starter questions for the chosen subject. |
| **Answer styles** | Step by step, **Tutor mode** (Socratic: hints first, the student does the steps), Just the answer, Explain simply, Exam-style working. Pick one from the **+** menu or Settings. |
| **Check My Work** | Photograph or type your own working; the reply gives a verdict, marks each step and explains the first mistake with a corrected solution. |
| **Deep Think** | Thinking mode with a live, collapsible chain of thought and adjustable reasoning effort. On by default for every model (Flash included) and used for study tools and lecture notes too. |
| **Scan** | In-app camera with a resizable crop frame (or pick from photos). The photo goes straight to the vision model (Flash). If a photo holds several exercises, the app asks which one to solve (or all of them). |
| **Share to the app** | Share a screenshot or photo (or text) from any app's share sheet: it lands in the composer ready to solve. Uses `expo-sharing`'s share extension (experimental), so it needs a development or production build, not Expo Go. |
| **Record** | "Create lecture notes": record a lecture (live transcript) or upload MP3/AAC/WAV/OGG/FLAC, then the model writes structured notes with formulas, examples and review questions. Recording keeps going while you use Chat or Scan. **Study this lecture** turns the notes into flashcards, a practice test or a study guide, or opens a chat grounded in them (**Ask about it**). |
| **Tools** | Check My Work, Create Video (animated slides + text-to-speech narration), Practice Test (scored, with review and **Practice my mistakes**, which writes a new test aimed at the questions you missed), Practice Question (interactive, hints, solution; **Another question** gets harder after a right answer and easier after a wrong one), Graph (pan/zoom plot), Diagram (flowchart, mind map, geometry, free-body, Venn), Study Guide, Flashcards (flip + swipe, with spaced repetition: every "Got it" / "Still learning" schedules the card, and decks with cards due show under **Review today** in the drawer). |
| **PDF export** | Save answers and study guides (chat actions), lecture notes, practice tests (questions, then the answer key on its own page) and flashcards as PDFs to share or print. Math prints as native MathML. |
| **History** | Chats and notes are saved on the device; searchable drawer grouped by date; rename/delete. |
| **Backup** | Settings → Backup saves chats (with photos), notes, flashcard progress, usage and settings (never API keys) to a JSON file; restoring merges it in without deleting anything. |
| **Usage** | Tokens per chat (long-press it in the drawer), per lecture note, this month and all time, per model. Enter per-model prices in Settings to see costs too. |
| **Models** | The header shows the current model; tap it to switch between *Flash* (fast, reads photos) and *Pro* (strongest reasoning). |
| **Themes** | Light, dark or system. |
| **Languages** | English, Español, Português (Brasil), Français, Deutsch and 简体中文, following the device language or chosen in Settings. Answers always follow the language the student writes in. |

## Quick start

You need Node 20+ and an API key for the model server.

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** (Android/iOS), open **☰ → Settings**, paste your API key and tap
**Test connection**. Chat, photos, tools and lecture-file upload with cloud transcription all work in Expo Go.

> **Voice input and live lecture transcription** use on-device speech recognition
> (`expo-speech-recognition`), which isn't part of Expo Go. Use a development/production build
> (below), or set **Settings → Speech to text → Cloud** with any OpenAI-compatible
> `/audio/transcriptions` endpoint (OpenAI Whisper, Groq, a self-hosted whisper server).

### Install an APK on your phone (recommended)

Builds in the cloud with [EAS](https://docs.expo.dev/build/introduction/) (free tier) — no Android Studio needed:

```bash
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview   # produces an installable .apk
```

For a development build with fast refresh: `npx eas-cli@latest build -p android --profile development`,
or locally with Android Studio: `npm run android:dev-build`.

### Try it without an API key

A mock server streams canned answers in the model server's format (including thinking and every tool):

```bash
npm run mock          # http://0.0.0.0:8787
```

In the app set **Settings → Server** to `http://<your-computer-ip>:8787` and use any key.

### Optional: build-time key for development

Create `.env.local` with `EXPO_PUBLIC_API_KEY=sk-...`. `EXPO_PUBLIC_` values are embedded in
the JavaScript bundle, so **never ship a build made this way**. Keys entered in Settings are stored in
the iOS Keychain / Android Keystore instead. (Baking in an *app token* for the
[key-holding proxy](server/README.md) is fine: it only reaches your proxy, inside its limits.)

## Models & settings

| Setting | Default | Notes |
|---|---|---|
| Model | MathGPT Flash | Fast; reads photos. MathGPT Pro is the strongest text model. A custom model ID can be entered in Settings. |
| Deep Think | on | Sends `thinking: {type: "enabled"}` and `reasoning_effort` (low/high/max) for answers, study tools and notes, on every model. The app always sends the flag explicitly. If the server refuses JSON mode together with thinking, tools retry without `response_format`. |
| Server | built-in | Point it at your own proxy to keep keys off devices (see Security), or bake one in at build time with `EXPO_PUBLIC_API_BASE_URL`. |

The built-in server address and the model IDs live in `src/lib/ai/models.ts`; the app only ever shows the
model names. Photos are always routed to the vision model (Flash). Tools use JSON mode
(`response_format: json_object`) with schema validation, LaTeX-safe JSON repair and one automatic retry.

**Answer checking.** Practice tests and questions are solved a second time without the answer key
(`src/lib/tools/verify.ts`). A test drops questions where the two solves disagree (keeping at least 4); a
single question is rewritten once and, if the rewrite still disagrees, shown with a "double-check this one"
note. Graph key points that don't lie on any plotted curve are removed.

## How it's built

- **Expo SDK 57**, React Native 0.86, React 19.2 + React Compiler, **Expo Router** (drawer + stack), TypeScript.
- **Model client** (`src/lib/ai/`): SSE streaming over `expo/fetch`, separate `reasoning_content`
  stream, `reasoning_content` round-trip for multi-turn thinking mode, friendly errors for 401/402/429/5xx,
  automatic retry with backoff for rate limits, overload and network errors (only before any text has streamed).
- **Chat history** is capped at about 48K tokens per request: the opening message and the latest turns are kept,
  older turns in between are dropped. Chat titles are written by Flash.
- **Rich content** is rendered with [Expo DOM components](https://docs.expo.dev/guides/dom-components/)
  (`'use dom'`): Markdown (`marked`) + KaTeX, interactive graphs/diagrams/tests/flashcards. The chat
  transcript is one WebView; streamed tokens are pushed into it imperatively so the whole conversation
  isn't re-sent over the bridge for every token. KaTeX fonts are inlined (`npm run katex:css`) so math
  renders offline inside the WebView.
- **Math formatting** (`src/lib/math/`): before rendering, math written as plain text ("6/4",
  "x^2 - 5x + 6 = 0", "sqrt(16)", "a <= b", "2H2 + O2 -> 2H2O") is detected and turned into TeX, and
  loose TeX is cleaned up (slash fractions → `\frac`, `<=` → `\le`, …), so fractions are stacked and
  symbols typeset everywhere — answers, thinking, notes, student messages and study tools. Places that
  can't run KaTeX (chat titles, diagram and graph labels) get the Unicode equivalent: "x² − 4", "⁶⁄₄".
- **Localization** (`src/i18n/`): typed string keys with English as the source of truth, `{placeholder}`
  interpolation and plural forms via `Intl.PluralRules`; a test checks every locale has every key and the same
  placeholders. DOM components receive the language as a prop. Add a language by adding a file in
  `src/i18n/locales/` and an entry in `LANGUAGES`. Prompts to the model stay in English.
- **State**: zustand stores persisted to SQLite key-value storage (`expo-sqlite/kv-store`), one key per
  chat, written only when a chat changes and throttled during streaming. Photos live in the app's
  document directory.
- **Safety**: model output never runs as code — raw HTML is escaped, graph expressions go through a
  small hand-written parser (no `eval`), and model-drawn SVG is sanitized and shown via `<img>`.

```
src/
  app/                    routes: (main) drawer screen, settings, models, notes, practice-test, flashcards, video, image
  components/
    chat/                 composer, subject tabs, welcome screen, tools & "+" sheets, chat screen
    camera/ record/       Scan and Record modes
    dom/                  'use dom' components (Transcript, RichDocument, PracticeTest, Flashcards, VideoScene) + web libs
    drawer/ header/ ui/   navigation chrome and shared UI
  lib/
    ai/                   model API client, SSE parser, errors, models
    chat/                 send/stream/regenerate controller, history → API messages
    tools/                tool generation and JSON normalizers
    speech/               on-device + cloud speech-to-text
  i18n/                   translations (en, es, pt, fr, de, zh) and the t()/useT() helpers
  store/                  zustand stores (chats, notes, reviews, usage, settings, ui, toast)
scripts/                  mock model server, KaTeX CSS generator
server/                   key-holding proxy for public releases
e2e/                      Playwright tests of the web build
.maestro/                 Maestro flows for the native app
```

## Development

```bash
npm test            # Jest: unit tests plus a controller integration test (send → stream → title → usage)
npm run typecheck
npm run lint
npm run web         # quickest way to iterate on UI in a browser
npm run e2e         # exports the web build, then runs the Playwright tests against it and the mock server
npm run test:server # tests for the key-holding proxy (server/proxy.mjs)
```

### End-to-end tests (web)

`e2e/` drives the exported web build in a phone-sized Chromium against the mock model server, so no
API key is needed: a Deep Think answer and chat title, tutor mode, Check My Work, the math keyboard, the
photo problem picker, a practice test → **Practice my mistakes**, flashcards → **Review today**, lecture
notes → flashcards, switching language, backup → restore on a fresh device, usage counting, and chatting
through the key-holding proxy with an app token.
Playwright starts both servers itself (`playwright.config.ts`); run `npx playwright install chromium` once.

### Native flows (Maestro)

`.maestro/` has the same core journeys for a real iOS simulator or Android emulator, using
[Maestro](https://maestro.mobile.dev). They need a development build (`npm run android:dev-build` /
`npm run ios:dev-build`; release builds block plain `http://` to the mock), and the mock server running:

```bash
npm run mock                                    # in one terminal
maestro test .maestro                           # Android emulator (reaches the host at 10.0.2.2)
maestro test -e MOCK_URL=http://localhost:8787 .maestro   # iOS simulator
```

They aren't run in CI (that needs an emulator runner or Maestro Cloud).

### CI

`.github/workflows/ci.yml` runs on every pull request and push to `main`: typecheck, lint, Jest and the
proxy tests, then
the web build with the Playwright tests (the report is uploaded when they fail). An **EAS Update** job can
publish an over-the-air update after `main` goes green; it stays off until you run
`npx expo install expo-updates` and `npx eas-cli@latest update:configure`, add an `EXPO_TOKEN` secret and
set the repository variable `EAS_UPDATE_ENABLED` to `true`.

## Security & publishing notes

- An API key on a phone can be extracted by its owner. That's fine for personal use; for a public
  release, run the key-holding proxy in [`server/`](server/README.md) (app tokens, per-client rate limits,
  a daily token budget) and point the app at it with **Settings → Server**, or at build time with
  `EXPO_PUBLIC_API_BASE_URL`.
- "MathGPT" is another company's product name, mirrored here to match the original UI. Change
  `APP_NAME` in `src/constants/app.ts`, `name` in `app.json` and the bundle IDs before publishing.
- The "video" tool produces narrated, animated slides played in the app (on-device text-to-speech),
  not an exported video file.
