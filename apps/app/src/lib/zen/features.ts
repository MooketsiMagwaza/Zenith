import { z } from "zod";
import { CARD_KINDS } from './companion';

export const GoalSchema = z.object({ period: z.enum(["day", "week", "total"]), seconds: z.number().positive().finite() }).passthrough();
export type Goal = z.infer<typeof GoalSchema>;
export const FeatureSchema = z.object({
  version: z.literal(1),
  progress: z.boolean().default(false),
  goals: z.record(GoalSchema).default({}),
  companion: z.object({
    enabled: z.boolean().default(false),
    phrases: z.record(z.enum(CARD_KINDS), z.string().max(500)).default({}),
    cards: z.record(z.object({ kind: z.enum(CARD_KINDS).default('other'), phrase: z.string().max(500).optional() }).passthrough()).default({}),
  }).passthrough().default({}),
  rewards: z.object({
    recap: z.boolean().default(false), affirmations: z.boolean().default(false), milestones: z.boolean().default(false),
    pack: z.array(z.string().trim().min(1).max(500)).max(100).default(['You made room for what matters.', 'A little time, given with intention.', 'This is enough for today.']),
    seen: z.record(z.boolean()).default({}),
  }).passthrough().default({}),
  pomodoro: z.object({
    enabled:z.boolean().default(false), focusMinutes:z.number().int().min(1).max(240).default(25),
    breakMinutes:z.number().int().min(1).max(120).default(5), longBreakMinutes:z.number().int().min(1).max(120).default(15),
    autoStart:z.boolean().default(false),
  }).passthrough().default({}),
}).passthrough();
export type Features = z.infer<typeof FeatureSchema>;
export const FEATURE_KEY = "zenith.features.v1";

/** Additive migration: old keys and entity shapes remain readable and untouched. */
export function migrateFeatures(raw: unknown): Features {
  if (raw == null) return FeatureSchema.parse({ version: 1 });
  return FeatureSchema.parse(raw);
}
