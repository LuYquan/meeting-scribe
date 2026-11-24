import { useEffect, useRef, useState } from "react";

export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastItem {
  id: number;
  message: string;
  action?: ToastAction;
  /** How long the toast stays up. Defaults to 8 s for undoable actions. */
  durationMs?: number;
}

/**
 * Toasts stack (at most two) at the bottom of the screen. A toast with an
 * action — usually Undo — pauses its countdown while the pointer hovers over
 * it or keyboard focus lands on it, so nobody loses the chance to undo.
 */
export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <Toast key={t.id} item={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  const [exiting, setExiting] = useState(false);
  const remainingRef = useRef(item.durationMs ?? 8000);
  const startedRef = useRef(0);

  useEffect(() => {
    if (paused || exiting) return;
    startedRef.current = Date.now();
    const timer = window.setTimeout(() => {
      setExiting(true);
      window.setTimeout(onDismiss, 180);
    }, remainingRef.current);
    return () => {
      remainingRef.current = Math.max(
        0,
        remainingRef.current - (Date.now() - startedRef.current),
      );
      window.clearTimeout(timer);
    };
  }, [paused, exiting, onDismiss]);

  const dismissNow = () => {
    setExiting(true);
    window.setTimeout(onDismiss, 180);
  };

  return (
    <div
      className={`toast ${exiting ? "is-exiting" : ""}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="toast-message">{item.message}</span>
      {item.action && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            item.action?.onAction();
            dismissNow();
          }}
        >
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        className="toast-close"
        aria-label="Dismiss notification"
        onClick={dismissNow}
      >
        ×
      </button>
    </div>
  );
}
