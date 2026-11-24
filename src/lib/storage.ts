import type {
  EmailRecord,
  MeetingRecord,
  SynthesisRecord,
} from "./types";

const MEETINGS_KEY = "meeting-scribe:meetings:v1";
const DRAFT_KEY = "meeting-scribe:draft-transcript:v1";
const DONE_KEY = "meeting-scribe:done:v1";
const EMAIL_KEY = "meeting-scribe:email-drafts:v1";
const SYNTHESIS_KEY = "meeting-scribe:synthesis:v1";
const BANNER_KEY = "meeting-scribe:dismissed-banners:v1";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — the in-memory state still works.
  }
}

function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage errors.
  }
}

/* Meetings */

export function loadMeetings(): MeetingRecord[] {
  const parsed = readJson<unknown>(MEETINGS_KEY, []);
  if (!Array.isArray(parsed)) return [];
  return parsed as MeetingRecord[];
}

function writeMeetings(meetings: MeetingRecord[]): void {
  writeJson(MEETINGS_KEY, meetings);
}

export function saveMeeting(record: MeetingRecord): MeetingRecord[] {
  const all = loadMeetings();
  const next = [record, ...all.filter((m) => m.id !== record.id)];
  writeMeetings(next);
  return next;
}

/** Restore a deleted meeting at its original position (undo). */
export function restoreMeeting(
  record: MeetingRecord,
  index: number,
): MeetingRecord[] {
  const all = loadMeetings().filter((m) => m.id !== record.id);
  const at = Math.max(0, Math.min(index, all.length));
  all.splice(at, 0, record);
  writeMeetings(all);
  return all;
}

export function deleteMeeting(id: string): MeetingRecord[] {
  const next = loadMeetings().filter((m) => m.id !== id);
  writeMeetings(next);
  return next;
}

export function clearMeetings(): void {
  removeKey(MEETINGS_KEY);
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* Draft transcript — autosaved while typing, restored on reload. */

export function loadDraftTranscript(): string {
  return readJson<string>(DRAFT_KEY, "");
}

export function saveDraftTranscript(text: string): void {
  if (text.trim().length === 0) {
    removeKey(DRAFT_KEY);
    return;
  }
  writeJson(DRAFT_KEY, text);
}

export function clearDraftTranscript(): void {
  removeKey(DRAFT_KEY);
}

/* Done action items, per meeting id. */

export type DoneMap = Record<string, number[]>;

export function loadDoneMap(): DoneMap {
  const parsed = readJson<unknown>(DONE_KEY, {});
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  return parsed as DoneMap;
}

export function saveDone(meetingId: string, done: Set<number>): DoneMap {
  const map = loadDoneMap();
  if (done.size === 0) {
    delete map[meetingId];
  } else {
    map[meetingId] = [...done].sort((a, b) => a - b);
  }
  writeJson(DONE_KEY, map);
  return map;
}

export function deleteDone(meetingId: string): DoneMap {
  const map = loadDoneMap();
  delete map[meetingId];
  writeJson(DONE_KEY, map);
  return map;
}

/* Follow-up email drafts, per meeting id. */

export type EmailDraftMap = Record<string, EmailRecord>;

export function loadEmailDrafts(): EmailDraftMap {
  const parsed = readJson<unknown>(EMAIL_KEY, {});
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  return parsed as EmailDraftMap;
}

export function saveEmailDraft(
  meetingId: string,
  record: EmailRecord,
): EmailDraftMap {
  const map = loadEmailDrafts();
  map[meetingId] = record;
  writeJson(EMAIL_KEY, map);
  return map;
}

export function deleteEmailDraft(meetingId: string): EmailDraftMap {
  const map = loadEmailDrafts();
  delete map[meetingId];
  writeJson(EMAIL_KEY, map);
  return map;
}

/* Cross-meeting synthesis — the latest one is kept across reloads. */

export function loadSynthesis(): SynthesisRecord | null {
  return readJson<SynthesisRecord | null>(SYNTHESIS_KEY, null);
}

export function saveSynthesis(record: SynthesisRecord): void {
  writeJson(SYNTHESIS_KEY, record);
}

export function clearSynthesis(): void {
  removeKey(SYNTHESIS_KEY);
}

/* Dismissed info banners, by id — dismissed once, stays dismissed. */

export function isBannerDismissed(id: string): boolean {
  const list = readJson<string[]>(BANNER_KEY, []);
  return Array.isArray(list) && list.includes(id);
}

export function dismissBanner(id: string): void {
  const list = readJson<string[]>(BANNER_KEY, []);
  if (!Array.isArray(list)) return;
  if (!list.includes(id)) {
    list.push(id);
    writeJson(BANNER_KEY, list);
  }
}
