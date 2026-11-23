import {
  getGenerativeModel,
  InferenceMode,
  type GenerativeModel,
  type Schema,
} from "firebase/ai";
import { getAIService } from "../firebase";
import type {
  AnalysisResult,
  DeviceStatus,
  EmailDraft,
  InferenceSource,
  MeetingRecord,
  RoutingPreference,
  RunInfo,
  SynthesisResult,
} from "../lib/types";
import { analysisSchema, emailSchema, synthesisSchema } from "./schemas";
import { buildAnalysisPrompt, buildEmailPrompt, buildSynthesisPrompt } from "./prompts";
import {
  estimateTokens,
  normalizeInferenceSource,
  parseAnalysis,
  parseEmail,
  parseSynthesis,
} from "./parsing";

/**
 * All AI inference in Meeting Scribe goes through Firebase AI Logic
 * (`firebase/ai`). There are no other model API calls anywhere in the app.
 *
 * Routing:
 * - Auto: short transcripts try Gemini Nano on-device first (PREFER_ON_DEVICE,
 *   SDK falls back to cloud when Nano is missing); long transcripts go
 *   straight to the cloud (PREFER_IN_CLOUD) because Nano's context is
 *   9,216 tokens.
 * - Prefer on-device: PREFER_ON_DEVICE. Prefer cloud: PREFER_IN_CLOUD.
 * The response's `inferenceSource` tells the UI what actually ran — the app
 * never assumes, it reports.
 */

export const CLOUD_MODEL = "gemini-2.5-flash";
/** Auto-routing threshold: transcripts up to this length try on-device first. */
export const ON_DEVICE_CHAR_LIMIT = 6000;

export interface RouteDecision {
  mode: InferenceMode;
  reason: string;
}

export function decideRoute(
  transcript: string,
  preference: RoutingPreference,
): RouteDecision {
  if (preference === "prefer_on_device") {
    return {
      mode: InferenceMode.PREFER_ON_DEVICE,
      reason: "You asked to prefer on-device. Trying Gemini Nano first, cloud as fallback.",
    };
  }
  if (preference === "prefer_cloud") {
    return {
      mode: InferenceMode.PREFER_IN_CLOUD,
      reason: "You asked to prefer the cloud. Running on Gemini in the cloud.",
    };
  }
  if (transcript.length <= ON_DEVICE_CHAR_LIMIT) {
    return {
      mode: InferenceMode.PREFER_ON_DEVICE,
      reason: `Short transcript (~${estimateTokens(transcript)} tokens) — trying Gemini Nano on-device first, cloud as fallback.`,
    };
  }
  return {
    mode: InferenceMode.PREFER_IN_CLOUD,
    reason: `Long transcript (~${estimateTokens(transcript)} tokens) — sent to Gemini in the cloud; on-device context is 9,216 tokens.`,
  };
}

type LanguageModelApi = {
  availability: () => Promise<"available" | "downloading" | "downloadable" | "unavailable">;
};

/**
 * Probe the Chrome Prompt API (Gemini Nano) availability for display only.
 * This is a capability check, not inference — the SDK makes its own
 * decision at request time.
 */
