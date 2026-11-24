import { useEffect, useMemo, useRef, useState } from "react";
import { isFirebaseConfigured, missingConfigKeys } from "./firebase";
import {
  ON_DEVICE_CHAR_LIMIT,
  analyzeTranscript,
  decideRoute,
  draftFollowUpEmail,
  humanizeError,
  probeDeviceModel,
  synthesizeMeetings,
  type HumanError,
  type ProgressUpdate,
} from "./ai/inference";
import { SAMPLE_TRANSCRIPTS } from "./data/samples";
import { DEMO_MEETINGS, DEMO_SYNTHESIS, DEMO_VERSION } from "./data/demo";
import {
  clearDraftTranscript,
  clearSynthesis,
  deleteDone,
  deleteEmailDraft,
  deleteMeeting,
  dismissBanner,
  isBannerDismissed,
  loadDoneMap,
  loadDraftTranscript,
  loadEmailDrafts,
  loadMeetings,
  loadSynthesis,
  newId,
  restoreMeeting,
  saveDone,
  saveDraftTranscript,
  saveEmailDraft,
  saveMeeting,
  saveSynthesis,
  type DoneMap,
  type EmailDraftMap,
} from "./lib/storage";
import {
  downloadText,
  exportAllJson,
  meetingToMarkdown,
  synthesisToMarkdown,
} from "./lib/export";
import type {
  DeviceStatus,
  EmailRecord,
  MeetingRecord,
  RoutingPreference,
  RunInfo,
  SynthesisRecord,
} from "./lib/types";
import { ResultsPanel, type EmailProgress } from "./components/ResultsPanel";
import {
  HistoryPanel,
  SynthesisPanel,
  type SynthesisProgress,
} from "./components/HistoryPanel";
import { SourceBadge } from "./components/SourceBadge";
import { ToastStack, type ToastAction, type ToastItem } from "./components/Toast";
import { ProgressBar } from "./components/ProgressBar";

interface RunProgress {
  stage: string;
  progress?: number;
  startedAt: number;
}

const STORAGE_KEYS = new Set([
  "meeting-scribe:meetings:v1",
  "meeting-scribe:done:v1",
  "meeting-scribe:email-drafts:v1",
  "meeting-scribe:synthesis:v1",
]);

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function scrollToRef(ref: { current: HTMLElement | null }) {
  ref.current?.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
}

const DEMO_VERSION_KEY = "meeting-scribe:demo-version:v1";

/**
 * `?demo=1` loads two demo meetings and a saved synthesis — so a first-time
 * visitor can see the whole app without running an analysis. It never
 * overwrites real data: only `demo-*` meetings (and a demo-only synthesis)
 * are replaced, and only when the stored fixture version is older than the
 * code's. All-or-nothing: the synthesis is only seeded together with its
 * meetings, so it can never come back referencing meetings that no longer
 * exist. Stale per-meeting state (checked todos, email drafts) for replaced
 * demo meetings goes with them, so a re-seeded demo starts clean.
 */
function maybeSeedDemoData() {
  if (
    typeof window === "undefined" ||
    new URLSearchParams(window.location.search).get("demo") !== "1"
  ) {
    return;
  }
  const storedVersion =
    typeof localStorage !== "undefined"
      ? localStorage.getItem(DEMO_VERSION_KEY)
      : null;
  const existing = loadMeetings();
  if (existing.length > 0 && storedVersion === DEMO_VERSION) return;
  existing
    .filter((m) => m.id.startsWith("demo-"))
    .forEach((m) => {
      deleteMeeting(m.id);
      deleteDone(m.id);
      deleteEmailDraft(m.id);
    });
  const storedSynthesis = loadSynthesis();
  if (
    !storedSynthesis ||
    storedSynthesis.meetingIds.every((id) => id.startsWith("demo-"))
  ) {
    saveSynthesis(DEMO_SYNTHESIS);
  }
  [...DEMO_MEETINGS].reverse().forEach((m) => saveMeeting(m));
  try {
    localStorage.setItem(DEMO_VERSION_KEY, DEMO_VERSION);
  } catch {
    // Storage unavailable — the seed still applies in memory this visit.
  }
}

