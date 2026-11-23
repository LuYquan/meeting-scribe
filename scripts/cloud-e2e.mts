/**
 * Cloud end-to-end smoke test for Meeting Scribe.
 *
 * Uses the app's REAL code paths: the same prompt builders, response schemas
 * and parsers as src/ai/inference.ts, and the same hybrid model construction
 * (getGenerativeModel with PREFER_IN_CLOUD + gemini-2.5-flash) — only the
 * transport differs: this runs in Node instead of a browser, because no
 * headless browser is available on this machine. Config is read from .env
 * (never hardcoded, never committed).
 *
 * Run: node --experimental-strip-types scripts/cloud-e2e.mts
 * Exit 0 = all three cloud features returned real output.
 * Any App Check error is printed verbatim and aborts the run.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initializeApp } from "firebase/app";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
} from "firebase/ai";
import { SAMPLE_TRANSCRIPTS } from "../src/data/samples.ts";
import { analysisSchema, emailSchema, synthesisSchema } from "../src/ai/schemas.ts";
import {
  buildAnalysisPrompt,
  buildEmailPrompt,
  buildSynthesisPrompt,
} from "../src/ai/prompts.ts";
import {
  normalizeInferenceSource,
  parseAnalysis,
  parseEmail,
  parseSynthesis,
} from "../src/ai/parsing.ts";
// NOTE: we deliberately do NOT import src/ai/inference.ts here — it imports
// "../firebase" extensionless, which Vite resolves but Node cannot. The route
// decision below mirrors decideRoute(transcript, "auto") in inference.ts.
import { estimateTokens } from "../src/ai/parsing.ts";

const CLOUD_MODEL = "gemini-2.5-flash";
const ON_DEVICE_CHAR_LIMIT = 6000;

function decideRoute(transcript: string): { mode: InferenceMode; reason: string } {
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

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envText = readFileSync(join(root, ".env"), "utf8");
const env: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});
const ai = getAI(app, { backend: new GoogleAIBackend() });

function fail(step: string, err: unknown): never {
  console.error(`\n❌ FAILED at ${step}`);
  if (err instanceof Error) {
    console.error("error name:", err.name);
    console.error("error message:", err.message);
    console.error("error stack:", err.stack?.split("\n").slice(0, 6).join("\n"));
  } else {
    console.error("error:", JSON.stringify(err, null, 2));
  }
  process.exit(1);
}

function cloudModel(schema: unknown) {
  return getGenerativeModel(ai, {
    mode: InferenceMode.PREFER_IN_CLOUD,
    inCloudParams: {
      model: CLOUD_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema as never,
      },
    },
    onDeviceParams: { promptOptions: { responseConstraint: schema as never } },
  });
}

const incident = SAMPLE_TRANSCRIPTS.find((s) => s.id === "incident-review");
if (!incident) fail("setup", new Error("incident-review sample not found"));
console.log(`Sample: ${incident.title}`);
console.log(`Transcript length: ${incident.transcript.length} chars`);
const route = decideRoute(incident.transcript, "auto");
console.log(`Route decision: mode=${route.mode} reason="${route.reason}"`);
if (route.mode !== InferenceMode.PREFER_IN_CLOUD) {
  fail("routing", new Error(`expected PREFER_IN_CLOUD, got ${route.mode}`));
}

// 1) Analysis (cloud)
let analysis;
try {
  const model = cloudModel(analysisSchema);
  const t0 = performance.now();
  const res = await model.generateContent(buildAnalysisPrompt(incident.transcript));
  const latencyMs = Math.round(performance.now() - t0);
  const source = normalizeInferenceSource(res.response.inferenceSource);
  analysis = parseAnalysis(res.response.text());
  console.log(`\n[1] Analysis — source=${source} latency=${latencyMs}ms`);
  console.log(`title: ${analysis.title}`);
  console.log(`summary: ${analysis.summary}`);
  console.log(`participants: ${analysis.participants.join(", ")}`);
  console.log(`action items (${analysis.actionItems.length}):`);
  for (const a of analysis.actionItems) {
    console.log(`  - ${a.task} | owner=${a.owner ?? "-"} due=${a.dueDate ?? "-"} prio=${a.priority ?? "-"}`);
  }
  console.log(`decisions (${analysis.decisions.length}):`);
  for (const d of analysis.decisions) console.log(`  - ${d.decision}`);
  if (!analysis.summary || analysis.actionItems.length === 0) {
    fail("analysis", new Error("empty summary or no action items"));
  }
} catch (err) {
  fail("analysis (cloud generateContent)", err);
}

// 2) Follow-up email draft (cloud)
let email;
try {
  const model = cloudModel(emailSchema);
  const t0 = performance.now();
  const res = await model.generateContent(
    buildEmailPrompt(
      analysis.title,
      analysis.summary,
      analysis.actionItems,
      analysis.decisions,
      analysis.participants,
    ),
  );
  const latencyMs = Math.round(performance.now() - t0);
  const source = normalizeInferenceSource(res.response.inferenceSource);
  email = parseEmail(res.response.text());
  console.log(`\n[2] Follow-up email — source=${source} latency=${latencyMs}ms`);
  console.log(`subject: ${email.subject}`);
  console.log(`body (first 400 chars): ${email.body.slice(0, 400)}`);
  if (!email.subject || !email.body) fail("email", new Error("empty subject or body"));
} catch (err) {
  fail("email draft (cloud generateContent)", err);
}

// 3) Cross-meeting synthesis (cloud) — analyze the other two samples first,
//    then synthesize across all three meetings.
try {
  const others = SAMPLE_TRANSCRIPTS.filter((s) => s.id !== "incident-review");
  const records = [{ title: analysis.title, summary: analysis.summary,
    actionItems: analysis.actionItems.map((a) => `${a.task}${a.owner ? ` (${a.owner})` : ""}`),
    decisions: analysis.decisions.map((d) => d.decision) }];
  for (const s of others) {
    const model = cloudModel(analysisSchema);
    const res = await model.generateContent(buildAnalysisPrompt(s.transcript));
    const a = parseAnalysis(res.response.text());
    records.push({ title: a.title, summary: a.summary,
      actionItems: a.actionItems.map((x) => `${x.task}${x.owner ? ` (${x.owner})` : ""}`),
      decisions: a.decisions.map((d) => d.decision) });
    console.log(`\n[3a] Analyzed "${a.title}" (${s.transcript.length} chars) for synthesis input`);
  }
  const model = cloudModel(synthesisSchema);
  const t0 = performance.now();
  const res = await model.generateContent(buildSynthesisPrompt(records));
  const latencyMs = Math.round(performance.now() - t0);
  const source = normalizeInferenceSource(res.response.inferenceSource);
  const synthesis = parseSynthesis(res.response.text());
  console.log(`\n[3b] Cross-meeting synthesis — source=${source} latency=${latencyMs}ms`);
  console.log(`themes: ${synthesis.themes.join(" | ")}`);
  console.log(`open items (${synthesis.openItems.length}):`);
  for (const o of synthesis.openItems) console.log(`  - ${o}`);
  console.log(`summary: ${synthesis.summary}`);
  if (!synthesis.summary || synthesis.openItems.length === 0) {
    fail("synthesis", new Error("empty synthesis summary or no open items"));
  }
} catch (err) {
  fail("synthesis (cloud generateContent)", err);
}

console.log("\n✅ CLOUD E2E PASSED: analysis + email draft + cross-meeting synthesis all returned real cloud output.");
