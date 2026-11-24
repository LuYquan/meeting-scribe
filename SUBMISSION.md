# Meeting Scribe — Submission checklist

**Hackathon:** #BuildHybridAI 2026 (Devpost) — Web / Chrome track
**Deadline:** Nov 30, 2026 14:00 PT = **Dec 1, 2026 06:00 CST** (fixed, no extensions)
**Prizes:** $10,000 Grand · $7,000 1st runner-up · $4,000 2nd runner-up · $3,000 Best Web App
**Judging:** Dec 10–16, 2026 · Winners ~Dec 21, 2026

## Status

| Step | State |
|---|---|
| App built (Vite + React + TS) | ✅ Done — `npm run build` clean, `npm run lint` 0 warnings |
| All AI via Firebase AI Logic | ✅ Done — grep-verified, see below |
| On-device path (Gemini Nano) | ✅ Implemented per Firebase docs + SDK typings; **not runnable on this machine** (Chrome 157 reports `LanguageModel.availability() === "unavailable"`) — code path verified by build + docs, not by live run |
| Cloud path (Gemini 2.5 Flash) | ❌ **BLOCKED 2026-11-23** — see "Cloud E2E result" below: API key gets HTTP 403 PERMISSION_DENIED on generativelanguage.googleapis.com; needs a console-side fix (enable API / key restrictions) |
| UI smoke test (dev server) | ✅ Serves 200; needs a live browser pass (see step 5) |
| Firebase project + config | ✅ Done 2026-11-23 — project `meeting-scribe-546b2` (Spark, Analytics off, AI Logic on Gemini Developer API); `.env` created from `.env.example` with real values (not committed); build clean; dev server on :5173 |
| Temporary public URL for browser check | ❌ **Not obtainable from this VM** — localtunnel, serveo and cloudflared all blocked by the egress proxy (see "Cloud E2E result"); use http://127.0.0.1:5173 directly in the live browser |
| App Check debug token | ⬜ TODO (after step 1) |
| Public GitHub repo + Apache license | ✅ Done 2026-11-23 21:21 — https://github.com/LuYquan/meeting-scribe, commit `8f4cc88` ("Initial commit: Meeting Scribe for #BuildHybridAI 2026"), 32 files; LICENSE (Apache 2.0) at root; provider init commit `9cc7a3f`'s generated README replaced by ours (verified via API read) |
| Hosted URL | ✅ Done 2026-11-23 22:08 — https://meeting-scribe-2.web.app (Firebase Hosting, `firebase deploy --only hosting`, project meeting-scribe-2, Spark free; moved from meeting-scribe-546b2) |
| Cloud E2E (hosted URL) | ❌ **Free route exhausted 2026-11-23 22:12** — new project meeting-scribe-2 ALSO denied the free tier: `gemini-3-flash-preview` and `gemini-3.8-flash` probes both return `403 free tier not available` (3/4 requests; 1× 401 is App Check propagation noise). Two projects under luyanqua@gmail.com both ineligible → account/region-level, a third project won't help. Model switched: `gemini-2.5-flash` is deprecated for new users (404) → app now uses `gemini-3-flash-preview` (Firebase docs' current model), rebuilt + **redeployed to meeting-scribe-2 2026-11-23 22:16** (firebase-tools reinstalled after VM restart wiped /usr global install). **Remaining fix: link Cloud Billing (Blaze, pay-as-you-go; demo usage is pennies) — awaiting user's decision/card; OR try a project under the null US-region account (uncertain).** Note: console says AI Logic auto-enforces App Check from 2027-01-21 (59 days) — after the Dec 1 deadline, but the app needs App Check configured by then if it stays live. |
| Demo video (≤3 min, English, YouTube) | ⬜ TODO (user records after config works) |
| Devpost submission form | ⬜ TODO (user submits before Dec 1, 06:00 CST) |

## Cloud E2E result (2026-11-23 ~00:00 CST — BLOCKED, console-side fix needed)

**What was done:** `.env` created from `.env.example` with the real
`meeting-scribe-546b2` config (verified values, not committed — `.gitignore`
excludes `.env`). `npm run build` clean. Dev server restarted and serving
HTTP 200 on http://127.0.0.1:5173 (plus an earlier instance on :5174); the
served `src/firebase.ts` contains the real project id, so env injection works.
Smoke script `scripts/cloud-e2e.mts` uses the app's real prompt builders,
response schemas and parsers with `PREFER_IN_CLOUD` + `gemini-2.5-flash`
(the same construction as `src/ai/inference.ts`, run in Node because no
headless browser exists on this machine).

**Result — analysis of the "Incident Review" sample (6,124 chars):**
route decision was `PREFER_IN_CLOUD` (correct), then the first
`generateContent` call failed with `AbortError: Timeout has expired.` after
180 s. Follow-up email draft and cross-meeting synthesis were **not run** —
they use the same call path and would hit the same failure.