export default function App() {
  const [configured] = useState(() => isFirebaseConfigured());
  const [missingKeys] = useState(() => missingConfigKeys());
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>("checking");
  const [online, setOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );
  const [transcript, setTranscript] = useState(() => loadDraftTranscript());
  const [draftRestored, setDraftRestored] = useState(
    () => loadDraftTranscript().length > 0,
  );
  const [preference, setPreference] = useState<RoutingPreference>("auto");
  const [routeAdvancedOpen, setRouteAdvancedOpen] = useState(false);
  const [current, setCurrent] = useState<MeetingRecord | null>(null);
  const [currentRun, setCurrentRun] = useState<RunInfo | null>(null);
  const [history, setHistory] = useState<MeetingRecord[]>(() => {
    maybeSeedDemoData();
    return loadMeetings();
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [doneMap, setDoneMap] = useState<DoneMap>(() => loadDoneMap());
  const [emailRecords, setEmailRecords] = useState<EmailDraftMap>(() =>
    loadEmailDrafts(),
  );
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<HumanError | null>(null);
  const [emailProgress, setEmailProgress] = useState<EmailProgress | null>(null);
  const [synthesis, setSynthesis] = useState<SynthesisRecord | null>(() => {
    maybeSeedDemoData();
    return loadSynthesis();
  });
  const [synthesisLoading, setSynthesisLoading] = useState(false);
  const [synthesisError, setSynthesisError] = useState<HumanError | null>(null);
  const [synthesisProgress, setSynthesisProgress] =
    useState<SynthesisProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState<RunProgress | null>(null);
  const [error, setError] = useState<HumanError | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set());
  const [deviceBannerDismissed, setDeviceBannerDismissed] = useState(() =>
    isBannerDismissed("device-unavailable"),
  );

  const toastIdRef = useRef(0);
  const analyzeTokenRef = useRef(0);
  const emailTokenRef = useRef(0);
  const synthesisTokenRef = useRef(0);
  const lastSynthesisModeRef = useRef<"selected" | "last3">("selected");
  const prevEmailRef = useRef<EmailRecord | null>(null);
  const pendingDeleteRef = useRef<{
    id: string;
    record: MeetingRecord;
    index: number;
    done: Set<number> | null;
    email: EmailRecord | null;
    synthesis: SynthesisRecord | null;
    wasSelected: boolean;
    timer: number;
  } | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const synthesisRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    probeDeviceModel().then((status) => {
      if (!cancelled) setDeviceStatus(status);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Multi-tab sync: another tab changing stored data reloads it here instead
  // of silently overwriting it later.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || !STORAGE_KEYS.has(e.key)) return;
      if (e.key === "meeting-scribe:meetings:v1") setHistory(loadMeetings());
      if (e.key === "meeting-scribe:done:v1") setDoneMap(loadDoneMap());
      if (e.key === "meeting-scribe:email-drafts:v1") {
        setEmailRecords(loadEmailDrafts());
      }
      if (e.key === "meeting-scribe:synthesis:v1") {
        setSynthesis(loadSynthesis());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Autosave the draft transcript while typing (debounced).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveDraftTranscript(transcript);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [transcript]);

  // Esc closes the routing override first, then the newest toast.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (routeAdvancedOpen) {
        setRouteAdvancedOpen(false);
        return;
      }
      setToasts((prev) => prev.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [routeAdvancedOpen]);

  const pushToast = (message: string, action?: ToastAction, durationMs = 8000) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev.slice(-1), { id, message, action, durationMs }]);
  };

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const route = useMemo(
    () => (transcript.trim() ? decideRoute(transcript, preference) : null),
    [transcript, preference],
  );

  const deviceUnavailable =
    deviceStatus === "unavailable" || deviceStatus === "unsupported";
  const isLong = transcript.trim().length > ON_DEVICE_CHAR_LIMIT;
  const emailRecord = current ? emailRecords[current.id] : undefined;
  const email = emailRecord?.draft ?? null;
  const emailRun = emailRecord?.run ?? null;
  const done = new Set(current ? (doneMap[current.id] ?? []) : []);
  const isMac =
    typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
  const shortcutHint = isMac ? "⌘↵" : "Ctrl+Enter";

  const statusPill = !configured
    ? {
        cls: "pill-warn",
        text: "Service not configured",
        title: "Add your Firebase web config to enable AI features.",
      }
    : !online
      ? {
          cls: "pill-warn",
          text: "Offline · Cloud AI unavailable",
          title: "Check your connection — cloud inference needs it.",
        }
      : deviceStatus === "checking"
        ? { cls: "", text: "Checking…", title: "" }
        : deviceStatus === "downloading"
          ? {
              cls: "pill-ok",
              text: "Downloading on-device model…",
              title: "One-time setup — Cloud AI works right now.",
            }
          : deviceStatus === "available" || deviceStatus === "downloadable"
            ? {
                cls: "pill-ok",
                text: "Ready · On-device & Cloud",
                title: "Short transcripts run on-device, long ones in the cloud.",
              }
            : {
                cls: "pill-ok",
                text: "Cloud AI Ready",
                title:
                  "On-device AI isn't supported in this browser, so Cloud Gemini will be used automatically.",
              };

  const handleAnalyze = async (textArg?: string) => {
    const text = (textArg ?? transcript).trim();
    if (!text || !configured || busy) return;
    setError(null);
    setBusy(true);
    const token = ++analyzeTokenRef.current;
    const startedAt = Date.now();
    setAnalyzeProgress({ stage: "Starting analysis…", startedAt });
    const onProgress = (p: ProgressUpdate) => {
      if (analyzeTokenRef.current === token) {
        setAnalyzeProgress({ stage: p.stage, progress: p.progress, startedAt });
      }
    };
    try {
      const { result, run } = await analyzeTranscript(text, preference, onProgress);
      if (analyzeTokenRef.current !== token) return; // cancelled
      // Updating the same meeting (the user pasted the missing last minutes)
      // keeps its id, so checked-off action items survive the re-run.
      const updating =
        current !== null &&
        (text.startsWith(current.transcript) ||
          current.transcript.startsWith(text));
      const record: MeetingRecord = {
        id: updating ? current.id : newId(),
        title: result.title,
        createdAt: updating ? current.createdAt : new Date().toISOString(),
        transcript: text,
        result,
        source: run.source,
        latencyMs: run.latencyMs,
        routeNote: run.note,
      };
      setHistory(saveMeeting(record));
      setCurrent(record);
      setCurrentRun(run);
      setTranscript(text);
      clearDraftTranscript();
      setDraftRestored(false);
      scrollToRef(resultsRef);
    } catch (err) {
      if (analyzeTokenRef.current !== token) return;
      setError(
        humanizeError(err, {
          onDeviceAvailable: !deviceUnavailable,
          transcriptChars: text.length,
        }),
      );
    } finally {
      if (analyzeTokenRef.current === token) {
        setBusy(false);
        setAnalyzeProgress(null);
      }
    }
  };

  const handleCancelAnalyze = () => {
    analyzeTokenRef.current += 1;
    setBusy(false);
    setAnalyzeProgress(null);
  };

  const runDraftEmail = async () => {
    if (!current || !configured || emailLoading) return;
    setEmailError(null);
    setEmailLoading(true);
    const token = ++emailTokenRef.current;
    const startedAt = Date.now();
    setEmailProgress({ stage: "Drafting follow-up email in the cloud…", startedAt });
    const onProgress = (p: ProgressUpdate) => {
      if (emailTokenRef.current === token) {
        setEmailProgress({ stage: p.stage, progress: p.progress, startedAt });
      }
    };
    try {
      const { draft, run } = await draftFollowUpEmail(current, onProgress);
      if (emailTokenRef.current !== token) return; // cancelled
      setEmailRecords(saveEmailDraft(current.id, { draft, run }));
    } catch (err) {
      if (emailTokenRef.current !== token) return;
      setEmailError(
        humanizeError(err, { onDeviceAvailable: !deviceUnavailable }),
      );
    } finally {
      if (emailTokenRef.current === token) {
        setEmailLoading(false);
        setEmailProgress(null);
      }
    }
  };

  const handleRedraftEmail = async () => {
    if (!current || !emailRecord) return;
    prevEmailRef.current = emailRecord;
    await runDraftEmail();
    if (prevEmailRef.current) {
      const previous = prevEmailRef.current;
      const meetingId = current.id;
      pushToast("Draft regenerated.", {
        label: "Restore previous",
        onAction: () => {
          setEmailRecords(saveEmailDraft(meetingId, previous));
        },
      });
    }
  };

  const handleCancelEmail = () => {
    emailTokenRef.current += 1;
    setEmailLoading(false);
    setEmailProgress(null);
  };

  const handleSynthesize = async (mode: "selected" | "last3") => {
    lastSynthesisModeRef.current = mode;
    const records =
      mode === "last3"
        ? history.slice(0, 3)
        : history.filter((m) => selected.has(m.id));
    if (records.length < 2 || !configured || synthesisLoading) return;
    setSynthesisError(null);
    setSynthesisLoading(true);
    const token = ++synthesisTokenRef.current;
    const startedAt = Date.now();
    setSynthesisProgress({ stage: "Synthesizing across meetings…", startedAt });
    const onProgress = (p: ProgressUpdate) => {
      if (synthesisTokenRef.current === token) {
        setSynthesisProgress({ stage: p.stage, progress: p.progress, startedAt });
      }
    };
    try {
      const { synthesis: result, run } = await synthesizeMeetings(
        records,
        onProgress,
      );
      if (synthesisTokenRef.current !== token) return; // cancelled
      const record: SynthesisRecord = {
        synthesis: result,
        run,
        meetingIds: records.map((r) => r.id),
        createdAt: new Date().toISOString(),
      };
      saveSynthesis(record);
      setSynthesis(record);
      scrollToRef(synthesisRef);
    } catch (err) {
      if (synthesisTokenRef.current !== token) return;
      setSynthesisError(
        humanizeError(err, { onDeviceAvailable: !deviceUnavailable }),
      );
    } finally {
      if (synthesisTokenRef.current === token) {
        setSynthesisLoading(false);
        setSynthesisProgress(null);
      }
    }
  };

  const handleCancelSynthesis = () => {
    synthesisTokenRef.current += 1;
    setSynthesisLoading(false);
    setSynthesisProgress(null);
  };

  const loadSample = (id: string) => {
    const sample = SAMPLE_TRANSCRIPTS.find((s) => s.id === id);
    if (!sample || busy) return;
    const currentText = transcript;
    const isSampleText = SAMPLE_TRANSCRIPTS.some(
      (s) => s.transcript === currentText,
    );
    // Keep the currently viewed meeting in the results pane — loading a
    // sample prepares a new analysis, it doesn't throw the old one away.
    setError(null);
    setTranscript(sample.transcript);
    setDraftRestored(false);
    if (currentText.trim() && !isSampleText) {
      // The user was writing something real — don't throw it away, and don't
      // auto-run over it. The toast offers it back.
      pushToast("Sample loaded — your previous text is saved.", {
        label: "Undo",
        onAction: () => {
          setTranscript(currentText);
          saveDraftTranscript(currentText);
        },
      });
      return;
    }
    void handleAnalyze(sample.transcript);
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
    setError(null);
  };

  const removeMeeting = (id: string) => {
    const index = history.findIndex((m) => m.id === id);
    if (index < 0 || leavingIds.has(id)) return;
    const record = history[index];
    // A synthesis is only honest while every meeting it was built from still
    // exists — deleting one of them retires the synthesis (Undo brings it
    // back, together with the meeting).
    const doomedSynthesis =
      synthesis && synthesis.meetingIds.includes(id) ? synthesis : null;
    const doomed = {
      id,
      record,
      index,
      done: doneMap[id] ? new Set(doneMap[id]) : null,
      email: emailRecords[id] ?? null,
      synthesis: doomedSynthesis,
      wasSelected: selected.has(id),
      timer: 0,
    };
    setLeavingIds((prev) => new Set(prev).add(id));
    doomed.timer = window.setTimeout(() => {
      setHistory(deleteMeeting(id));
      setLeavingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setDoneMap(deleteDone(id));
      setEmailRecords(deleteEmailDraft(id));
      if (doomed.synthesis) {
        clearSynthesis();
        setSynthesis(null);
      }
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (current?.id === id) {
        setCurrent(null);
        setCurrentRun(null);
      }
      pendingDeleteRef.current = null;
    }, 220);
    pendingDeleteRef.current = doomed;
    pushToast("Meeting deleted.", {
      label: "Undo",
      onAction: () => {
        const pending = pendingDeleteRef.current;
        if (pending && pending.id === id) {
          window.clearTimeout(pending.timer);
          pendingDeleteRef.current = null;
          setLeavingIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          return;
        }
        setHistory(restoreMeeting(record, index));
        if (doomed.done) setDoneMap(saveDone(id, doomed.done));
        if (doomed.email) setEmailRecords(saveEmailDraft(id, doomed.email));
        if (doomed.synthesis) {
          saveSynthesis(doomed.synthesis);
          setSynthesis(doomed.synthesis);
        }
        // Undo restores the whole pre-delete state, including whether the
        // meeting was ticked for synthesis — otherwise the restored
        // synthesis claims a meeting that is no longer selected.
        if (doomed.wasSelected) {
          setSelected((prev) => new Set(prev).add(id));
        }
      },
    });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDone = (index: number) => {
    if (!current) return;
    const next = new Set(doneMap[current.id] ?? []);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setDoneMap(saveDone(current.id, next));
  };

  const handleClear = () => {
    if (!transcript) return;
    const old = transcript;
    setTranscript("");
    clearDraftTranscript();
    setDraftRestored(false);
    pushToast("Transcript cleared.", {
      label: "Undo",
      onAction: () => {
        setTranscript(old);
        saveDraftTranscript(old);
      },
    });
  };

  const handleExportJson = () => {
    downloadText(
      "meeting-scribe-export.json",
      exportAllJson(history, synthesis),
    );
    pushToast("Exported all meetings as JSON.", undefined, 4000);
  };

  const handleDismissSynthesis = () => {
    clearSynthesis();
    setSynthesis(null);
  };

  const analyzeDisabledReason = !configured
    ? "Service not configured — add your Firebase config to enable analysis."
    : transcript.trim().length === 0
      ? "Paste or type meeting notes above to start."
      : null;

  const routeLine = !transcript.trim()
    ? "Type or load a sample to see the route."
    : deviceUnavailable
      ? "Cloud · Runs in the cloud"
      : preference === "prefer_on_device"
        ? "Forced on-device · Change"
        : preference === "prefer_cloud"
          ? "Forced cloud · Change"
          : isLong
            ? "Long transcript · Cloud · Change"
            : "On-device first · Change";

  // The sample tooltip must say what will actually happen for that sample
  // on this device — not what would happen on a device with Nano.
  const sampleRouteNote = (text: string) =>
    deviceUnavailable
      ? "Runs in the cloud on this device"
      : text.length > ON_DEVICE_CHAR_LIMIT
        ? "Routes to the cloud in Auto mode (long transcript)"
        : "Routes on-device in Auto mode";

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
          <span className={`pill ${statusPill.cls}`} title={statusPill.title || undefined}>
            {statusPill.text}
          </span>
        </div>
      </header>

      {!configured && (
        <div className="banner banner-warn" role="alert">
          <strong>Firebase isn&apos;t connected yet.</strong> AI features are
          disabled until the Firebase web config is added to <code>.env</code>.
          Missing: <code>{missingKeys.join(", ") || "configuration values"}</code>.
        </div>
      )}

      {configured && deviceStatus === "downloading" && (
        <div className="banner banner-info" role="status">
          <strong>Downloading on-device AI model (one-time setup).</strong>{" "}
          This runs in the background — you can analyze with Cloud AI right
          now.
        </div>
      )}

      {configured && deviceUnavailable && !deviceBannerDismissed && (
        <div className="banner banner-info" role="status">
          <strong>On-device inference is unavailable on this device</strong> —
          everything will run in the cloud with Gemini.
          <button
            type="button"
            className="btn btn-ghost banner-dismiss"
            aria-label="Dismiss"
            onClick={() => {
              dismissBanner("device-unavailable");
              setDeviceBannerDismissed(true);
            }}
          >
            ×
          </button>
        </div>
      )}

      <main className="layout">
        <div className="column">
          <section className="card input-card" aria-label="Meeting transcript">
            <div className="card-head">
              <h2>Meeting transcript</h2>
              <button
                type="button"
                className="link-btn danger"
                onClick={handleClear}
                disabled={!transcript || busy}
                aria-label="Clear transcript"
                title="Clear the transcript — you can undo"
              >
                Clear
              </button>
            </div>
            <p className="muted">
              {deviceUnavailable
                ? "Paste a transcript (or load a sample). On-device inference isn't available in this browser, so everything runs in the cloud with Gemini."
                : "Paste a transcript (or load a sample). Short meetings try Gemini Nano on-device first; longer ones go to the cloud."}
            </p>
            <textarea
              aria-label="Meeting transcript"
              value={transcript}
              autoFocus
              disabled={busy}
              onChange={(e) => setTranscript(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void handleAnalyze();
                }
              }}
              placeholder={"Paste your meeting transcript here…\n\nExample:\nMaya: Let's start sprint planning…"}
              rows={14}
            />
            <div className="input-meta">
              <span>
                {transcript.length.toLocaleString()} characters · ~
                {Math.ceil(transcript.length / 4).toLocaleString()} tokens
              </span>
              <span
                key={`${preference}:${isLong}:${deviceStatus}`}
                className="route-line"
                title={
                  deviceUnavailable
                    ? "On-device AI isn't available in this browser, so everything runs in the cloud."
                    : route?.reason
                }
              >
                {routeLine.includes("Change") ? (
                  <>
                    {routeLine.replace(" · Change", "")}{" "}
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => setRouteAdvancedOpen((v) => !v)}
                      aria-expanded={routeAdvancedOpen}
                    >
                      Change
                    </button>
                  </>
                ) : (
                  routeLine
                )}
              </span>
            </div>

            {routeAdvancedOpen && !deviceUnavailable && (
              <div className="route-advanced">
                <div className="segmented" role="group" aria-label="Inference routing">
                  {(
                    [
                      ["auto", "Auto (Recommended)"],
                      ["prefer_on_device", "Force On-device"],
                      ["prefer_cloud", "Force Cloud"],
                    ] as [RoutingPreference, string][]
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={preference === value ? "is-active" : ""}
                      aria-pressed={preference === value}
                      disabled={
                        value === "prefer_on_device" && deviceUnavailable
                      }
                      onClick={() => setPreference(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {preference === "prefer_on_device" && isLong && (
                  <p className="muted">
                    Transcript too long for local model (max ~6,000 chars) — it
                    will fall back to the cloud.
                  </p>
                )}
              </div>
            )}

            {draftRestored && (
              <p className="draft-note">
                Draft restored from your last visit.{" "}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setTranscript("");
                    clearDraftTranscript();
                    setDraftRestored(false);
                  }}
                >
                  Discard
                </button>
              </p>
            )}

            {error && (
              <div className="error" role="alert">
                <strong>{error.title}.</strong> {error.detail}{" "}
                {error.retryable && (
                  <button
                    type="button"
                    className="btn btn-ghost error-retry"
                    onClick={() => void handleAnalyze()}
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
            {analyzeProgress && (
              <ProgressBar
                stage={analyzeProgress.stage}
                progress={analyzeProgress.progress}
                startedAt={analyzeProgress.startedAt}
                onCancel={handleCancelAnalyze}
              />
            )}

            <div className="actions-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleAnalyze()}
                disabled={!configured || transcript.trim().length === 0 || busy}
              >
                {busy ? "Analyzing…" : "Analyze meeting"}{" "}
                <kbd className="kbd">{shortcutHint}</kbd>
              </button>
            </div>
            {analyzeDisabledReason && !busy && (
              <p className="muted disabled-reason">{analyzeDisabledReason}</p>
            )}

            <div className="samples">
              <span className="samples-label">Try:</span>
              {SAMPLE_TRANSCRIPTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="btn btn-sample"
                  onClick={() => loadSample(s.id)}
                  disabled={busy}
                  title={`${s.title} — ${s.description} ${sampleRouteNote(s.transcript)}`}
                >
                  {s.id === "sprint-planning"
                    ? "Sprint planning"
                    : s.id === "client-onboarding"
                      ? "Client kickoff"
                      : "Incident review"}
                </button>
              ))}
            </div>
          </section>

          <HistoryPanel
            meetings={history}
            activeId={current?.id ?? null}
            selectedIds={selected}
            leavingIds={leavingIds}
            synthesisLoading={synthesisLoading}
            synthesisProgress={synthesisProgress}
            synthesisError={synthesisError}
            onLoad={openMeeting}
            onDelete={removeMeeting}
            onToggleSelect={toggleSelect}
            onSynthesizeSelected={() => void handleSynthesize("selected")}
            onSynthesizeLast3={() => void handleSynthesize("last3")}
            onCancelSynthesis={handleCancelSynthesis}
            onRetrySynthesis={() =>
              void handleSynthesize(lastSynthesisModeRef.current)
            }
            onExportJson={handleExportJson}
          />
        </div>

        <div className="column" ref={resultsRef}>
          {current && currentRun ? (
            <ResultsPanel
              key={current.id}
              record={current}
              run={currentRun}
              done={done}
              onToggleDone={toggleDone}
              email={email}
              emailRun={emailRun}
              emailLoading={emailLoading}
              emailError={emailError}
              emailProgress={emailProgress}
              onDraftEmail={() => void runDraftEmail()}
              onRedraftEmail={() => void handleRedraftEmail()}
              onCancelEmail={handleCancelEmail}
              onRetryEmail={() => void runDraftEmail()}
              onEditEmail={(body) => {
                if (!current || !emailRecord) return;
                setEmailRecords(
                  saveEmailDraft(current.id, {
                    draft: { subject: emailRecord.draft.subject, body },
                    run: emailRecord.run,
                  }),
                );
              }}
              onDownloadMarkdown={() => {
                const slug = current.result.title
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, "")
                  .slice(0, 40);
                downloadText(`${slug || "meeting"}.md`, meetingToMarkdown(current));
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
                {deviceUnavailable ? (
                  <>
                    <li>
                      <strong>Cloud · Gemini</strong> — available now: every
                      transcript runs here in this browser.
                    </li>
                    <li>
                      <strong>On-device · Gemini Nano</strong> — supported
                      when your browser offers it; the app switches
                      automatically, with no cloud round-trip for short
                      transcripts.
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <strong>On-device · Gemini Nano</strong> — short
                      transcripts, private, works offline.
                    </li>
                    <li>
                      <strong>Cloud · Gemini</strong> — long transcripts,
                      follow-up emails, and themes across meetings.
                    </li>
                  </>
                )}
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

          {synthesis && (
            <div ref={synthesisRef}>
              <SynthesisPanel
                key={synthesis.createdAt}
                record={synthesis}
                meetingTitles={history
                  .filter((m) => synthesis.meetingIds.includes(m.id))
                  .map((m) => m.result.title)}
                onDownload={() => {
                  downloadText(
                    "cross-meeting-synthesis.md",
                    synthesisToMarkdown(
                      synthesis.synthesis,
                      history
                        .filter((m) => synthesis.meetingIds.includes(m.id))
                        .map((m) => m.result.title),
                    ),
                  );
                }}
                onDismiss={handleDismissSynthesis}
              />
            </div>
          )}
        </div>
      </main>

      <footer className="footer">
        <p>
          Built with <strong>Firebase AI Logic</strong> hybrid inference — all
          AI inference runs through the Firebase AI Logic SDK. On-device:
          Gemini Nano (Chrome Prompt API). Cloud: Gemini.
        </p>
        <p className="muted">
          Meeting history is stored only in this browser (localStorage).
          Transcripts sent to the cloud go only to the configured Firebase
          project.
        </p>
      </footer>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
