// Magic's rules for the routing engine: exactly what the engine did before it took rules. Another game gets its own object.
// Changing one means updating reference/engine/routing-engine-spec.md and the tests.
import type { GameRules } from './types';
import { WEIGHTS } from './weights';

export function isBasicLand(typeLine: string): boolean {
  const front = typeLine.split(' // ')[0];
  return /\bBasic\b/.test(front) && /\bLand\b/.test(front);
}

export const MAGIC_RULES: GameRules = {
  weights: WEIGHTS,
  mainSetTypes: new Set(['core', 'expansion', 'draft_innovation', 'masters']),
  // Prints from other product sets (Jumpstart, Duel Decks and the like) often carry their own art, so they rank a little lower.
  ordinarySetTypes: new Set(['core', 'expansion', 'masters']),
  specialSetTypes: new Set(['box', 'masterpiece', 'promo', 'memorabilia', 'funny', 'token']),
  specialSetCodes: new Set(['plst']),
  specialFrames: new Set(['showcase', 'extendedart', 'inverted']),
  commanderSetType: 'commander',
  stopOrder: { set_binder: 0, commander_box: 1, value_binder: 2, display_case: 3, ask_associate: 4 },
  isBasicLand,
};