**Root cause (proven by direct REST, not a guess):**
`POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=<web API key>`
returns HTTP 403, twice (7.9 s and, after a 60 s wait, 0.5 s — so not
propagation lag):
`{"error":{"code":403,"message":"Permission denied on the service.","status":"PERMISSION_DENIED","details":[{"@type":"type.googleapis.com/google.rpc.ErrorInfo","reason":"ACCESS_DENIED","domain":"googleapis.com","metadata":{"service":"generativelanguage.googleapis.com"}}]}}`
Network itself is fine (`firebase.googleapis.com` 401 in ~1 s, npm 200,
GitHub 200). The web API key is not authorized for the Generative Language
API — most likely the API is not enabled for project `meeting-scribe-546b2`,
or the key has API restrictions excluding it. **This is not an App Check
error** — no App Check error occurred anywhere (App Check init is skipped in
the app when no reCAPTCHA key is set, and the Node smoke test doesn't init
it either). Console-side fix needed: enable the Generative Language API for
the project and/or check the web API key's API restrictions, then re-run
`node --experimental-strip-types scripts/cloud-e2e.mts`.
Note: the Node SDK call hung for the full 180 s instead of surfacing the 403
quickly — the in-browser path may report the error faster; the live browser
check will show the real in-app error.

## Resume note (2026-11-23 20:20 CST)

User resumed ("恢复 Firebase，现在开工") — the 15:43 pause above no longer
applies. Since then: `firebase-tools` 15.37.0 installed; `firebase login
--no-localhost` running, waiting for the user's authorization code
(first session 88318 expired when the user hit an error at 21:29; fresh
session 68172, new link sent 21:33); `firebase.json` + `.firebaserc`
(default=meeting-scribe-546b2) written; `npm run build` re-verified clean;
empty public repo created (see status table); Devpost draft written to
`DEVPOST_DRAFT.md`; video script in `VIDEO_SCRIPT.md`. Next: auth code →
`firebase deploy` → hosted-URL E2E retest → push source files to repo →
video → Devpost submit.

## Recheck note (2026-11-23 15:43 CST, research sandbox — inconclusive, not new evidence)

Re-ran `scripts/cloud-e2e.mts` once: it failed fast with 403 on
`firebasevertexai.googleapis.com` — a different symptom from the 180 s
timeouts recorded above, and the run itself reported an egress restriction
("not permitted during background preparation"). Treat this run as
inconclusive: it does **not** prove the API is still disabled and does not
change the corrected diagnosis above (Generative Language API already
enabled; direct Browser-key probe 403 is expected, not the app path).
Status stays **user-paused** ("先放着", ~08:10 CST 2026-11-23) — do not
resume cloud E2E, repo, hosting, video or Devpost steps until the user says
to continue. Re-test only in the main environment / live browser.

**Temporary public URL — tried three services, all blocked by the VM's egress
proxy (198.19.0.1:3128):** localtunnel (`localtunnel.me` / `loca.lt`
unreachable, connection timeout, client never got a URL); serveo (SSH
connection reset by the proxy); cloudflared (`api.trycloudflare.com` TLS
handshake failure through the proxy). No public URL could be obtained from
this VM. The dev server is still running on :5173/:5174 — run the live
browser UI check against http://127.0.0.1:5173 directly.

## 1. Create the Firebase project (user, browser)

1. Go to https://console.firebase.google.com/ → **Add project**.
   Name it e.g. `meeting-scribe`. Google Analytics: **off** (not needed).
2. **Build → AI Logic → Get started** → choose the **Gemini Developer API**
   (free tier, no billing). Complete the guided setup — it turns on the
   required APIs and App Check enforcement for AI Logic.
3. **Project settings → Your apps → Add app → Web (`</>`)**, nickname
   `meeting-scribe-web`. Copy the config object.
4. In the project directory, create `.env` from `.env.example` and fill in:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
5. Run `npm run dev`, open the app, and confirm the header pill changes to
   **Firebase: Connected**. Then run the cloud end-to-end test: load the
   "Incident Review" sample (it routes to the cloud) and confirm a
   **Cloud · Gemini** badge appears with a summary and action items.

## 2. App Check debug token (user, browser + console)

1. In `.env`, set `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN=true` and restart
   the dev server.
2. Open the app → DevTools → Console → copy the printed
   `AppCheck debug token: "..."`.
3. Firebase console → **App Check → Apps → (your web app) → Manage debug
   tokens** → add the token.
4. Reload the app and re-run an analysis to confirm AI calls succeed.

**For the hosted demo (judges open the link in their own browser):**
the debug token only works in the browser that generated it. Recommended:
Firebase console → **App Check → APIs → AI Logic → enforcement OFF**
before sharing the hosted link, so judges can use the app without a token.
(If enforcement stays on, judges' AI calls will fail — the app will show
the error instead of results.)

## 3. Public GitHub repo (done: repo created; files pending push)

1. Public repo created 2026-11-23 via browser:
   https://github.com/LuYquan/meeting-scribe (empty, no commits).
   Note: the GitHub connector cannot create repos (API returns 403
   "Resource not accessible by integration") — creation had to go through
   the browser.
