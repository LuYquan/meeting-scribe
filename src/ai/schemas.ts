import { Schema } from "firebase/ai";

/**
 * Structured-output schemas for Meeting Scribe.
 *
 * The same schema object is passed to both inference paths:
 * - cloud: `inCloudParams.generationConfig.responseSchema`
 * - on-device: `onDeviceParams.promptOptions.responseConstraint`
 * so both paths return the same JSON shape. This is the pattern from the
 * Firebase AI Logic hybrid structured-output guide.
 */

export const analysisSchema = Schema.object({
  properties: {
    title: Schema.string(),
    summary: Schema.string(),
    participants: Schema.array({ items: Schema.string() }),
    keyPoints: Schema.array({ items: Schema.string() }),
    actionItems: Schema.array({
      items: Schema.object({
        properties: {
          task: Schema.string(),
          owner: Schema.string(),
          dueDate: Schema.string(),
          priority: Schema.enumString({ enum: ["high", "medium", "low"] }),
        },
        optionalProperties: ["owner", "dueDate", "priority"],
      }),
    }),
    decisions: Schema.array({
      items: Schema.object({
        properties: {
          decision: Schema.string(),
          context: Schema.string(),
        },
        optionalProperties: ["context"],
      }),
    }),
  },
  optionalProperties: ["participants", "keyPoints"],
});

export const emailSchema = Schema.object({
  properties: {
    subject: Schema.string(),
    body: Schema.string(),
  },
});

export const synthesisSchema = Schema.object({
  properties: {
    themes: Schema.array({
      items: Schema.object({
        properties: {
          theme: Schema.string(),
          evidence: Schema.string(),
          meetings: Schema.array({ items: Schema.string() }),
        },
        optionalProperties: ["meetings"],
      }),
    }),
    recurringActions: Schema.array({
      items: Schema.object({
        properties: {
          task: Schema.string(),
          owner: Schema.string(),
          dueDate: Schema.string(),
          priority: Schema.enumString({ enum: ["high", "medium", "low"] }),
        },
        optionalProperties: ["owner", "dueDate", "priority"],
      }),
    }),
    openQuestions: Schema.array({ items: Schema.string() }),
  },
  optionalProperties: ["recurringActions", "openQuestions"],
});
