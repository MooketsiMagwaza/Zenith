import { z } from 'zod';
import type { AgentState } from './types';
export const PET_KINDS = [
  'book',
  'skill',
  'project',
  'study',
  'practice',
  'workout',
  'other',
] as const;
export type PetKind = (typeof PET_KINDS)[number];
export const PET_PHRASES: Record<PetKind, string> = {
  book: 'Time to read {title}',
  skill: 'Time to practise {title}',
  project: 'Time for {title}',
  study: 'Time to study {title}',
  practice: 'Time to practise {title}',
  workout: 'Time for {title}',
  other: 'Time for {title}',
};
export const PetSchema = z
  .object({
    version: z.literal(1),
    enabled: z.boolean().default(false),
    messages: z.boolean().default(false),
    celebrations: z.boolean().default(false),
    nudges: z.boolean().default(false),
    reducedMotion: z.boolean().default(false),
    phrases: z.record(z.enum(PET_KINDS), z.string().max(500)).default({}),
    cards: z
      .record(
        z
          .object({
            kind: z.enum(PET_KINDS).default('other'),
            phrase: z.string().max(500).optional(),
          })
          .passthrough(),
      )
      .default({}),
    interactions: z
      .object({
        opens: z.number().int().nonnegative().default(0),
        drags: z.number().int().nonnegative().default(0),
      })
      .passthrough()
      .default({}),
    breakUntil: z.number().finite().nullable().default(null),
    celebrateUntil: z.number().finite().nullable().default(null),
    nudgeUntil: z.number().finite().nullable().default(null),
    lastMessage: z.string().max(10000).default(''),
  })
  .passthrough();
export type PetState = z.infer<typeof PetSchema>;
export type PetPreferences = Pick<
  PetState,
  'enabled' | 'messages' | 'celebrations' | 'nudges' | 'reducedMotion' | 'phrases' | 'cards'
>;
export const DEFAULT_PET = PetSchema.parse({ version: 1 });
export function migratePet(raw: unknown) {
  try {
    return { value: PetSchema.parse(raw ?? { version: 1 }), error: '', original: undefined };
  } catch {
    return {
      value: structuredClone(DEFAULT_PET),
      error: 'The saved pet settings are newer or unreadable. They have been preserved.',
      original: raw,
    };
  }
}
export function petPhrase(title: string, taskId: string | undefined, pet: PetState) {
  const card = taskId ? pet.cards[taskId] : undefined,
    kind = card?.kind ?? 'other';
  const template = card?.phrase?.trim() || pet.phrases[kind]?.trim() || PET_PHRASES[kind];
  return template.includes('{title}')
    ? template.split('{title}').join(title.trim())
    : `${template} ${title.trim()}`;
}
export type PetReaction = 'idle' | 'focusing' | 'break' | 'celebrating' | 'nudging';
export function petReaction(state: Pick<AgentState, 'active' | 'pet'>, now: number): PetReaction {
  if (
    state.active?.startedAt !== null &&
    state.active?.startedAt !== undefined &&
    state.active.taskIds.length
  )
    return 'focusing';
  if (state.pet.breakUntil !== null && state.pet.breakUntil > now) return 'break';
  if (state.pet.nudges && state.pet.nudgeUntil !== null && state.pet.nudgeUntil > now)
    return 'nudging';
  if (state.pet.celebrations && state.pet.celebrateUntil !== null && state.pet.celebrateUntil > now)
    return 'celebrating';
  return 'idle';
}
export function petSpeech(state: AgentState, now: number) {
  if (!state.pet.messages) return '';
  const reaction = petReaction(state, now),
    task = state.tasks.find((t) => t.id === state.active?.taskIds[0]);
  if (reaction === 'focusing') return `Focusing on ${task?.name ?? 'your card'}.`;
  if (reaction === 'break') return 'Time for a break.';
  if (reaction === 'celebrating') return 'Time well spent.';
  if (reaction === 'nudging') return state.pet.lastMessage;
  return 'Ready when you are.';
}
