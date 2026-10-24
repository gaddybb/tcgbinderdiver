// List operations. Pure: every function takes the list (or lists) and returns a new one; `now` is passed in.
import type { CardStatus } from '../status';
import { MAX_CARDS_PER_LIST, MAX_LISTS, WISHLIST_ID } from './limits';
import { DEFAULT_GAME } from '../games';
import type { GameId } from '../games';
import type { CardList, IncomingEntry, ListEntry, ListKind, PrintRef } from './types';

export const cleanName = (name: string): string => name.replace(/\s+/g, ' ').trim();
export const isValidListName = (name: string): boolean => cleanName(name).length > 0;
export const canCreateList = (existingCount: number): boolean => existingCount < MAX_LISTS;

// A new list starts switched on for the next dive.
export function createList(init: { id: string; kind: ListKind; name: string; game?: GameId }, now: Date): CardList {
  const iso = now.toISOString();
  return { id: init.id, kind: init.kind, name: cleanName(init.name), entries: [], inNextDive: true, createdAt: iso, updatedAt: iso, ...(init.game && init.game !== DEFAULT_GAME ? { game: init.game } : {}) };
}

const touch = (list: CardList, now: Date): CardList => ({ ...list, updatedAt: now.toISOString() });

export function renameList(list: CardList, name: string, now: Date): CardList {
  const cleaned = cleanName(name);
  if (!cleaned || cleaned === list.name) return list;
  return touch({ ...list, name: cleaned }, now);
}

// "Duplicate" makes a deck named "<name> copy". It starts off, so a copy never changes the next dive by surprise.
// There is only ever one wishlist, so a copy of the wishlist is a deck.
export function duplicateList(list: CardList, newId: string, now: Date): CardList {
  const iso = now.toISOString();
  return { ...list, id: newId, kind: 'deck', name: `${list.name} copy`, entries: list.entries.map(e => ({ ...e, tags: [...e.tags] })), inNextDive: false, createdAt: iso, updatedAt: iso };
}

// The dive switch is a setting, not an edit: it does not change "Updated".
export const setInNextDive = (list: CardList, on: boolean): CardList => (list.inNextDive === on ? list : { ...list, inNextDive: on });

export interface AddResult {
  list: CardList;
  added: number;                 // new lines
  merged: number;                // lines that already existed and gained copies
  skipped: number;               // lines that already existed and were left alone (skipExisting)
  overflow: IncomingEntry[];     // lines that did not fit under the 250-line limit, in order
}

const copies = (n: number): number => Math.max(1, Math.floor(n));

// Adds lines to a list, combining a card that is already there. `skipExisting` is for the wishlist import, which
// ignores cards already on the wishlist. Lines beyond the limit are returned, not dropped silently.
export function addEntries(list: CardList, incoming: readonly IncomingEntry[], now: Date, options: { skipExisting?: boolean } = {}): AddResult {
  const entries = list.entries.map(e => ({ ...e }));
  const index = new Map(entries.map((e, i) => [e.cardKey, i]));
  const overflow: IncomingEntry[] = [];
  let added = 0, merged = 0, skipped = 0;

  for (const item of incoming) {
    const at = index.get(item.cardKey);
    if (at !== undefined) {
      if (options.skipExisting) { skipped++; continue; }
      entries[at].quantity += copies(item.quantity);
      merged++;
    } else if (entries.length >= MAX_CARDS_PER_LIST) {
      overflow.push(item);
    } else {
      index.set(item.cardKey, entries.length);
      entries.push({ cardKey: item.cardKey, name: item.name, quantity: copies(item.quantity), status: item.status ?? 'needed', tags: [...(item.tags ?? [])], ...(item.listed ? { listed: item.listed } : {}), ...(item.print ? { print: item.print } : {}), ...(item.locked ? { locked: true } : {}) });
      added++;
    }
  }
  const changed = added > 0 || merged > 0;
  return { list: changed ? touch({ ...list, entries }, now) : list, added, merged, skipped, overflow };
}

const mapEntry = (list: CardList, cardKey: string, now: Date, change: (e: ListEntry) => ListEntry): CardList => {
  if (!list.entries.some(e => e.cardKey === cardKey)) return list;
  return touch({ ...list, entries: list.entries.map(e => (e.cardKey === cardKey ? change(e) : e)) }, now);
};

export const setEntryStatus = (list: CardList, cardKey: string, status: CardStatus, now: Date): CardList =>
  mapEntry(list, cardKey, now, e => ({ ...e, status }));

export const setEntryQuantity = (list: CardList, cardKey: string, quantity: number, now: Date): CardList =>
  mapEntry(list, cardKey, now, e => ({ ...e, quantity: copies(quantity) }));

export const setAllStatuses = (list: CardList, status: CardStatus, now: Date): CardList =>
  list.entries.length === 0 ? list : touch({ ...list, entries: list.entries.map(e => ({ ...e, status })) }, now);

