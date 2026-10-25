import type { Features } from './features';
export const CARD_KINDS = ['book', 'skill', 'project', 'study', 'practice', 'workout', 'other'] as const;
export type CardKind = typeof CARD_KINDS[number];
export const DEFAULT_PHRASES: Record<CardKind, string> = {
  book: 'Time to read {title}', skill: 'Time to practise {title}', project: 'Time for {title}',
  study: 'Time to study {title}', practice: 'Time to practise {title}', workout: 'Time for {title}', other: 'Time for {title}',
};
/** Literal replacement, with no evaluation or markup. Titles are always included. */
export function buildPhrase(title: string, kind: CardKind = 'other', phrases: Partial<Record<CardKind, string>> = {}, override?: string) {
  const template = override?.trim() || phrases[kind]?.trim() || DEFAULT_PHRASES[kind];
  return template.includes('{title}') ? template.split('{title}').join(title.trim()) : `${template} ${title.trim()}`;
}
export function companionMessage(title: string, taskId: string | undefined, features: Features) {
  const card = taskId ? features.companion.cards[taskId] : undefined;
  return buildPhrase(title, card?.kind, features.companion.phrases, card?.phrase);
}
