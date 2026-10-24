// Engine knobs. Changing a number here never needs a component edit.
// Changing weights, cutoffs or routing rules also means updating reference/engine/routing-engine-spec.md and the tests.
import type { Weights } from './types';

export const WEIGHTS: Weights = {
  base: { display_case: 0.85, commander_box: 0.65, set_binder: 0.75, value_binder: 0.6, bulk: 0.55 } ,
  rarity: { common: 1, uncommon: 1, rare: 0.9, mythic: 0.8, special: 0.6, bonus: 0.6 } ,
  finish: { nonfoil: 1, foil: 0.7, etched: 0.5 } ,
  special: 0.5, frame: 0.7, unknownPrice: 0.8, altProduct: 0.96,
  ageFloor: 0.6, ageSpanYears: 7.5, priceFitExp: 0.25, priceFloor: 0.01,
  nearTie: 0.1,
};