export const removeEntry = (list: CardList, cardKey: string, now: Date): CardList =>
  list.entries.some(e => e.cardKey === cardKey) ? touch({ ...list, entries: list.entries.filter(e => e.cardKey !== cardKey) }, now) : list;

export const clearEntries = (list: CardList, now: Date): CardList => (list.entries.length === 0 ? list : touch({ ...list, entries: [] }, now));

export interface ListCounts { cards: number; needed: number }
export const listCounts = (list: CardList): ListCounts => ({
  cards: list.entries.length,
  needed: list.entries.filter(e => e.status === 'needed').length,
});

// Decks first, newest first; the wishlist always last. Stable, so it does not move when a list is edited.
export function sortLists(lists: readonly CardList[]): CardList[] {
  return [...lists].sort((a, b) => {
    if ((a.id === WISHLIST_ID) !== (b.id === WISHLIST_ID)) return a.id === WISHLIST_ID ? 1 : -1;
    return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
  });
}

export type UpdatedAge =
  | { kind: 'today' }
  | { kind: 'yesterday' }
  | { kind: 'days'; n: number }
  | { kind: 'last_week' }
  | { kind: 'weeks'; n: number }
  | { kind: 'date'; iso: string };

const DAY_MS = 24 * 3600 * 1000;
const startOfDay = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// How long ago a list changed, in calendar days: today, yesterday, 2 to 6 days, last week, N weeks, then the date.
export function updatedAge(list: CardList, now: Date): UpdatedAge {
  const updated = new Date(list.updatedAt);
  const days = Math.max(0, Math.round((startOfDay(now) - startOfDay(updated)) / DAY_MS));
  if (days === 0) return { kind: 'today' };
  if (days === 1) return { kind: 'yesterday' };
  if (days < 7) return { kind: 'days', n: days };
  if (days < 14) return { kind: 'last_week' };
  if (days < 30) return { kind: 'weeks', n: Math.floor(days / 7) };
  return { kind: 'date', iso: list.updatedAt };
}

export interface NextDiveSummary {
  listIds: string[];
  listNames: string[];
  listCount: number;
  cardCount: number;       // different cards still needed across the lists that are on
}

export function nextDiveSummary(lists: readonly CardList[]): NextDiveSummary {
  const on = sortLists(lists).filter(l => l.inNextDive);
  const needed = new Set<string>();
  for (const list of on) for (const e of list.entries) if (e.status === 'needed') needed.add(e.cardKey);
  return { listIds: on.map(l => l.id), listNames: on.map(l => l.name), listCount: on.length, cardCount: needed.size };
}

export interface NeededAcrossLists {
  cardKey: string;
  name: string;
  copies: number;                                                       // total copies still needed
  lock?: PrintRef;                                                      // the one version to look for, when a list has locked one
  parts: { listId: string; listName: string; quantity: number }[];      // per list, in list order
}

// The one card list the plan works from: needed cards on every list that is on, with a card on several lists combined.
export function mergeNeeded(lists: readonly CardList[]): NeededAcrossLists[] {
  const merged = new Map<string, NeededAcrossLists>();
  for (const list of sortLists(lists)) {
    if (!list.inNextDive) continue;
    for (const e of list.entries) {
      if (e.status !== 'needed') continue;
      const part = { listId: list.id, listName: list.name, quantity: e.quantity };
      const cur = merged.get(e.cardKey);
      const lock = e.locked && e.print ? e.print : undefined;
      if (cur) { cur.copies += e.quantity; cur.parts.push(part); if (!cur.lock && lock) cur.lock = lock; }
      else merged.set(e.cardKey, { cardKey: e.cardKey, name: e.name, copies: e.quantity, parts: [part], ...(lock ? { lock } : {}) });
    }
  }
  return [...merged.values()];
}

// "Copy as text": the whole list, one "quantity name" line per card, ready for Moxfield or a message.
export const copyAsText = (list: CardList): string => list.entries.map(e => `${e.quantity} ${e.name}`).join('\n');

// The card whose art heads a list: the one chosen for it (a sample deck's commander), else the first card. Null for an empty list.
export function bannerCardName(list: Pick<CardList, 'banner' | 'entries'>): string | null {
  return list.banner ?? list.entries[0]?.name ?? null;
}

// Chooses the version of a card for this list (locked: look only for it), or clears the choice with null.
export const setEntryVersion = (list: CardList, cardKey: string, version: { print: PrintRef; locked: boolean } | null, now: Date): CardList =>
  mapEntry(list, cardKey, now, e => {
    const next = { ...e };
    delete next.print;
    delete next.locked;
    return version ? { ...next, print: version.print, ...(version.locked ? { locked: true } : {}) } : next;
  });

// The card whose art heads a list is chosen by name; null goes back to the first card.
export function setBanner(list: CardList, cardName: string | null): CardList {
  const next = { ...list };
  delete next.banner;
  return cardName ? { ...next, banner: cardName } : next;
}
