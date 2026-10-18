// Test helpers for screens: dated lists made from a short description. Not imported by app code.
import type { CardStatus } from '../core/status';
import { addEntries, createList, setEntryStatus } from '../core/lists';
import type { CardList } from '../core/lists';

export const T0 = new Date('2026-10-17T12:00:00');
export const daysAgo = (n: number) => new Date(T0.getTime() - n * 24 * 3600 * 1000);

export type Spec = {
  id: string;
  name: string;
  kind?: 'deck' | 'wishlist';
  created?: Date;
  updated?: Date;
  on?: boolean;
  cards?: [name: string, quantity?: number, status?: CardStatus][];
};

// A card's key is its lower-cased name, as the temporary paste box makes it.
export function makeList(spec: Spec): CardList {
  const created = spec.created ?? T0;
  let list = createList({ id: spec.id, kind: spec.kind ?? 'deck', name: spec.name }, created);
  for (const [name, quantity = 1, status = 'needed'] of spec.cards ?? []) {
    list = addEntries(list, [{ cardKey: name.toLowerCase(), name, quantity }], created).list;
    if (status !== 'needed') list = setEntryStatus(list, name.toLowerCase(), status, created);
  }
  return { ...list, updatedAt: (spec.updated ?? created).toISOString(), inNextDive: spec.on ?? true };
}
