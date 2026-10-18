// Bulk list operations: many cards at once. Pure, like the rest of src/core/lists; `now` is passed in.
// Each returns the list it was given when nothing changed, so "Updated" only moves when something did.
import type { CardStatus } from '../status';
import { addEntries } from './lists';
import type { CardList, IncomingEntry, ListEntry } from './types';

const keySet = (keys: Iterable<string>): ReadonlySet<string> => (keys instanceof Set ? keys : new Set(keys));

// Sets the status of every listed card that is on the list. Cards that already have it are left alone.
// (Only Needed cards count toward the dive, so a card that leaves Needed drops out of the plan on its own.)
export function setEntriesStatus(list: CardList, cardKeys: Iterable<string>, status: CardStatus, now: Date): CardList {
  const wanted = keySet(cardKeys);
  if (!list.entries.some(e => wanted.has(e.cardKey) && e.status !== status)) return list;
  const entries = list.entries.map(e => (wanted.has(e.cardKey) && e.status !== status ? { ...e, status } : e));
  return { ...list, entries, updatedAt: now.toISOString() };
}

export interface RemoveResult { list: CardList; removed: number }

export function removeEntries(list: CardList, cardKeys: Iterable<string>, now: Date): RemoveResult {
  const wanted = keySet(cardKeys);
  const entries = list.entries.filter(e => !wanted.has(e.cardKey));
  const removed = list.entries.length - entries.length;
  return { list: removed === 0 ? list : { ...list, entries, updatedAt: now.toISOString() }, removed };
}

export interface CopyResult {
  list: CardList;                 // the target list after the copy
  added: number;                  // cards new to the target
  merged: number;                 // cards the target already had, which gained the copies
  overflow: ListEntry[];          // cards that did not fit under the 250-card limit, in list order
}

// Copies the listed cards from one list into another. A card the target already has gains the copies; a new card
// keeps its status, quantity and tags. Cards beyond the limit are returned, not dropped silently.
export function copyEntries(source: CardList, cardKeys: Iterable<string>, target: CardList, now: Date): CopyResult {
  const wanted = keySet(cardKeys);
  const picked = source.entries.filter(e => wanted.has(e.cardKey));
  const incoming: IncomingEntry[] = picked.map(e => ({ cardKey: e.cardKey, name: e.name, quantity: e.quantity, status: e.status, tags: e.tags }));
  const result = addEntries(target, incoming, now);
  const overflowKeys = new Set(result.overflow.map(o => o.cardKey));
  return { list: result.list, added: result.added, merged: result.merged, overflow: picked.filter(e => overflowKeys.has(e.cardKey)) };
}

// "Select by binder": the cards planned for one binder. `binderOf` maps a card key to its binder's name; a card with
// no binder (not needed, not found, no stop) is not in the map.
export const cardKeysInBinder = (binderOf: ReadonlyMap<string, string>, binder: string): string[] =>
  [...binderOf].filter(([, name]) => name === binder).map(([key]) => key);

export interface BinderCount { binder: string; cards: number }

// The binders that appear in the map, in the order they first appear, with how many cards each has.
export function binderCounts(binderOf: ReadonlyMap<string, string>): BinderCount[] {
  const counts = new Map<string, number>();
  for (const name of binderOf.values()) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([binder, cards]) => ({ binder, cards }));
}
