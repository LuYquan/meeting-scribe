import type { MeetingRecord, SynthesisRecord } from "../lib/types";
import type { HumanError } from "../ai/inference";
import { formatDay, formatLatency } from "../lib/format";
import { SourceBadge } from "./SourceBadge";
import { CopyButton } from "./CopyButton";
import { ProgressBar } from "./ProgressBar";
import { synthesisToMarkdown } from "../lib/export";

export interface SynthesisProgress {
  stage: string;
  progress?: number;
  startedAt: number;
}

export function HistoryPanel({
  meetings,
  activeId,
  selectedIds,
  leavingIds,
  synthesisLoading,
  synthesisProgress,
  synthesisError,
  onLoad,
  onDelete,
  onToggleSelect,
  onSynthesizeSelected,
  onSynthesizeLast3,
  onCancelSynthesis,
  onRetrySynthesis,
  onExportJson,
}: {
  meetings: MeetingRecord[];
  activeId: string | null;
  selectedIds: Set<string>;
  leavingIds: Set<string>;
  synthesisLoading: boolean;
  synthesisProgress: SynthesisProgress | null;
  synthesisError: HumanError | null;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onSynthesizeSelected: () => void;
  onSynthesizeLast3: () => void;
  onCancelSynthesis: () => void;
  onRetrySynthesis: () => void;
  onExportJson: () => void;
}) {
  // Synthesis needs at least two meetings to exist at all — until then, no
  // checkboxes, no disabled button, nothing to be confused by.
  const canSynthesize = meetings.length >= 2;

  return (
    <section className="card history" aria-label="Meeting history">
      <h2>History</h2>
      {meetings.length === 0 ? (
        <p className="muted">
          Analyzed meetings are saved on this device (localStorage). Nothing is
          uploaded anywhere.
        </p>
      ) : (
        <>
          <p className="muted">
            Saved on this device only.
            {canSynthesize
              ? " Tick two or more meetings to synthesize across them."
              : ""}
          </p>
          <ul className="history-list">
            {meetings.map((m) => (
              <li
                key={m.id}
                className={`${m.id === activeId ? "is-active" : ""} ${
                  selectedIds.has(m.id) ? "is-selected" : ""
                } ${leavingIds.has(m.id) ? "is-leaving" : ""}`}
              >
                <div className="history-row">
                  {canSynthesize && (
                    <label className="history-select">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(m.id)}
                        onChange={() => onToggleSelect(m.id)}
                        aria-label={`Select ${m.result.title} for synthesis`}
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    className="history-open"
                    onClick={() => onLoad(m.id)}
                    title={m.result.title}
                  >
                    <span className="history-title">{m.result.title}</span>
                    <span className="history-meta">
                      {formatDay(m.createdAt)} · {m.result.actionItems.length}{" "}
                      actions
                    </span>
                  </button>
                  <SourceBadge source={m.source} />
                  <button
                    type="button"
                    className="btn btn-ghost btn-danger-ghost"
                    onClick={() => onDelete(m.id)}
                    aria-label={`Delete ${m.result.title}`}
                    title="Delete this meeting — you can undo"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {canSynthesize && (
            <>
              {selectedIds.size > 0 && (
                <p className="muted selection-status" aria-live="polite">
                  {selectedIds.size}{" "}
                  {selectedIds.size === 1 ? "meeting" : "meetings"} selected
                </p>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={onSynthesizeSelected}
                disabled={selectedIds.size < 2 || synthesisLoading}
              >
                {synthesisLoading
                  ? "Synthesizing…"
                  : `Synthesize across ${selectedIds.size} meetings`}
              </button>
              {meetings.length >= 3 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onSynthesizeLast3}
                  disabled={synthesisLoading}
                >
                  Synthesize last 3 meetings
                </button>
              )}
              {selectedIds.size < 2 && !synthesisLoading && (
                <p className="muted">Select at least two meetings to synthesize.</p>
              )}
            </>
          )}
          {synthesisProgress && (
            <ProgressBar
              stage={synthesisProgress.stage}
              progress={synthesisProgress.progress}
              startedAt={synthesisProgress.startedAt}
              onCancel={onCancelSynthesis}
            />
          )}
          {synthesisError && (
            <div className="error" role="alert">
              <strong>{synthesisError.title}.</strong> {synthesisError.detail}{" "}
              {synthesisError.retryable && (
                <button
                  type="button"
                  className="btn btn-ghost error-retry"
                  onClick={onRetrySynthesis}
                >
                  Retry
                </button>
              )}
            </div>
          )}
          <p className="history-foot">
            Stored locally in your browser ·{" "}
            <button type="button" className="link-btn" onClick={onExportJson}>
              Export JSON
            </button>
          </p>
        </>
      )}
    </section>
  );
}

export function SynthesisPanel({
  record,
  meetingTitles,
  onDownload,
  onDismiss,
}: {
  record: SynthesisRecord;
  meetingTitles: string[];
  onDownload: () => void;
  onDismiss: () => void;
}) {
  const { synthesis, run } = record;
  const hasThemes = synthesis.themes.length > 0;
  const hasActions = synthesis.recurringActions.length > 0;
  const hasQuestions = synthesis.openQuestions.length > 0;
  const isEmpty = !hasThemes && !hasActions && !hasQuestions;

  return (
    <section className="card synthesis" aria-label="Cross-meeting synthesis">
      <div className="results-head">
        <div>
          <h2>
            Across {meetingTitles.length} meeting
            {meetingTitles.length === 1 ? "" : "s"}
          </h2>
          <p className="muted">{meetingTitles.join(" · ")}</p>
        </div>
        <div className="results-head-side">
          <SourceBadge source={run.source} latencyMs={run.latencyMs} />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onDismiss}
            aria-label="Dismiss synthesis"
          >
            ×
          </button>
        </div>
      </div>
      <p className="run-note">{run.note}</p>

      {isEmpty && (
        <p className="muted">
          No recurring themes, actions, or open questions across these meetings.
        </p>
      )}

      {hasThemes && (
        <>
          <div className="section-head">
            <h3>Recurring themes</h3>
            <CopyButton
              text={synthesis.themes
                .map((t) => `- ${t.theme}: ${t.evidence}`)
                .join("\n")}
              label="Copy"
            />
          </div>
          {synthesis.themes.map((t, i) => (
            <div key={i} className="theme">
              <strong>{t.theme}</strong>
              <p>{t.evidence}</p>
              {t.meetings.length > 0 && (
                <p className="muted">Seen in: {t.meetings.join(", ")}</p>
              )}
            </div>
          ))}
        </>
      )}

      {hasActions && (
        <>
          <div className="section-head">
            <h3>Recurring action items</h3>
            <CopyButton
              text={synthesis.recurringActions
                .map(
                  (a) => `- [ ] ${a.task}${a.owner ? ` (@${a.owner})` : ""}`,
                )
                .join("\n")}
              label="Copy"
            />
          </div>
          <ul className="points">
            {synthesis.recurringActions.map((a, i) => (
              <li key={i}>
                {a.task}
                {a.owner ? ` — ${a.owner}` : ""}
              </li>
            ))}
          </ul>
        </>
      )}

      {hasQuestions && (
        <>
          <div className="section-head">
            <h3>Open questions</h3>
            <CopyButton
              text={synthesis.openQuestions.map((q) => `- ${q}`).join("\n")}
              label="Copy"
            />
          </div>
          <ul className="points">
            {synthesis.openQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </>
      )}

      <div className="actions-row">
        <CopyButton
          text={synthesisToMarkdown(synthesis, meetingTitles)}
          label="Copy as Markdown"
          copiedLabel="Copied"
          className="btn-secondary"
        />
        <button type="button" className="btn btn-secondary" onClick={onDownload}>
          Download .md
        </button>
      </div>
      <p className="muted synthesis-meta">
        Synthesized in {formatLatency(run.latencyMs)}
      </p>
    </section>
  );
}
