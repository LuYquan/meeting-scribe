import type { MeetingRecord } from "./types";

const STORAGE_KEY = "meeting-scribe:meetings:v1";

export function loadMeetings(): MeetingRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as MeetingRecord[];
  } catch {
    return [];
  }
}

export function saveMeeting(record: MeetingRecord): MeetingRecord[] {
  const all = loadMeetings();
  const next = [record, ...all.filter((m) => m.id !== record.id)];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or unavailable — the in-memory list still works.
  }
  return next;
}

export function deleteMeeting(id: string): MeetingRecord[] {
  const next = loadMeetings().filter((m) => m.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors.
  }
  return next;
}

export function clearMeetings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
