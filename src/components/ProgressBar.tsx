import { useEffect, useState } from "react";

/**
 * Progress that stays next to the action that started it: a stage line, an
 * elapsed clock, a bar (determinate when the backend reports a fraction,
 * indeterminate otherwise), and a Cancel button for long runs. Cancelling
 * stops the UI immediately; a late response is discarded by the caller.
 */
export function ProgressBar({
  stage,
  progress,
  startedAt,
  onCancel,
}: {
  stage: string;
  progress?: number;
  startedAt: number;
  onCancel?: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const tick = () =>
      setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const determinate = typeof progress === "number";
  const pct = determinate
    ? Math.max(0, Math.min(100, Math.round(progress * 100)))
    : null;

  return (
    <div className="progress-block" role="status">
      <div className="progress-line">
        <span className="progress-stage">
          {stage}
          {pct !== null ? ` ${pct}%` : ""}
        </span>
        <span className="progress-elapsed">{elapsed}s</span>
        {onCancel && (
          <button type="button" className="btn btn-ghost progress-cancel" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
      <div className="progress-track" aria-hidden="true">
        <div
          className={`progress-fill ${determinate ? "" : "is-indeterminate"}`}
          style={determinate ? { width: `${pct}%` } : undefined}
        />
      </div>
    </div>
  );
}
