/**
 * Prompt templates for Meeting Scribe.
 *
 * Keep prompts short and explicit: the on-device model (Gemini Nano) has a
 * 9,216-token context window, so prompts must leave room for the transcript
 * and the JSON answer.
 */

export function buildAnalysisPrompt(transcript: string): string {
  return [
    "You are Meeting Scribe, an assistant that turns meeting transcripts into structured notes.",
    "Read the transcript below and extract:",
    "1. A short title for the meeting (max 8 words).",
    "2. A 2-4 sentence summary of what was discussed and concluded.",
    "3. The participants, by first name only.",
    "4. Up to 6 key points.",
    "5. Every action item: the task, the owner (first name, if stated), a due date (as written, e.g. 'Friday' or 'Nov 28'; leave empty if not stated), and a priority (high/medium/low).",
    "6. Every decision that was made, with one line of context each.",
    "Only use information stated in the transcript. Do not invent owners, dates, or decisions.",
    "Reply with JSON only, matching the provided schema.",
    "",
    "--- TRANSCRIPT ---",
    transcript,
  ].join("\n");
}

export function buildEmailPrompt(
  title: string,
  summary: string,
  actionItems: { task: string; owner?: string; dueDate?: string }[],
  decisions: { decision: string }[],
  participants: string[],
): string {
  const items = actionItems
    .map(
      (a) =>
        `- ${a.task}${a.owner ? ` (owner: ${a.owner})` : ""}${a.dueDate ? ` — due ${a.dueDate}` : ""}`,
    )
    .join("\n");
  const decs = decisions.map((d) => `- ${d.decision}`).join("\n");
  return [
    "You are Meeting Scribe. Write a concise follow-up email for the meeting below.",
    "The email should: thank the participants, restate the decisions, and list the action items with owners and due dates.",
    "Tone: professional, warm, to the point. Keep the body under 200 words.",
    "Reply with JSON only, matching the provided schema (subject + body).",
    "",
    `Meeting: ${title}`,
    `Participants: ${participants.join(", ") || "not listed"}`,
    `Summary: ${summary}`,
    "Decisions:",
    decs || "- none recorded",
    "Action items:",
    items || "- none recorded",
  ].join("\n");
}

export function buildSynthesisPrompt(
  meetings: { title: string; summary: string; actionItems: string[]; decisions: string[] }[],
): string {
  const blocks = meetings
    .map(
      (m, i) =>
        [
          `### Meeting ${i + 1}: ${m.title}`,
          `Summary: ${m.summary}`,
          `Action items: ${m.actionItems.join("; ") || "none"}`,
          `Decisions: ${m.decisions.join("; ") || "none"}`,
        ].join("\n"),
    )
    .join("\n\n");
  return [
    "You are Meeting Scribe. The following notes come from several meetings of the same team.",
    "Find the themes that keep coming up across meetings, the action items that recur or stay open, and the questions that are still unanswered.",
    "For each theme, quote the concrete evidence in one sentence and name the meetings it appears in.",
    "Only use information stated in the notes. Do not invent items.",
    "Reply with JSON only, matching the provided schema.",
    "",
    blocks,
  ].join("\n");
}
