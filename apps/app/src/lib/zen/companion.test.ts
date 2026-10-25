import { expect, it } from 'vitest';
import { buildPhrase, companionMessage, CARD_KINDS } from './companion';
import { migrateFeatures } from './features';
it('builds book, skill and all other card phrases in plain language', () => {
  expect(buildPhrase('The Great Gatsby','book')).toBe('Time to read The Great Gatsby');
  expect(buildPhrase('guitar','skill')).toBe('Time to practise guitar');
  for (const kind of CARD_KINDS) expect(buildPhrase('Sample title',kind)).toContain('Sample title');
});
it('treats titles literally and includes titles in personal phrases', () => {
  expect(buildPhrase('$& {title}','book',{},'Read {title}')).toBe('Read $& {title}');
  expect(buildPhrase('Gatsby','book',{},'A little reading:')).toBe('A little reading: Gatsby');
});
it('adds companion defaults without touching old goals and rejects future versions', () => {
  const old = {version:1, progress:true, goals:{'task:a':{period:'total',seconds:3600}}};
  const before = structuredClone(old), migrated = migrateFeatures(old);
  expect(old).toEqual(before); expect(migrated.goals).toEqual(old.goals);
  expect(migrated.companion.enabled).toBe(false);
  expect(companionMessage('Sample',undefined,migrated)).toBe('Time for Sample');
  expect(() => migrateFeatures({version:2})).toThrow();
});
