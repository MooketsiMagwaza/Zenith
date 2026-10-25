import type { AgentState } from './types';
import { DEFAULT_STATE } from './constants';
import { migratePet } from './pet';
export function migratePopupState(raw: Partial<AgentState> | null) {
  const pet = migratePet(raw?.pet);
  return {
    state: {
      ...structuredClone(DEFAULT_STATE),
      ...(raw ?? {}),
      pet: pet.value,
      petReadOnly: !!pet.error,
    } as AgentState,
    petError: pet.error,
    unreadablePet: pet.original,
  };
}
