import type { MeetingRecord, SynthesisRecord } from "../lib/types";
import { SAMPLE_TRANSCRIPTS } from "./samples";

/**
 * Bump this whenever the demo fixture changes. Opening `?demo=1` with an
 * older stored version replaces the stale demo meetings with the current
 * fixture — otherwise a returning visitor keeps seeing the old fixture
 * (wrong badge, one-line transcript) even after the code moved on, because
 * the seed only ran when the history was empty.
 */
export const DEMO_VERSION = "v2";

/**
 * Demo data, loaded only when the app is opened with `?demo=1` and the
 * history is empty. It exists so a first-time visitor (or a judge) can see
 * the full app — history, results, synthesis — without running an analysis
 * first. Nothing here is ever sent anywhere; it is plain local content.
 *
 * Integrity rules (learned from GPT's review, 2026-11-24):
 * - The demo transcripts ARE the full sample transcripts, so every person,
 *   date, estimate and decision in the results is supported by the visible
 *   input. Never ship a one-line excerpt next to full results.
 * - Both demo meetings ran in the cloud: on-device inference is unavailable
 *   in the browsers this demo is opened in, and showing an on-device badge
 *   there would contradict the app's own banner. The badge must always
 *   reflect what actually ran, including in fixtures.
 */
export const DEMO_MEETINGS: MeetingRecord[] = [
  {
    id: "demo-meeting-1",
    title: "Sprint Planning — Atlas Mobile App",
    createdAt: "2026-11-24T09:30:00.000Z",
    transcript: SAMPLE_TRANSCRIPTS.find((s) => s.id === "sprint-planning")!
      .transcript,
    result: {
      title: "Sprint Planning — Atlas Mobile App",
      summary:
        "The team planned Sprint 14 (two weeks, ending Nov 28), committing to offline mode (7 pts), onboarding (3 pts), and the settings redesign (5 pts) for 15 points total.",
      participants: ["Maya", "Jordan", "Priya", "Sam"],
      keyPoints: [
        "Offline mode is 7 points total; Priya adds last-write-wins with a warning banner.",
        "Notification permission moves to step three of onboarding to protect opt-in rates.",
        "Android 12 camera crash fixed in build 2.4.1.",
      ],
      actionItems: [
        {
          task: "Build offline mode and onboarding",
          owner: "Jordan",
          dueDate: "Nov 28",
          priority: "high",
        },
        {
          task: "Deliver settings API endpoints",
          owner: "Priya",
          dueDate: "Nov 26",
          priority: "high",
        },
        {
          task: "Deliver final settings mockups",
          owner: "Sam",
          dueDate: "Nov 25",
          priority: "medium",
        },
        {
          task: "Send the sprint summary to the team",
          owner: "Maya",
          dueDate: "Nov 24",
          priority: "low",
        },
      ],
      decisions: [
        {
          decision: "Notification permission moves to step three of onboarding",
          context: "Asking after the user has seen value protects opt-in rates.",
        },
        {
          decision: "Commit 15 points for Sprint 14",
          context: "Offline mode 7, onboarding 3, settings redesign 5.",
        },
      ],
    },
    source: "in_cloud",
    latencyMs: 2430,
    routeNote: "Ran in the cloud with Gemini via Firebase AI Logic.",
  },
  {
    id: "demo-meeting-2",
    title: "Client Onboarding Kickoff — Northwind Retail",
    createdAt: "2026-11-23T15:00:00.000Z",
    transcript: SAMPLE_TRANSCRIPTS.find((s) => s.id === "client-onboarding")!
      .transcript,
    result: {
      title: "Client Onboarding Kickoff — Northwind Retail",
      summary:
        "Northwind agreed to a two-store pilot (downtown and Riverside) from December 1, rolling out to all twelve stores by December 15 if the stock-count error rate drops under 5%.",
      participants: ["Maya", "Jordan", "Priya", "Daniel", "Sofia"],
      keyPoints: [
        "Two-store pilot first, then full rollout by December 15.",
        "Nightly CSV export at 2 a.m. covers product data for phase one.",
      ],
      actionItems: [
        {
          task: "Send the sample product CSV",
          owner: "Sofia",
          dueDate: "Nov 28",
          priority: "high",
        },
        {
          task: "Build the CSV import",
          owner: "Priya",
          dueDate: "Dec 3",
          priority: "medium",
        },
      ],
      decisions: [
        {
          decision: "Launch with CSV import for product data",
          context: "A live API integration comes in phase two.",
        },
      ],
    },
    source: "in_cloud",
    latencyMs: 8430,
    routeNote: "Ran in the cloud with Gemini via Firebase AI Logic.",
  },
];

export const DEMO_SYNTHESIS: SynthesisRecord = {
  synthesis: {
    themes: [
      {
        theme: "Offline-first delivery",
        evidence:
          "Both meetings committed to offline-capable builds before the holiday rush.",
        meetings: [
          "Sprint Planning — Atlas Mobile App",
          "Client Onboarding Kickoff — Northwind Retail",
        ],
      },
    ],
    recurringActions: [{ task: "Ship offline-capable build", owner: "Jordan" }],
    openQuestions: ["Do we need a shared sync-conflict policy across teams?"],
  },
  run: {
    source: "in_cloud",
    latencyMs: 5210,
    note: "Ran in the cloud with Gemini via Firebase AI Logic.",
  },
  meetingIds: ["demo-meeting-1", "demo-meeting-2"],
  createdAt: "2026-11-24T10:00:00.000Z",
};
