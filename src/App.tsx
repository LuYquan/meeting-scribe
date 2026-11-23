import { useEffect, useMemo, useState } from "react";
import { isFirebaseConfigured, missingConfigKeys } from "./firebase";
import {
  analyzeTranscript,
  decideRoute,
  deviceStatusLabel,
  draftFollowUpEmail,
  probeDeviceModel,
  synthesizeMeetings,
  type ProgressUpdate,
} from "./ai/inference";
import { SAMPLE_TRANSCRIPTS } from "./data/samples";
import { deleteMeeting, loadMeetings, newId, saveMeeting } from "./lib/storage";
import {
  copyText,
  downloadText,
  emailToMarkdown,
  meetingToMarkdown,
  synthesisToMarkdown,
} from "./lib/export";
import type {
  DeviceStatus,
  EmailDraft,
  MeetingRecord,
  RoutingPreference,
  RunInfo,
  SynthesisResult,
} from "./lib/types";
import { ResultsPanel } from "./components/ResultsPanel";
import { HistoryPanel, SynthesisPanel } from "./components/HistoryPanel";
import { SourceBadge } from "./components/SourceBadge";

export default function App() {
  const [configured] = useState(() => isFirebaseConfigured());
  const [missingKeys] = useState(() => missingConfigKeys());
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>("checking");
  const [transcript, setTranscript] = useState("");
  const [preference, setPreference] = useState<RoutingPreference>("auto");
  const [current, setCurrent] = useState<MeetingRecord | null>(null);
  const [currentRun, setCurrentRun] = useState<RunInfo | null>(null);
  const [history, setHistory] = useState<MeetingRecord[]>(() => loadMeetings());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState<EmailDraft | null>(null);
  const [emailRun, setEmailRun] = useState<RunInfo | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [synthesis, setSynthesis] = useState<SynthesisResult | null>(null);
  const [synthesisRun, setSynthesisRun] = useState<RunInfo | null>(null);
  const [synthesisLoading, setSynthesisLoading] = useState(false);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    probeDeviceModel().then((status) => {
      if (!cancelled) setDeviceStatus(status);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const route = useMemo(
    () => (transcript.trim() ? decideRoute(transcript, preference) : null),
    [transcript, preference],
  );

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2500);
  };

  const handleAnalyze = async () => {
    const text = transcript.trim();
    if (!text || !configured || busy) return;
    setError(null);
    setBusy(true);
    setProgress({ stage: "Starting analysis…" });
    setEmail(null);
    setEmailRun(null);
    setEmailError(null);
    try {
      const { result, run } = await analyzeTranscript(text, preference, setProgress);
      const record: MeetingRecord = {
        id: newId(),
        title: result.title,
        createdAt: new Date().toISOString(),
        transcript: text,
        result,
        source: run.source,
        latencyMs: run.latencyMs,
        routeNote: run.note,
      };
      setHistory(saveMeeting(record));
      setCurrent(record);
      setCurrentRun(run);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Analysis failed: ${err.message}`
          : "Analysis failed for an unknown reason.",
      );
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const handleDraftEmail = async () => {
    if (!current || !configured || emailLoading) return;
    setEmailError(null);
    setEmailLoading(true);
    try {
      const { draft, run } = await draftFollowUpEmail(current, (p) =>
        setProgress(p),
      );
      setEmail(draft);
      setEmailRun(run);
    } catch (err) {
      setEmailError(
        err instanceof Error ? `Could not draft the email: ${err.message}` : "Could not draft the email.",
      );
    } finally {
      setEmailLoading(false);
      setProgress(null);
    }
  };

  const handleSynthesize = async () => {
    const records = history.filter((m) => selected.has(m.id));
    if (records.length < 2 || !configured || synthesisLoading) return;
    setSynthesisError(null);
    setSynthesisLoading(true);
    try {
      const { synthesis: result, run } = await synthesizeMeetings(records, (p) =>
        setProgress(p),
      );
      setSynthesis(result);
      setSynthesisRun(run);
    } catch (err) {
      setSynthesisError(
        err instanceof Error
          ? `Synthesis failed: ${err.message}`
          : "Synthesis failed for an unknown reason.",
      );
    } finally {
      setSynthesisLoading(false);
      setProgress(null);
    }
  };

  const loadSample = (id: string) => {
    const sample = SAMPLE_TRANSCRIPTS.find((s) => s.id === id);
    if (!sample) return;
    setTranscript(sample.transcript);
    setCurrent(null);
    setCurrentRun(null);
    setEmail(null);
    setEmailRun(null);
    setSynthesis(null);
    setSynthesisRun(null);
    setError(null);
  };

  const openMeeting = (id: string) => {
    const record = history.find((m) => m.id === id);
    if (!record) return;
    setCurrent(record);
    setCurrentRun({
      source: record.source,
      latencyMs: record.latencyMs,
      note: record.routeNote,
    });
    setTranscript(record.transcript);
    setEmail(null);
    setEmailRun(null);
    setSynthesis(null);
    setSynthesisRun(null);
    setError(null);
  };

  const removeMeeting = (id: string) => {
    setHistory(deleteMeeting(id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (current?.id === id) {
      setCurrent(null);
      setCurrentRun(null);
      setEmail(null);
      setEmailRun(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deviceUnavailable =
    deviceStatus === "unavailable" || deviceStatus === "unsupported";

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            MS
          </span>
          <div>
            <h1>Meeting Scribe</h1>
            <p>Turn transcripts into summaries, actions &amp; decisions — on-device when possible, cloud when needed.</p>
          </div>
        </div>
        <div className="status-pills">
          <span className={`pill ${configured ? "pill-ok" : "pill-warn"}`}>
            Firebase: {configured ? "Connected" : "Not configured"}
          </span>
          <span className={`pill ${deviceUnavailable ? "pill-warn" : "pill-ok"}`}>
            On-device model: {deviceStatusLabel(deviceStatus)}
          </span>
        </div>
      </header>

      {!configured && (
        <div className="banner banner-warn" role="alert">
          <strong>Firebase isn&apos;t connected yet.</strong> AI features are
          disabled until the Firebase web config is added to <code>.env</code>.
          Missing: <code>{missingKeys.join(", ") || "configuration values"}</code>.
          See <code>README.md</code> and <code>SUBMISSION.md</code> for the
          setup steps — it takes a few minutes in the Firebase console.
        </div>
      )}

      {configured && deviceUnavailable && (
        <div className="banner banner-info" role="status">
          <strong>On-device inference is unavailable on this device</strong> —
          Chrome reported Gemini Nano as unavailable, so everything will run in
          the cloud with Gemini. That&apos;s exactly what hybrid inference is
          for: the same app, the same results, a different engine.
        </div>
      )}

      <main className="layout">
        <div className="column">
          <section className="card input-card" aria-label="Meeting transcript">
            <h2>Meeting transcript</h2>
            <p className="muted">
              Paste a transcript (or load a sample). Short meetings try Gemini
              Nano on-device first; longer ones go to the cloud.
            </p>
            <textarea
              aria-label="Meeting transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder={"Paste your meeting transcript here…\n\nExample:\nMaya: Let's start sprint planning…"}
              rows={14}
            />
            <div className="input-meta">
              <span>
                {transcript.length.toLocaleString()} characters · ~
                {Math.ceil(transcript.length / 4).toLocaleString()} tokens
              </span>
              <span>{route ? route.reason : "Type or load a sample to see the route."}</span>
            </div>

            <fieldset className="routing">
              <legend>Where should inference run?</legend>
              <div className="segmented" role="group" aria-label="Inference routing">
                {(
                  [
                    ["auto", "Auto"],
                    ["prefer_on_device", "Prefer on-device"],
                    ["prefer_cloud", "Prefer cloud"],
                  ] as [RoutingPreference, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={preference === value ? "is-active" : ""}
                    aria-pressed={preference === value}
                    onClick={() => setPreference(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="muted">
                Auto: up to ~6,000 characters try on-device first, longer
                transcripts go to the cloud. On-device is private, instant and
                free; the cloud handles long documents and deep writing.
              </p>
            </fieldset>

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {progress && (
              <p className="progress" role="status">
                {progress.stage}
                {typeof progress.progress === "number"
                  ? ` ${Math.round(progress.progress * 100)}%`
                  : ""}
              </p>
            )}

            <div className="actions-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAnalyze}
                disabled={!configured || transcript.trim().length === 0 || busy}
              >
                {busy ? "Analyzing…" : "Analyze meeting"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setTranscript("");
                  setCurrent(null);
                  setCurrentRun(null);
                  setEmail(null);
                  setEmailRun(null);
                  setSynthesis(null);
                  setSynthesisRun(null);
                  setError(null);
                }}
              >
                Clear
              </button>
            </div>

            <div className="samples">
              <span className="samples-label">Try a sample:</span>
              {SAMPLE_TRANSCRIPTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="btn btn-sample"
                  onClick={() => loadSample(s.id)}
                  title={s.description}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </section>

          <HistoryPanel
            meetings={history}
            activeId={current?.id ?? null}
            selectedIds={selected}
            synthesisLoading={synthesisLoading}
            onLoad={openMeeting}
            onDelete={removeMeeting}
            onToggleSelect={toggleSelect}
            onSynthesize={handleSynthesize}
          />
          {synthesisError && (
            <p className="error" role="alert">
              {synthesisError}
            </p>
          )}
        </div>

        <div className="column">
          {current && currentRun ? (
            <ResultsPanel
              record={current}
              run={currentRun}
              email={email}
              emailRun={emailRun}
              emailLoading={emailLoading}
              emailError={emailError}
              onDraftEmail={handleDraftEmail}
              onCopyMarkdown={async () => {
                if (await copyText(meetingToMarkdown(current))) {
                  showToast("Copied as Markdown.");
                } else {
                  showToast("Copy failed — select the text manually.");
                }
              }}
              onDownloadMarkdown={() => {
                const slug = current.result.title
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, "")
                  .slice(0, 40);
                downloadText(`${slug || "meeting"}.md`, meetingToMarkdown(current));
              }}
              onCopyEmail={async (body, subject) => {
                if (await copyText(emailToMarkdown({ subject, body }))) {
                  showToast("Email copied.");
                } else {
                  showToast("Copy failed — select the text manually.");
                }
              }}
            />
          ) : (
            <section className="card empty" aria-label="No analysis yet">
              <h2>Your notes will appear here</h2>
              <p>
                Paste a transcript and press <strong>Analyze meeting</strong>.
                You&apos;ll get a summary, a checklist of action items with
                owners and due dates, and the decisions that were made — each
                labeled with the engine that produced it.
              </p>
              <ul className="how">
                <li>
                  <strong>On-device · Gemini Nano</strong> — short transcripts,
                  instant, private, works offline.
                </li>
                <li>
                  <strong>Cloud · Gemini</strong> — long transcripts, follow-up
                  emails, and themes across meetings.
                </li>
                <li>
                  <strong>One SDK, both engines</strong> — every call goes
                  through Firebase AI Logic, which picks the engine and falls
                  back automatically.
                </li>
              </ul>
              <p className="muted">
                <SourceBadge source="unknown" /> badges show what actually ran
                for each request — the app never guesses.
              </p>
            </section>
          )}

          {synthesis && synthesisRun && (
            <SynthesisPanel
              synthesis={synthesis}
              run={synthesisRun}
              meetingTitles={history
                .filter((m) => selected.has(m.id))
                .map((m) => m.result.title)}
              onCopy={async () => {
                if (
                  await copyText(
                    synthesisToMarkdown(
                      synthesis,
                      history
                        .filter((m) => selected.has(m.id))
                        .map((m) => m.result.title),
                    ),
                  )
                ) {
                  showToast("Synthesis copied.");
                }
              }}
              onDownload={() => {
                downloadText(
                  "cross-meeting-synthesis.md",
                  synthesisToMarkdown(
                    synthesis,
                    history
                      .filter((m) => selected.has(m.id))
                      .map((m) => m.result.title),
                  ),
                );
              }}
            />
          )}
        </div>
      </main>

      <footer className="footer">
        <p>
          Built with <strong>Firebase AI Logic</strong> hybrid inference — all
          AI inference runs through the Firebase AI Logic SDK. On-device:
          Gemini Nano (Chrome Prompt API). Cloud: Gemini 2.5 Flash. App Check
          protected; debug tokens accepted for development.
        </p>
        <p className="muted">
          Meeting history is stored only in this browser (localStorage).
          Transcripts sent to the cloud go only to the configured Firebase
          project.
        </p>
      </footer>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
