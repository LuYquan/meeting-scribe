import { useState } from "react";
import type { EmailDraft, MeetingRecord, RunInfo } from "../lib/types";
import { SourceBadge } from "./SourceBadge";

export function ResultsPanel({
  record,
  run,
  email,
  emailRun,
  emailLoading,
  emailError,
  onDraftEmail,
  onCopyMarkdown,
  onDownloadMarkdown,
  onCopyEmail,
}: {
  record: MeetingRecord;
  run: RunInfo;
  email: EmailDraft | null;
  emailRun: RunInfo | null;
  emailLoading: boolean;
  emailError: string | null;
  onDraftEmail: () => void;
  onCopyMarkdown: () => void;
  onDownloadMarkdown: () => void;
  onCopyEmail: (body: string, subject: string) => void;
}) {
  const [done, setDone] = useState<Set<number>>(new Set());
  // Editable copy of the draft, keyed to the draft object so a new draft
  // resets the edit without an effect.
  const [edited, setEdited] = useState<{ draft: EmailDraft; body: string } | null>(null);
  const r = record.result;

  const toggleDone = (i: number) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <section className="card results" aria-label="Analysis results">
      <div className="results-head">
        <div>
          <h2>{r.title}</h2>
          <p className="muted">
            Analyzed {new Date(record.createdAt).toLocaleString()}
          </p>
        </div>
        <SourceBadge source={run.source} latencyMs={run.latencyMs} />
      </div>

      <p className="run-note">{run.note}</p>

      <h3>Summary</h3>
      <p className="summary">{r.summary || "No summary was produced."}</p>

      {r.participants.length > 0 && (
        <>
          <h3>Participants</h3>
          <div className="chips">
            {r.participants.map((p) => (
              <span key={p} className="chip">
                {p}
              </span>
            ))}
          </div>
        </>
      )}

      {r.keyPoints.length > 0 && (
        <>
          <h3>Key points</h3>
          <ul className="points">
            {r.keyPoints.map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ul>
        </>
      )}

      <h3>
        Action items{" "}
        <span className="count">
          {done.size}/{r.actionItems.length} done
        </span>
      </h3>
      {r.actionItems.length === 0 ? (
        <p className="muted">No action items were found in this transcript.</p>
      ) : (
        <ul className="actions">
          {r.actionItems.map((a, i) => (
            <li key={i} className={done.has(i) ? "is-done" : ""}>
              <label>
                <input
                  type="checkbox"
                  checked={done.has(i)}
                  onChange={() => toggleDone(i)}
                />
                <span className="action-task">{a.task}</span>
              </label>
              <span className="action-meta">
                {a.owner ? <span className="owner">{a.owner}</span> : null}
                {a.dueDate ? <span className="due">due {a.dueDate}</span> : null}
                {a.priority ? (
                  <span className={`priority priority-${a.priority}`}>{a.priority}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h3>Decisions</h3>
      {r.decisions.length === 0 ? (
        <p className="muted">No decisions were recorded in this transcript.</p>
      ) : (
        <ul className="decisions">
          {r.decisions.map((d, i) => (
            <li key={i}>
              <strong>{d.decision}</strong>
              {d.context ? <span className="decision-context"> — {d.context}</span> : null}
            </li>
          ))}
        </ul>
      )}

      <div className="actions-row">
        <button type="button" className="btn btn-secondary" onClick={onCopyMarkdown}>
          Copy as Markdown
        </button>
        <button type="button" className="btn btn-secondary" onClick={onDownloadMarkdown}>
          Download .md
        </button>
      </div>

      <div className="email-section">
        <h3>Follow-up email</h3>
        <p className="muted">
          Drafted in the cloud with Gemini — long-form writing is the cloud's job.
        </p>
        {emailError && <p className="error">{emailError}</p>}
        {email ? (
          <div className="email-draft">
            <div className="email-head">
              <strong>Subject:</strong> {email.subject}
              {emailRun && (
                <SourceBadge source={emailRun.source} latencyMs={emailRun.latencyMs} />
              )}
            </div>
            <textarea
              aria-label="Follow-up email draft (editable)"
              value={edited?.draft === email ? edited.body : email.body}
              onChange={(e) => setEdited({ draft: email, body: e.target.value })}
              rows={10}
            />
            <div className="actions-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  onCopyEmail(
                    edited?.draft === email ? edited.body : email.body,
                    email.subject,
                  )
                }
              >
                Copy email
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onDraftEmail}
            disabled={emailLoading}
          >
            {emailLoading ? "Drafting…" : "Draft follow-up email"}
          </button>
        )}
      </div>
    </section>
  );
}
