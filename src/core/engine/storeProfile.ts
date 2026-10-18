// The one fixed v1 store profile. It becomes per-store toggles in v2.
// Changing a cutoff here also means updating reference/engine/routing-engine-spec.md and the tests.
import type { StoreProfile } from './types';

export const V1_STORE: StoreProfile = {
  usesDisplayCase: true, displayCaseMin: 15,
  hasCommanderSection: true,
  usesSetBinders: true, setBinderMaxAgeYears: 3,
  usesValueBinders: false, valueBinderMin: 5,
  binderGroups: [], notCarried: [],
  includeBasicLands: false, acceptFinishes: ['nonfoil', 'foil', 'etched'],
};
