import type {
  ActionItem,
  AnalysisResult,
  Decision,
  EmailDraft,
  InferenceSource,
  SynthesisResult,
} from "../lib/types";

/**
 * Pure helpers for turning model text into typed results.
 * No Firebase imports here, so this module can be unit-tested in plain Node.
 */

/** Extract the first {...} JSON object from model text, tolerating fences/prose. */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall through to substring extraction.
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response did not contain a JSON object.");
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function asPriority(value: unknown): ActionItem["priority"] {
  if (value === "high" || value === "medium" || value === "low") return value;
  return undefined;
}

function asActionItems(value: unknown): ActionItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v) => ({
      task: asString(v.task),
      owner: asString(v.owner) || undefined,
      dueDate: asString(v.dueDate) || undefined,
      priority: asPriority(v.priority),
    }))
    .filter((a) => a.task.length > 0);
}

function asDecisions(value: unknown): Decision[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v) => ({
      decision: asString(v.decision),
      context: asString(v.context) || undefined,
    }))
    .filter((d) => d.decision.length > 0);
}

export function parseAnalysis(text: string): AnalysisResult {
  const data = extractJsonObject(text) as Record<string, unknown>;
  return {
    title: asString(data.title) || "Untitled meeting",
    summary: asString(data.summary),
    participants: asStringArray(data.participants),
    keyPoints: asStringArray(data.keyPoints),
    actionItems: asActionItems(data.actionItems),
    decisions: asDecisions(data.decisions),
  };
}

export function parseEmail(text: string): EmailDraft {
  const data = extractJsonObject(text) as Record<string, unknown>;
  return {
    subject: asString(data.subject) || "Meeting follow-up",
    body: asString(data.body),
  };
}

export function parseSynthesis(text: string): SynthesisResult {
  const data = extractJsonObject(text) as Record<string, unknown>;
  const themes = Array.isArray(data.themes)
    ? data.themes
        .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
        .map((v) => ({
          theme: asString(v.theme),
          evidence: asString(v.evidence),
          meetings: asStringArray(v.meetings),
        }))
        .filter((t) => t.theme.length > 0)
    : [];
  return {
    themes,
    recurringActions: asActionItems(data.recurringActions),
    openQuestions: asStringArray(data.openQuestions),
  };
}

/**
 * Normalize the SDK's `inferenceSource` value.
 * The SDK reports "on_device" / "in_cloud" (see @firebase/ai typings);
 * anything else is reported as "unknown" rather than guessed.
 */
export function normalizeInferenceSource(value: unknown): InferenceSource {
  if (value === "on_device") return "on_device";
  if (value === "in_cloud") return "in_cloud";
  return "unknown";
}

/** Rough token estimate used only for routing (chars / 4). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
