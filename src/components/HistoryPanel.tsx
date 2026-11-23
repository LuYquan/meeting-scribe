import type { MeetingRecord, RunInfo, SynthesisResult } from "../lib/types";
import { SourceBadge } from "./SourceBadge";

export function HistoryPanel({
  meetings,
  activeId,
  selectedIds,
  synthesisLoading,
  onLoad,
  onDelete,
  onToggleSelect,
  onSynthesize,
}: {
  meetings: MeetingRecord[];
  activeId: string | null;
  selectedIds: Set<string>;
  synthesisLoading: boolean;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onSynthesize: () => void;
}) {
  if (meetings.length === 0) {
    return (
      <section className="card history" aria-label="Meeting history">
        <h2>History</h2>
        <p className="muted">
          Analyzed meetings are saved on this device (localStorage). Nothing is
          uploaded anywhere.
        </p>
      </section>
    );
  }
  return (
    <section className="card history" aria-label="Meeting history">
      <h2>History</h2>
      <p className="muted">
        Saved on this device only. Tick two or more meetings to synthesize
        across them.
      </p>
      <ul className="history-list">
        {meetings.map((m) => (
          <li key={m.id} className={m.id === activeId ? "is-active" : ""}>
            <label className="history-select">
              <input
                type="checkbox"
                checked={selectedIds.has(m.id)}
                onChange={() => onToggleSelect(m.id)}
                aria-label={`Select ${m.result.title} for synthesis`}
              />
            </label>
            <button type="button" className="history-open" onClick={() => onLoad(m.id)}>
              <span className="history-title">{m.result.title}</span>
              <span className="history-meta">
                {new Date(m.createdAt).toLocaleDateString()} · {m.result.actionItems.length}{" "}
                actions · {m.latencyMs} ms
              </span>
            </button>
            <SourceBadge source={m.source} />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onDelete(m.id)}
              aria-label={`Delete ${m.result.title}`}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn btn-primary"
        onClick={onSynthesize}
        disabled={selectedIds.size < 2 || synthesisLoading}
      >
        {synthesisLoading
          ? "Synthesizing…"
          : `Synthesize across ${selectedIds.size} meetings`}
      </button>
      {selectedIds.size < 2 && (
        <p className="muted">Select at least two meetings to synthesize.</p>
      )}
    </section>
  );
}

export function SynthesisPanel({
  synthesis,
  run,
  meetingTitles,
  onCopy,
  onDownload,
}: {
  synthesis: SynthesisResult;
  run: RunInfo;
  meetingTitles: string[];
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <section className="card synthesis" aria-label="Cross-meeting synthesis">
      <div className="results-head">
        <div>
          <h2>Across {meetingTitles.length} meetings</h2>
          <p className="muted">{meetingTitles.join(" · ")}</p>
        </div>
        <SourceBadge source={run.source} latencyMs={run.latencyMs} />
      </div>
      <p className="run-note">{run.note}</p>

      <h3>Recurring themes</h3>
      {synthesis.themes.length === 0 ? (
        <p className="muted">No recurring themes found.</p>
      ) : (
        synthesis.themes.map((t, i) => (
          <div key={i} className="theme">
            <strong>{t.theme}</strong>
            <p>{t.evidence}</p>
            {t.meetings.length > 0 && (
              <p className="muted">Seen in: {t.meetings.join(", ")}</p>
            )}
          </div>
        ))
      )}

      <h3>Recurring action items</h3>
      {synthesis.recurringActions.length === 0 ? (
        <p className="muted">No recurring action items.</p>
      ) : (
        <ul className="points">
          {synthesis.recurringActions.map((a, i) => (
            <li key={i}>
              {a.task}
              {a.owner ? ` — ${a.owner}` : ""}
            </li>
          ))}
        </ul>
      )}

      <h3>Open questions</h3>
      {synthesis.openQuestions.length === 0 ? (
        <p className="muted">No open questions.</p>
      ) : (
        <ul className="points">
          {synthesis.openQuestions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      )}

      <div className="actions-row">
        <button type="button" className="btn btn-secondary" onClick={onCopy}>
          Copy as Markdown
        </button>
        <button type="button" className="btn btn-secondary" onClick={onDownload}>
          Download .md
        </button>
      </div>
    </section>
  );
}