export async function probeDeviceModel(): Promise<DeviceStatus> {
  const lm = (globalThis as unknown as { LanguageModel?: LanguageModelApi })
    .LanguageModel;
  if (!lm || typeof lm.availability !== "function") return "unsupported";
  try {
    const status = await lm.availability();
    if (status === "available") return "available";
    if (status === "downloading") return "downloading";
    if (status === "downloadable") return "downloadable";
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

export function deviceStatusLabel(status: DeviceStatus): string {
  switch (status) {
    case "checking":
      return "Checking…";
    case "available":
      return "Available";
    case "downloading":
      return "Downloading…";
    case "downloadable":
      return "Ready to download";
    case "unavailable":
      return "Unavailable on this device";
    case "unsupported":
      return "Not supported by this browser";
  }
}

function createHybridModel(mode: InferenceMode, schema: Schema | null): GenerativeModel {
  const ai = getAIService();
  if (schema) {
    return getGenerativeModel(ai, {
      mode,
      inCloudParams: {
        model: CLOUD_MODEL,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      },
      onDeviceParams: {
        promptOptions: { responseConstraint: schema },
      },
    });
  }
  return getGenerativeModel(ai, {
    mode,
    inCloudParams: { model: CLOUD_MODEL },
  });
}

function describeRun(
  mode: InferenceMode,
  source: InferenceSource,
  deviceNote: string | null,
): string {
  const parts: string[] = [];
  if (source === "on_device") {
    parts.push("Ran on-device with Gemini Nano — the transcript never left your device.");
  } else if (source === "in_cloud") {
    if (mode === InferenceMode.PREFER_ON_DEVICE) {
      parts.push(
        "On-device inference wasn't available, so this ran in the cloud with Gemini (Firebase AI Logic fallback).",
      );
    } else {
      parts.push("Ran in the cloud with Gemini via Firebase AI Logic.");
    }
  } else {
    parts.push("Ran via Firebase AI Logic (inference source not reported by the SDK).");
  }
  if (deviceNote) parts.push(deviceNote);
  return parts.join(" ");
}

export interface ProgressUpdate {
  stage: string;
  progress?: number;
}

export async function analyzeTranscript(
  transcript: string,
  preference: RoutingPreference,
  onProgress?: (update: ProgressUpdate) => void,
): Promise<{ result: AnalysisResult; run: RunInfo }> {
  const route = decideRoute(transcript, preference);
  const model = createHybridModel(route.mode, analysisSchema);

  let deviceNote: string | null = null;
  if (
    route.mode === InferenceMode.PREFER_ON_DEVICE ||
    route.mode === InferenceMode.ONLY_ON_DEVICE
  ) {
    onProgress?.({ stage: "Preparing on-device model…" });
    try {
      await model.initializeDeviceModel((p) =>
        onProgress?.({ stage: "Downloading on-device model…", progress: p }),
      );
    } catch (err) {
      // PREFER_ON_DEVICE falls back to the cloud automatically; never fail
      // the whole analysis because Nano is missing.
      deviceNote = `On-device model could not be prepared (${err instanceof Error ? err.message : "unknown error"}).`;
      onProgress?.({ stage: "On-device model unavailable — using cloud fallback…" });
    }
  }

  onProgress?.({ stage: "Analyzing transcript…" });
  const started = performance.now();
  const response = await model.generateContent(buildAnalysisPrompt(transcript));
  const latencyMs = Math.round(performance.now() - started);

  const source = normalizeInferenceSource(response.response.inferenceSource);
  const result = parseAnalysis(response.response.text());
  return {
    result,
    run: {
      source,
      latencyMs,
      note: describeRun(route.mode, source, deviceNote),
    },
  };
}

export async function draftFollowUpEmail(
  record: MeetingRecord,
  onProgress?: (update: ProgressUpdate) => void,
): Promise<{ draft: EmailDraft; run: RunInfo }> {
  // Follow-up emails are a cloud feature: long-form writing, full context.
  // PREFER_IN_CLOUD still falls back to on-device when offline.
  const mode = InferenceMode.PREFER_IN_CLOUD;
  const model = createHybridModel(mode, emailSchema);
  onProgress?.({ stage: "Drafting follow-up email in the cloud…" });
  const started = performance.now();
  const response = await model.generateContent(
    buildEmailPrompt(
      record.result.title,
      record.result.summary,
      record.result.actionItems,
      record.result.decisions,
      record.result.participants,
    ),
  );
  const latencyMs = Math.round(performance.now() - started);
  const source = normalizeInferenceSource(response.response.inferenceSource);
  return {
    draft: parseEmail(response.response.text()),
    run: {
      source,
      latencyMs,
      note: describeRun(mode, source, null),
    },
  };
}

export async function synthesizeMeetings(
  records: MeetingRecord[],
  onProgress?: (update: ProgressUpdate) => void,
): Promise<{ synthesis: SynthesisResult; run: RunInfo }> {
  const mode = InferenceMode.PREFER_IN_CLOUD;
  const model = createHybridModel(mode, synthesisSchema);
  onProgress?.({ stage: "Synthesizing across meetings in the cloud…" });
  const started = performance.now();
  const response = await model.generateContent(
    buildSynthesisPrompt(
      records.map((r) => ({
        title: r.result.title,
        summary: r.result.summary,
        actionItems: r.result.actionItems.map(
          (a) => `${a.task}${a.owner ? ` (${a.owner})` : ""}`,
        ),
        decisions: r.result.decisions.map((d) => d.decision),
      })),
    ),
  );
  const latencyMs = Math.round(performance.now() - started);
  const source = normalizeInferenceSource(response.response.inferenceSource);
  return {
    synthesis: parseSynthesis(response.response.text()),
    run: {
      source,
      latencyMs,
      note: describeRun(mode, source, null),
    },
  };
}
