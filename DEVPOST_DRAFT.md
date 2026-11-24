# Meeting Scribe — Devpost submission draft (2026-11-23, fill in URLs at submit time)

**Hackathon:** #BuildHybridAI 2026 — https://firebasehybridaihackathon.devpost.com/
**Deadline:** Nov 30, 2026 14:00 PT = Dec 1, 2026 06:00 CST (fixed, no extensions)

## Fields

**Project title:** Meeting Scribe

**Tagline:** Meeting notes that run on-device when they can, in the cloud when they must — one Firebase AI Logic SDK.

**Platform:** Web (Chrome)

**License:** Apache 2.0

**Repository URL:** https://github.com/LuYquan/meeting-scribe (public, created 2026-11-23; source files pending push)

**Hosted URL:** https://meeting-scribe-2.web.app (Firebase Hosting, deployed 2026-11-23 22:08, project meeting-scribe-2 — moved from meeting-scribe-546b2, which was denied the Gemini free tier)

**Demo video:** (TODO — YouTube link, ≤3 min, English; see VIDEO_SCRIPT.md)

## Description (paste into Devpost)

Turn meeting transcripts into summaries, action items, and decisions — with
Firebase AI Logic hybrid inference: Gemini Nano runs on-device when it's
available, Gemini runs in the cloud when it isn't. One SDK, both engines.

### How Firebase AI Logic is used

Every AI call in this app goes through Firebase AI Logic (`firebase/ai`) —
there are no other model API calls in the codebase. The only AI entry point:

- `src/firebase.ts` — `getAI(app, { backend: new GoogleAIBackend() })`
- `src/ai/inference.ts` — `getGenerativeModel(ai, { mode, inCloudParams, onDeviceParams })` and `model.generateContent(...)`
- `src/ai/schemas.ts` — `Schema` definitions used as `responseSchema` (cloud) and `responseConstraint` (on-device)

Hybrid routing, one call: transcripts up to ~6,000 characters use
`PREFER_ON_DEVICE` (Gemini Nano first, cloud fallback); longer transcripts
use `PREFER_IN_CLOUD` (Gemini 2.5 Flash). The user can also force Prefer
on-device or Prefer cloud. Every result shows the badge of the engine that
actually ran it, read from the response's `inferenceSource` — the app never
guesses. If Gemini Nano is missing, the SDK falls back to the cloud
automatically and the UI says so: no silent failures, no broken states.

Structured output on both paths: the same JSON schema shapes the summary,
participants, key points, action-item checklist (owner, due date, priority),
and decisions — so the UI renders real checklists, not raw text.

### Features

- **Analyze** — paste a transcript, get a structured summary, participants,
  key points, an action-item checklist, and decisions.
- **Follow-up email** — a cloud-drafted email (subject + body, editable) for
  the analyzed meeting.
- **Cross-meeting synthesis** — pick two or more saved meetings and get
  recurring themes (with evidence), recurring action items, and open questions.
- **History** — meetings are saved in localStorage on the device only.
  Reopen, delete, export as Markdown, copy to clipboard.
- **Samples** — three realistic English transcripts included. The first two
  route on-device in Auto mode; the incident review is long enough to route
  to the cloud, so you can see both badges without typing anything.

### Why it matters

Short everyday notes stay private, instant, and free on the device; long
documents and real writing get the cloud's long context and depth. One SDK,
both engines — private when it can be, powerful when it has to be.

## Tech

Vite 8 + React 19 + TypeScript, `firebase@13.4.0` (`firebase/ai` 3.1.0).
No other AI SDKs, no backend, no keys in source (config is env-only).
App Check enforced (debug tokens for local dev; enforcement off for the
hosted demo so judges can use it without a token).

## Pre-submit checklist

- [ ] Public GitHub repo, LICENSE (Apache 2.0) visible in About
- [ ] Hosted URL live, app loads, Firebase: Connected
- [ ] Cloud E2E verified on the hosted URL (Incident Review → Cloud badge)
- [ ] Demo video on YouTube (≤3 min, English), link works
- [ ] All four links pasted above, description proofread
- [ ] Submit BEFORE Dec 1, 06:00 CST — after the deadline the submission locks