2. Push the project files with the GitHub connector `push-files`
   (snapshot procedure in the connector's `snapshot-push.md`), NOT a
   browser upload: 32 files (manifest `/tmp/meeting-scribe-paths.txt`),
   excludes `node_modules/`, `dist/`, `.env`, `firebase-debug.log`,
   `SUBMISSION.md`, `VIDEO_SCRIPT.md`, `DEVPOST_DRAFT.md`. Branch `main`,
   message "Initial commit: Meeting Scribe for #BuildHybridAI 2026".
   Status 2026-11-23 21:21: push succeeded after the user added the repo
   to the Muse GitHub App installation (first attempt 21:12 timed out on
   approval; second attempt 21:14 failed 403 until the App install was
   fixed). Snapshot commit `8f4cc884fe399785edb46e4b3fd4c37760797f66`,
   verified via `list_commits` + `get_file_contents` (README is ours).
   Sync record: `meeting-scribe.muse-github-snapshot-sync.json` next to
   the project dir.
3. Confirm the **LICENSE** (Apache 2.0) is at the repo root — Devpost
   requires the open-source license to be detectable in the repo's About
   section.
4. Confirm the repo shows Firebase AI Logic actually used: `src/ai/inference.ts`
   imports `getGenerativeModel` from `firebase/ai` and calls
   `model.generateContent(...)` — not just named in the README.

## 4. Hosted URL (strongly encouraged for judging)

- **Firebase Hosting (recommended, same project):**
  `npm install -g firebase-tools && firebase login && firebase init hosting`
  (public dir: `dist`), then `npm run build && firebase deploy`.
- Or deploy `dist/` to Vercel / Netlify free tier.
- The hosted app needs the same env vars set in the hosting provider's
  dashboard (or a production `.env` baked at build time — never commit it).

## 5. Live browser check (before recording)

- Open the hosted URL (or `http://localhost:5173`) in Chrome.
- Load each of the 3 samples, run **Analyze meeting**, confirm results render.
- Confirm the routing story: samples 1–2 show **On-device · Gemini Nano**
  when Nano is available, otherwise **Cloud · Gemini** with the fallback
  notice; sample 3 (long) shows **Cloud · Gemini**.
- Draft a follow-up email; select two history items and run synthesis.
- Export a meeting as Markdown and confirm the download works.

## 6. Demo video (user records, ≤3 min, English, YouTube)

- Script (suggested, ~2:30):
  1. (0:00) The problem: meeting notes take forever; paste a transcript.
  2. (0:20) Analyze a short sample → **On-device · Gemini Nano** badge,
     instant, "never left your device".
  3. (0:55) Analyze the long incident review → **Cloud · Gemini** badge.
  4. (1:20) Follow-up email draft + cross-meeting synthesis.
  5. (1:50) Show the routing toggle (Auto / Prefer on-device / Prefer cloud)
     and the fallback notice when Nano is unavailable.
  6. (2:10) "One SDK, both engines — Firebase AI Logic."
- Upload to YouTube as **Public** (or Unlisted — Devpost accepts either if
  the link works), English audio or English subtitles. Upload early:
  YouTube processing can take hours.

## 7. Devpost submission (user, before Dec 1, 06:00 CST)

Go to https://firebasehybridaihackathon.devpost.com/ → **Submit** (or
**Enter**), and fill in:

- **Project title:** Meeting Scribe
- **Tagline:** Meeting notes that run on-device when they can, in the cloud
  when they must — one Firebase AI Logic SDK.
- **Description:** paste the "Description" from `README.md` plus:
  how Firebase AI Logic is used (hybrid `getGenerativeModel` with
  `PREFER_ON_DEVICE` / `PREFER_IN_CLOUD`, structured output via
  `responseSchema` + `responseConstraint`, `inferenceSource` badges),
  the feature list, and the value proposition (private + instant for
  everyday notes, cloud power for long documents and writing).
- **Platform:** Web (Chrome).
- **Repository URL:** the public GitHub repo URL.
- **Hosted URL:** the deployed app URL.
- **Demo video:** the YouTube link.
- **License:** Apache 2.0.

After the deadline the submission is locked and later commits are not
evaluated — submit early, then only fix the repo if something is broken
before the deadline.

## Verification evidence (already done)

- `npm run build` — clean (tsc + vite). `npm run lint` — 0 warnings, 0 errors.
- Pure-function tests (parsing + routing + source normalization): **23/23
  passed** (`/tmp/meeting-scribe-test.ts`, esbuild bundle of the real sources).
- `npm run dev` serves HTTP 200 at `http://127.0.0.1:5173/`.
- AI-call audit: `grep -rn "generateContent\|getGenerativeModel" src/` shows
  all call sites in `src/ai/inference.ts` (firebase/ai). `grep -rniE
  "fetch\(|axios|openai|anthropic" src/` — **none found**.
- Sample routing (measured): sample 1 = 2,209 chars → on-device;
  sample 2 = 2,630 chars → on-device; sample 3 = 6,124 chars → cloud.
- On-device unavailability (measured 2026-11-23): cloud Chrome 157,
  `LanguageModel` exists, `availability()` returns `"unavailable"`,
  Prompt API Playground also reports unavailable. The app handles this by
  design: cloud fallback + explicit banner, never a silent failure.
