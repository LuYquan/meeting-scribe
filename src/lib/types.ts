export type InferenceSource = "on_device" | "in_cloud" | "unknown";

export type RoutingPreference = "auto" | "prefer_on_device" | "prefer_cloud";

export type DeviceStatus =
  | "checking"
  | "available"
  | "downloading"
  | "downloadable"
  | "unavailable"
  | "unsupported";

export interface ActionItem {
  task: string;
  owner?: string;
  dueDate?: string;
  priority?: "high" | "medium" | "low";
}

export interface Decision {
  decision: string;
  context?: string;
}

export interface AnalysisResult {
  title: string;
  summary: string;
  participants: string[];
  keyPoints: string[];
  actionItems: ActionItem[];
  decisions: Decision[];
}

export interface EmailDraft {
  subject: string;
  body: string;
}

/** A saved follow-up email: the draft plus the run that produced it. */
export interface EmailRecord {
  draft: EmailDraft;
  run: RunInfo;
}

export interface SynthesisTheme {
  theme: string;
  evidence: string;
  meetings: string[];
}

export interface SynthesisResult {
  themes: SynthesisTheme[];
  recurringActions: ActionItem[];
  openQuestions: string[];
}

export interface MeetingRecord {
  id: string;
  title: string;
  createdAt: string;
  transcript: string;
  result: AnalysisResult;
  source: InferenceSource;
  latencyMs: number;
  routeNote: string;
}

export interface RunInfo {
  source: InferenceSource;
  latencyMs: number;
  /** Human-readable note, e.g. what was tried and what actually ran. */
  note: string;
}

/** A cross-meeting synthesis, kept across reloads like a meeting. */
export interface SynthesisRecord {
  synthesis: SynthesisResult;
  run: RunInfo;
  meetingIds: string[];
  createdAt: string;
}
