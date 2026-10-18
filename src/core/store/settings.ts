// The player's store settings: binder groups, sets the store does not carry, basic lands and the worth-a-pull rule.
// They apply to every trip for now (saved stores come in v2). Pure: every change returns new settings.
import { DEFAULT_PULL_SETTINGS, V1_STORE } from '../engine/engine';
import type { BinderGroup, PullSettings, StoreProfile } from '../engine/engine';

export interface StoreSettings {
  binderGroups: BinderGroup[];
  notCarried: string[];          // set codes, lowercase
  includeBasicLands: boolean;
  pull: PullSettings;
}

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  binderGroups: [], notCarried: [], includeBasicLands: false, pull: DEFAULT_PULL_SETTINGS,
};

// The profile the routing engine runs with: the fixed v1 store plus what the player set.
export const storeProfile = (settings: StoreSettings): StoreProfile => ({
  ...V1_STORE,
  binderGroups: settings.binderGroups,
  notCarried: settings.notCarried,
  includeBasicLands: settings.includeBasicLands,
});

const code = (setCode: string): string => setCode.trim().toLowerCase();
const without = (codes: readonly string[], c: string): string[] => codes.filter(x => x !== c);

// A set lives in one place: one group, or Not carried. Moving it takes it out of wherever it was.
function detach(settings: StoreSettings, c: string): StoreSettings {
  return {
    ...settings,
    binderGroups: settings.binderGroups.map(g => (g.setCodes.includes(c) ? { ...g, setCodes: without(g.setCodes, c) } : g)),
    notCarried: without(settings.notCarried, c),
  };
}

export const cleanGroupName = (name: string): string => name.replace(/\s+/g, ' ').trim();

export function addGroup(settings: StoreSettings, id: string, name: string, setCodes: readonly string[] = []): StoreSettings {
  let next = settings;
  const codes = [...new Set(setCodes.map(code))];
  for (const c of codes) next = detach(next, c);
  return { ...next, binderGroups: [...next.binderGroups, { id, name: cleanGroupName(name), setCodes: codes }] };
}

export const renameGroup = (settings: StoreSettings, id: string, name: string): StoreSettings => ({
  ...settings, binderGroups: settings.binderGroups.map(g => (g.id === id ? { ...g, name: cleanGroupName(name) } : g)),
});

// Deleting a group frees its sets: each counts as its own binder again.
export const deleteGroup = (settings: StoreSettings, id: string): StoreSettings => ({
  ...settings, binderGroups: settings.binderGroups.filter(g => g.id !== id),
});

export function addSetToGroup(settings: StoreSettings, groupId: string, setCode: string): StoreSettings {
  if (!settings.binderGroups.some(g => g.id === groupId)) return settings;
  const c = code(setCode);
  const next = detach(settings, c);
  return { ...next, binderGroups: next.binderGroups.map(g => (g.id === groupId ? { ...g, setCodes: [...g.setCodes, c] } : g)) };
}

export const removeSetFromGroup = (settings: StoreSettings, groupId: string, setCode: string): StoreSettings => ({
  ...settings,
  binderGroups: settings.binderGroups.map(g => (g.id === groupId ? { ...g, setCodes: without(g.setCodes, code(setCode)) } : g)),
});

export function markNotCarried(settings: StoreSettings, setCode: string): StoreSettings {
  const c = code(setCode);
  const next = detach(settings, c);
  return { ...next, notCarried: [...next.notCarried, c] };
}

export const unmarkNotCarried = (settings: StoreSettings, setCode: string): StoreSettings => ({
  ...settings, notCarried: without(settings.notCarried, code(setCode)),
});

// Where a set is now: a group id, 'not_carried', or null for a set with no group.
export function placeOfSet(settings: StoreSettings, setCode: string): string | 'not_carried' | null {
  const c = code(setCode);
  if (settings.notCarried.includes(c)) return 'not_carried';
  return settings.binderGroups.find(g => g.setCodes.includes(c))?.id ?? null;
}

export const setIncludeBasicLands = (settings: StoreSettings, on: boolean): StoreSettings => ({ ...settings, includeBasicLands: on });

export const MIN_CARDS_FLOOR = 1;
export const MAX_CARDS_CEILING = 99;
export const MAX_USD_CEILING = 999;

// The worth-a-pull rule: at least N cards OR at least $X. Values are kept to whole numbers inside sensible limits.
export function setPullRule(settings: StoreSettings, rule: Partial<PullSettings>): StoreSettings {
  const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, Math.round(n)));
  return {
    ...settings,
    pull: {
      worthPullMinCards: rule.worthPullMinCards === undefined ? settings.pull.worthPullMinCards : clamp(rule.worthPullMinCards, MIN_CARDS_FLOOR, MAX_CARDS_CEILING),
      worthPullMinUsd: rule.worthPullMinUsd === undefined ? settings.pull.worthPullMinUsd : clamp(rule.worthPullMinUsd, 0, MAX_USD_CEILING),
    },
  };
}

export const resetPull = (settings: StoreSettings): StoreSettings => ({ ...settings, pull: DEFAULT_PULL_SETTINGS });

export const isPullDefault = (settings: StoreSettings): boolean =>
  settings.pull.worthPullMinCards === DEFAULT_PULL_SETTINGS.worthPullMinCards && settings.pull.worthPullMinUsd === DEFAULT_PULL_SETTINGS.worthPullMinUsd
  && !settings.includeBasicLands;
