import { useEffect, useRef, useState } from "react";
import { copyText } from "../lib/export";

/**
 * A copy button that answers in place: the label morphs to "Copied" with a
 * check that pops in, then settles back after 1.5 s. The same component is
 * used on every AI-generated section so copying feels identical everywhere.
 */
export function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied",
  className = "",
  onCopied,
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const handleClick = async () => {
    const ok = await copyText(text);
    if (!ok) {
      setFailed(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setFailed(false), 2000);
      return;
    }
    setCopied(true);
    onCopied?.();
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      className={`btn btn-copy ${copied ? "is-copied" : ""} ${failed ? "is-failed" : ""} ${className}`}
      onClick={handleClick}
      aria-live="polite"
    >
      <span key={copied ? "copied" : failed ? "failed" : "copy"} className="copy-label">
        {copied ? (
          <>
            <span className="copy-check" aria-hidden="true">
              ✓
            </span>{" "}
            {copiedLabel}
          </>
        ) : failed ? (
          "Copy failed — select the text manually"
        ) : (
          label
        )}
      </span>
    </button>
  );
}
