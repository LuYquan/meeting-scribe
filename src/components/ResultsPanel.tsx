import { useState } from "react";
import type { EmailDraft, MeetingRecord, RunInfo } from "../lib/types";
import type { HumanError } from "../ai/inference";
import { formatDateTime } from "../lib/format";
import {
  actionItemsToMarkdown,
  decisionsToMarkdown,
  emailToMarkdown,
  keyPointsToMarkdown,
  meetingToMarkdown,
  participantsToText,
} from "../lib/export";
import { SourceBadge } from "./SourceBadge";
import { CopyButton } from "./CopyButton";
import { ProgressBar } from "./ProgressBar";

export interface EmailProgress {
  stage: string;
  progress?: number;
  startedAt: number;
}

export function ResultsPanel({
  record,
  run,
  done,
  onToggleDone,
  email,
  emailRun,
  emailLoading,
  emailError,
  emailProgress,
  onDraftEmail,
  onRedraftEmail,
  onCancelEmail,
  onRetryEmail,
  onEditEmail,
  onDownloadMarkdown,
}: {
  record: MeetingRecord;
  run: RunInfo;
  done: Set<number>;
  onToggleDone: (index: number) => void;
  email: EmailDraft | null;
  emailRun: RunInfo | null;
  emailLoading: boolean;
  emailError: HumanError | null;
  emailProgress: EmailProgress | null;
  onDraftEmail: () => void;
  onRedraftEmail: () => void;
  onCancelEmail: () => void;
  onRetryEmail: () => void;
  onEditEmail: (body: string) => void;
  onDownloadMarkdown: () => void;
}) {
  // Editable copy of the draft, keyed to the draft object so a new draft
  // resets the edit without an effect.
  const [edited, setEdited] = useState<{ draft: EmailDraft; body: string } | null>(null);
  const r = record.result;
  const emailBody = edited?.draft === email ? edited.body : (email?.body ?? "");

  const mailto = email
    ? `mailto:?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(emailBody)}`
    : "";

  return (
    <section className="card results" aria-label="Analysis results">
      <div className="results-head">
        <div>
          <h2>{r.title}</h2>
          <p className="muted">Analyzed {formatDateTime(record.createdAt)}</p>
        </div>
        <SourceBadge source={run.source} latencyMs={run.latencyMs} />
      </div>

      <p className="run-note">{run.note}</p>

      <div className="section-head">
        <h3>Summary</h3>
        <CopyButton text={r.summary} label="Copy" />
      </div>
      <p className="summary">{r.summary || "No summary was produced."}</p>

      <div className="section-head">
        <h3>
          Action items{" "}
          <span className="count" aria-live="polite">
            {done.size}/{r.actionItems.length} done
          </span>
        </h3>
        {r.actionItems.length > 0 && (
          <CopyButton text={actionItemsToMarkdown(r.actionItems)} label="Copy" />
        )}
      </div>
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
                  onChange={() => onToggleDone(i)}
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

      {r.decisions.length > 0 && (
        <>
          <div className="section-head">
            <h3>Decisions</h3>
            <CopyButton text={decisionsToMarkdown(r.decisions)} label="Copy" />
          </div>
          <ul className="decisions">
            {r.decisions.map((d, i) => (
              <li key={i}>
                <strong>{d.decision}</strong>
                {d.context ? (
                  <span className="decision-context"> — {d.context}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}

      {r.keyPoints.length > 0 && (
        <>
          <div className="section-head">
            <h3>Key points</h3>
            <CopyButton text={keyPointsToMarkdown(r.keyPoints)} label="Copy" />
          </div>
          <ul className="points">
            {r.keyPoints.map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ul>
        </>
      )}

      {r.participants.length > 0 && (
        <>
          <div className="section-head">
            <h3>Participants</h3>
            <CopyButton text={participantsToText(r.participants)} label="Copy" />
          </div>
          <div className="chips">
            {r.participants.map((p) => (
              <span key={p} className="chip">
                {p}
              </span>
            ))}
          </div>
        </>
      )}

      <div className="actions-row">
        <CopyButton
          text={meetingToMarkdown(record)}
          label="Copy as Markdown"
          copiedLabel="Copied"
          className="btn-secondary"
        />
        <button type="button" className="btn btn-secondary" onClick={onDownloadMarkdown}>
          Download .md
        </button>
      </div>

      <div className="email-section">
        <h3>Follow-up email</h3>
        <p className="muted">
          Drafted in the cloud with Gemini — long-form writing is the cloud's job.
        </p>
        {emailProgress && (
          <ProgressBar
            stage={emailProgress.stage}
            progress={emailProgress.progress}
            startedAt={emailProgress.startedAt}
            onCancel={onCancelEmail}
          />
        )}
        {emailError && (
          <div className="error" role="alert">
            <strong>{emailError.title}.</strong> {emailError.detail}{" "}
            {emailError.retryable && (
              <button
                type="button"
                className="btn btn-ghost error-retry"
                onClick={onRetryEmail}
              >
                Retry
              </button>
            )}
          </div>
        )}
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
              value={emailBody}
              onChange={(e) => {
                setEdited({ draft: email, body: e.target.value });
                onEditEmail(e.target.value);
              }}
              rows={10}
            />
            <div className="actions-row">
              <CopyButton
                text={emailToMarkdown({ subject: email.subject, body: emailBody })}
                label="Copy email"
                copiedLabel="Copied"
                className="btn-secondary"
              />
              <a className="btn btn-secondary" href={mailto}>
                Open in Mail App
              </a>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onRedraftEmail}
                disabled={emailLoading}
              >
                Redraft
              </button>
            </div>
          </div>
        ) : (
          !emailLoading && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onDraftEmail}
              disabled={emailLoading}
            >
              Draft follow-up email
            </button>
          )
        )}
      </div>
    </section>
  );
}
