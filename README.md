# Meeting Scribe

Turn meeting transcripts into summaries, action items, and decisions —
with **Firebase AI Logic hybrid inference**: Gemini Nano runs on-device when
it's available, Gemini runs in the cloud when it isn't. One SDK, both engines.

Built for **#BuildHybridAI 2026** on Devpost (Web / Chrome track).

## The hybrid story

| | On-device | Cloud |
|---|---|---|
| Engine | Gemini Nano (Chrome Prompt API) | Gemini 2.5 Flash |
| Used for | Short transcripts: summary, action items, decisions | Long transcripts, follow-up emails, cross-meeting synthesis |
| Why here | Instant, private, free, works offline | Long context, deep writing, multi-document reasoning |
| Badge | `On-device · Gemini Nano` | `Cloud · Gemini` |

Every result shows the badge of the engine that **actually ran it**, read from
the response's `inferenceSource` — the app never guesses. If Gemini Nano is
missing, the SDK falls back to the cloud automatically and the UI says so:
no silent failures, no broken states.

Routing (Auto mode):

- Transcript up to ~6,000 characters → `PREFER_ON_DEVICE` (Nano first, cloud fallback)
- Longer transcript → `PREFER_IN_CLOUD` (Nano's context is 9,216 tokens)
- The user can also force **Prefer on-device** or **Prefer cloud**.

## Features

- **Analyze** — paste a transcript, get a structured summary, participants,
  key points, an action-item checklist (owner, due date, priority), and
  decisions. Structured JSON output on both paths, so the UI renders real
  checklists, not raw text.
- **Follow-up email** — a cloud-drafted email (subject + body, editable) for
  the analyzed meeting.
- **Cross-meeting synthesis** — pick two or more saved meetings and get
  recurring themes (with evidence), recurring action items, and open questions.
- **History** — meetings are saved in localStorage on the device only.
  Reopen, delete, export as Markdown, copy to clipboard.
- **Samples** — three realistic English transcripts included. The first two
  route on-device in Auto mode; the incident review is long enough to route
  to the cloud, so you can see both badges without typing anything.

## All AI inference goes through Firebase AI Logic

There are no other model API calls in this codebase. The only AI entry point
is `firebase/ai`:

- `src/firebase.ts` — `getAI(app, { backend: new GoogleAIBackend() })`
- `src/ai/inference.ts` — `getGenerativeModel(ai, { mode, inCloudParams, onDeviceParams })`
  and `model.generateContent(...)`
- `src/ai/schemas.ts` — `Schema` definitions used as `responseSchema` (cloud)
  and `responseConstraint` (on-device)

Verify it yourself: `grep -rn "generateContent\|fetch(" src/` — every call
site is a `firebase/ai` call.

## Run it locally

```bash
npm install
cp .env.example .env   # then fill in your Firebase web config
npm run dev            # http://localhost:5173
npm run build          # type-check + production build
npm run lint           # oxlint
```

### 1. Create a Firebase project

1. Go to the [Firebase console](https://console.firebase.google.com/) →
   **Add project** (no Google Analytics needed).
2. **Build → AI Logic → Get started** → choose the **Gemini Developer API**
   (free tier, no billing). This also turns on App Check enforcement for
   AI Logic.
3. **Project settings → Your apps → Web app** (`</>`): register the app and
   copy the config values into `.env` (see `.env.example`).

### 2. App Check

AI Logic enforces App Check. For local development use the debug provider:

1. Set `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN=true` in `.env`.
2. Run the app, open DevTools → Console, copy the printed
   `AppCheck debug token: "..."`.
3. Firebase console → **App Check → Apps → Manage debug tokens** → register it.

For the hosted demo, either register the token for the demo browser or turn
off enforcement for AI Logic in the console (App Check → APIs → AI Logic →
enforcement off). Debug tokens are accepted for #BuildHybridAI submissions.
See `SUBMISSION.md` for the recommended setup.

### 3. Chrome for on-device inference

On-device inference needs Chrome on Desktop v139+ with the Prompt API flag:

- `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` → Enabled
- Restart Chrome, then check `await LanguageModel.availability()` in DevTools
  — it should print `available`, `downloading`, or `downloadable`.

If it prints `unavailable`, the app still works fully: everything runs in the
cloud and the UI says so. That is the hybrid fallback working as designed.

## Project layout

```
src/
  App.tsx                 — layout, state machine, routing UI
  firebase.ts             — Firebase init, App Check, AI service
  ai/
    inference.ts          — routing, model factory, analyze/email/synthesize
    schemas.ts            — structured-output schemas (both paths, same shape)
    prompts.ts            — prompt templates
    parsing.ts            — tolerant JSON parsing + source normalization
  data/samples.ts         — 3 realistic English sample transcripts
  lib/
    types.ts, storage.ts  — types + localStorage history
    export.ts             — Markdown export, clipboard, download
  components/
    SourceBadge.tsx       — On-device / Cloud badge + latency
    ResultsPanel.tsx      — summary, checklist, decisions, email draft
    HistoryPanel.tsx      — history list + cross-meeting synthesis UI
```

## Tech

- Vite 8 + React 19 + TypeScript
- `firebase@13.4.0` (`firebase/ai` 3.1.0) — AI Logic hybrid inference
- No other AI SDKs, no backend, no keys in source (config is env-only)

## License

Apache 2.0 — see [LICENSE](LICENSE).
