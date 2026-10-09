import { z } from "zod";

export const GoalSchema = z.object({ period: z.enum(["day", "week", "total"]), seconds: z.number().positive().finite() });
export type Goal = z.infer<typeof GoalSchema>;
export const FeatureSchema = z.object({
  version: z.literal(1),
  progress: z.boolean().default(false),
  goals: z.record(GoalSchema).default({}),
});
export type Features = z.infer<typeof FeatureSchema>;
export const FEATURE_KEY = "zenith.features.v1";

/** Additive migration: old keys and entity shapes remain readable and untouched. */
export function migrateFeatures(raw: unknown): Features {
  if (raw == null) return FeatureSchema.parse({ version: 1 });
  return FeatureSchema.parse(raw);
}
