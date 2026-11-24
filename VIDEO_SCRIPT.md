# Meeting Scribe — Demo video script (draft, 2026-11-23)

**Target:** ≤ 3 minutes, English narration, YouTube (Public or Unlisted).
**Hackathon:** #BuildHybridAI 2026 — Web / Chrome track. Deadline 2026-12-01 06:00 CST.
**App:** Meeting Scribe — meeting notes that run on-device when they can, in the cloud when they must. One Firebase AI Logic SDK.

## Recording notes (read first)

- Record against the DEPLOYED hosted URL once it exists (judges open the same link). Do not record localhost.
- On-device badge caveat: Gemini Nano is unavailable in the cloud browser on this VM (`LanguageModel.availability() === "unavailable"`). If the recording machine also lacks Nano, the short samples will show **Cloud · Gemini + fallback notice** instead of the On-device badge. Options: (a) record on a real desktop Chrome where Nano is available, so the 0:20 segment shows the On-device badge for real; (b) if recording here, show the fallback notice on screen and narrate it as designed behavior ("no Nano here, so it falls back to the cloud — nothing breaks"). Never fake the badge.
- Keep the mouse slow, clicks deliberate. Zoom the browser to 125% so text reads on video.
- Narration: English, calm pace. If recording voice is a problem, generate the voiceover from this script and cut the screen recording to it.

## Script (~2:35)

### 0:00–0:18 — The problem
**On screen:** app open on the "Incident Review" transcript (long sample) in the editor, un-analyzed.
**Narration:** "Meetings end. Notes don't write themselves. You paste a transcript into a doc, wait for a cloud round trip, and hope nothing private leaves your laptop. Meeting Scribe does it differently."

### 0:18–0:55 — Short note, on-device
**On screen:** load sample 1 (short, ~2,200 chars). Click **Analyze meeting**. Badge appears.
**Narration:** "A short standup note — two thousand characters. The app routes it on-device, to Gemini Nano running right here in Chrome. Structured summary, decisions, action items — instant, and the text never leaves your device."
**If Nano is unavailable:** badge reads Cloud · Gemini with the fallback notice. Narrate instead: "On this machine Nano isn't available, so the app falls back to the cloud and says so — same result, no silent failure."

### 0:55–1:20 — Long document, cloud
**On screen:** load sample 3 "Incident Review" (~6,100 chars). Click **Analyze meeting**. **Cloud · Gemini** badge + summary + action items render.
**Narration:** "A six-thousand-character incident review is too big for the device. Same SDK, one call — it goes to Gemini 2.5 Flash in the cloud. One model call, one code path, the badge tells you where it ran."

### 1:20–1:50 — Email draft + synthesis
**On screen:** click **Draft follow-up email**, show the generated draft. Then select two history items, click synthesis, show the cross-meeting result.
**Narration:** "Same meeting, one click, and there's the follow-up email — ready to send. And across meetings: pick two past notes, and it synthesizes what changed, what carried over, and what's still open."

### 1:50–2:15 — Routing control + history/export
**On screen:** open the routing toggle (Auto / Prefer on-device / Prefer cloud), switch it once; show history list; export one meeting as Markdown, show the download.
**Narration:** "You stay in control: auto routing, or force on-device, or force cloud. History lives in your browser, and any meeting exports as clean Markdown."

### 2:15–2:35 — Close
**On screen:** back to the main view, both badges visible in history (one on-device, one cloud) — or the fallback notice if Nano was unavailable.
**Narration:** "Private when it can be, powerful when it has to be. One SDK, both engines — Firebase AI Logic. Meeting Scribe."

## Shot list (for the editor)

1. App landing, long transcript pasted.
2. Sample 1 → Analyze → badge close-up → results scroll.
3. Sample 3 → Analyze → Cloud badge close-up → results scroll.
4. Email draft panel.
5. Two history items selected → synthesis result.
6. Routing toggle menu, switch Auto → Prefer cloud → back to Auto.
7. History list → Export Markdown → downloaded file shown.
8. Closing frame: header + tagline.

## Post-recording checklist

- [ ] Length ≤ 3:00 (hard cut at 2:59).
- [ ] English audio OR English subtitles burned in.
- [ ] Both badges legible at 1080p (zoom in on badge if needed).
- [ ] No localhost URL visible in the address bar (use the hosted URL).
- [ ] Upload to YouTube early — processing can take hours. Title: "Meeting Scribe — hybrid on-device + cloud meeting notes (Firebase AI Logic)".
