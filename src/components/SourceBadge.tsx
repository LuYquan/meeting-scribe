import type { InferenceSource } from "../lib/types";
import { formatLatency } from "../lib/format";

export function SourceBadge({
  source,
  latencyMs,
}: {
  source: InferenceSource;
  latencyMs?: number;
}) {
  if (source === "on_device") {
    return (
      <span className="badge badge-device" title="Inference ran on this device with Gemini Nano">
        <span className="badge-dot" /> On-device · Gemini Nano
        {latencyMs !== undefined ? <span className="badge-latency">{formatLatency(latencyMs)}</span> : null}
      </span>
    );
  }
  if (source === "in_cloud") {
    return (
      <span className="badge badge-cloud" title="Inference ran in the cloud with Gemini">
        <span className="badge-dot" /> Cloud · Gemini
        {latencyMs !== undefined ? <span className="badge-latency">{formatLatency(latencyMs)}</span> : null}
      </span>
    );
  }
  return (
    <span className="badge badge-unknown" title="The SDK did not report where inference ran">
      <span className="badge-dot" /> Firebase AI Logic
      {latencyMs !== undefined ? <span className="badge-latency">{formatLatency(latencyMs)}</span> : null}
    </span>
  );
}
