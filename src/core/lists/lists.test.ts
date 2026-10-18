import { describe, expect, it } from 'vitest';
import {
  MAX_CARDS_PER_LIST, MAX_LISTS, WISHLIST_ID, addEntries, canCreateList, clearEntries, cleanName, copyAsText, createList, duplicateList,
  isValidListName, listCounts, mergeNeeded, nextDiveSummary, removeEntry, renameList, setAllStatuses, setEntryQuantity, setEntryStatus,
  setInNextDive, sortLists, updatedAge,
} from './index';
import type { CardList, IncomingEntry } from './index';

const T0 = new Date('2026-10-17T12:00:00');
const later = (days: number) => new Date(T0.getTime() + days * 24 * 3600 * 1000);
const deck = (id = 'd1', name = 'Lifegain Commander', at = T0): CardList => createList({ id, kind: 'deck', name }, at);
const line = (cardKey: string, quantity = 1, name = cardKey): IncomingEntry => ({ cardKey, name, quantity });
const withCards = (list: CardList, ...lines: IncomingEntry[]): CardList => addEntries(list, lines, T0).list;

describe('limits', () => {
  it('are 250 lines per list and 25 lists', () => {
    expect(MAX_CARDS_PER_LIST).toBe(250);
    expect(MAX_LISTS).toBe(25);
    expect(WISHLIST_ID).toBe('wishlist');
  });
  it('allows a new list until 25 exist', () => {
    expect(canCreateList(24)).toBe(true);
    expect(canCreateList(25)).toBe(false);
  });
});

describe('createList and names', () => {
  it('starts empty, switched on, with the time it was made', () => {
    const list = deck();
    expect(list).toEqual({ id: 'd1', kind: 'deck', name: 'Lifegain Commander', entries: [], inNextDive: true, createdAt: T0.toISOString(), updatedAt: T0.toISOString() });
  });
  it('tidies the name', () => {
    expect(cleanName('  Zombie    Tribal  ')).toBe('Zombie Tribal');
    expect(createList({ id: 'x', kind: 'deck', name: '  A   B ' }, T0).name).toBe('A B');
  });
  it('a name needs at least one visible character', () => {
    expect(isValidListName('')).toBe(false);
    expect(isValidListName('   ')).toBe(false);
    expect(isValidListName(' a ')).toBe(true);
  });
});

describe('renameList', () => {
  it('renames and marks the list updated', () => {
    const renamed = renameList(deck(), '  Elves  ', later(1));
    expect(renamed.name).toBe('Elves');
    expect(renamed.updatedAt).toBe(later(1).toISOString());
  });
  it('ignores an empty name and an unchanged name', () => {
    const list = deck();
    expect(renameList(list, '   ', later(1))).toBe(list);
    expect(renameList(list, 'Lifegain Commander', later(1))).toBe(list);
  });
  it('does not change the original', () => {
    const list = deck();
    renameList(list, 'Elves', later(1));
    expect(list.name).toBe('Lifegain Commander');
  });
});

describe('duplicateList', () => {
  const original = withCards(deck('d1', 'Zombie Tribal'), line('a', 2), line('b'));
  const copy = duplicateList(original, 'd2', later(2));

  it('makes "<name> copy" with its own id and the same cards', () => {
    expect(copy.id).toBe('d2');
    expect(copy.name).toBe('Zombie Tribal copy');
    expect(copy.entries).toEqual(original.entries);
  });
  it('starts switched off and as new', () => {
    expect(copy.inNextDive).toBe(false);
    expect(copy.createdAt).toBe(later(2).toISOString());
    expect(copy.updatedAt).toBe(later(2).toISOString());
  });
  it('shares nothing with the original', () => {
    copy.entries[0].quantity = 9;
    copy.entries[0].tags.push('x');
    expect(original.entries[0].quantity).toBe(2);
    expect(original.entries[0].tags).toEqual([]);
  });
  it('a copy of the wishlist is a deck, since there is only one wishlist', () => {
    const wish = createList({ id: WISHLIST_ID, kind: 'wishlist', name: 'Wishlist' }, T0);
    expect(duplicateList(wish, 'd9', T0).kind).toBe('deck');
  });
});

describe('setInNextDive', () => {
  it('flips the switch without counting as an edit', () => {
    const list = deck();
    const off = setInNextDive(list, false);
    expect(off.inNextDive).toBe(false);
    expect(off.updatedAt).toBe(list.updatedAt);
    expect(setInNextDive(off, false)).toBe(off);
  });
});

describe('addEntries', () => {
  it('adds new lines as Needed, with their quantity and tags', () => {
    const r = addEntries(deck(), [{ cardKey: 'a', name: 'Sol Ring', quantity: 2, tags: ['ramp'] }], later(1));
    expect(r.added).toBe(1);
    expect(r.list.entries).toEqual([{ cardKey: 'a', name: 'Sol Ring', quantity: 2, status: 'needed', tags: ['ramp'] }]);
    expect(r.list.updatedAt).toBe(later(1).toISOString());
  });
  it('can start a line with another status', () => {
    const r = addEntries(deck(), [{ cardKey: 'a', name: 'A', quantity: 1, status: 'in_collection' }], T0);
    expect(r.list.entries[0].status).toBe('in_collection');
  });
  it('adds the copies to a card that is already there', () => {
    const start = withCards(deck(), line('a', 2));
    const r = addEntries(start, [line('a', 3)], later(1));
    expect(r.merged).toBe(1);
    expect(r.added).toBe(0);
    expect(r.list.entries).toHaveLength(1);
    expect(r.list.entries[0].quantity).toBe(5);
  });
  it('skips cards already on the list when asked (the wishlist import)', () => {
    const start = withCards(deck(), line('a', 2));
    const r = addEntries(start, [line('a', 3), line('b')], later(1), { skipExisting: true });
    expect(r.skipped).toBe(1);
    expect(r.added).toBe(1);
    expect(r.list.entries.map(e => [e.cardKey, e.quantity])).toEqual([['a', 2], ['b', 1]]);
  });
  it('combines a card repeated in one paste', () => {
    const r = addEntries(deck(), [line('a'), line('a', 2)], T0);
    expect(r.list.entries).toEqual([expect.objectContaining({ cardKey: 'a', quantity: 3 })]);
    expect(r.added).toBe(1);
    expect(r.merged).toBe(1);
  });
  it('makes a bad quantity at least 1', () => {
    const r = addEntries(deck(), [line('a', 0), line('b', -3), line('c', 2.9)], T0);
    expect(r.list.entries.map(e => e.quantity)).toEqual([1, 1, 2]);
  });
  it('returns the same list when nothing was added', () => {
    const list = deck();
    expect(addEntries(list, [], later(1)).list).toBe(list);
    const full = withCards(list, line('a'));
    expect(addEntries(full, [line('a')], later(1), { skipExisting: true }).list).toBe(full);
  });
  it('stops at 250 lines and hands back the rest in order', () => {
    const lines = Array.from({ length: 260 }, (_, i) => line(`c${i}`));
    const r = addEntries(deck(), lines, T0);
    expect(r.list.entries).toHaveLength(250);
    expect(r.added).toBe(250);
    expect(r.overflow.map(o => o.cardKey)).toEqual(lines.slice(250).map(l => l.cardKey));
  });
  it('still adds copies to a card already on a full list', () => {
    const full = addEntries(deck(), Array.from({ length: 250 }, (_, i) => line(`c${i}`)), T0).list;
    const r = addEntries(full, [line('c0', 2), line('new')], later(1));
    expect(r.list.entries[0].quantity).toBe(3);
    expect(r.list.entries).toHaveLength(250);
    expect(r.overflow.map(o => o.cardKey)).toEqual(['new']);
  });
  it('does not change the list it was given', () => {
    const list = withCards(deck(), line('a'));
    addEntries(list, [line('a', 5), line('b')], later(1));
    expect(list.entries).toHaveLength(1);
    expect(list.entries[0].quantity).toBe(1);
  });
});

describe('editing lines', () => {
  const list = withCards(deck(), line('a', 2), line('b'), line('c'));

  it('sets one card\'s status and marks the list updated', () => {
    const r = setEntryStatus(list, 'b', 'ordered', later(1));
    expect(r.entries.map(e => e.status)).toEqual(['needed', 'ordered', 'needed']);
    expect(r.updatedAt).toBe(later(1).toISOString());
  });
  it('sets every status at once', () => {
    expect(setAllStatuses(list, 'in_collection', later(1)).entries.every(e => e.status === 'in_collection')).toBe(true);
    expect(setAllStatuses(setAllStatuses(list, 'proxy', T0), 'needed', later(1)).entries.every(e => e.status === 'needed')).toBe(true);
  });
  it('sets a quantity, never below 1', () => {
    expect(setEntryQuantity(list, 'a', 4, later(1)).entries[0].quantity).toBe(4);
    expect(setEntryQuantity(list, 'a', 0, later(1)).entries[0].quantity).toBe(1);
  });
  it('removes a card', () => {
    expect(removeEntry(list, 'b', later(1)).entries.map(e => e.cardKey)).toEqual(['a', 'c']);
  });
  it('clears every card', () => {
    const cleared = clearEntries(list, later(1));
    expect(cleared.entries).toEqual([]);
    expect(cleared.name).toBe(list.name);
  });
  it('leaves the list alone when the card is not on it or nothing would change', () => {
    expect(setEntryStatus(list, 'zzz', 'proxy', later(1))).toBe(list);
    expect(setEntryQuantity(list, 'zzz', 3, later(1))).toBe(list);
    expect(removeEntry(list, 'zzz', later(1))).toBe(list);
    const empty = deck();
    expect(clearEntries(empty, later(1))).toBe(empty);
    expect(setAllStatuses(empty, 'proxy', later(1))).toBe(empty);
  });
  it('does not change the original', () => {
    setEntryStatus(list, 'a', 'proxy', later(1));
    setAllStatuses(list, 'proxy', later(1));
    expect(list.entries.every(e => e.status === 'needed')).toBe(true);
  });
});

describe('listCounts', () => {
  it('counts lines, and the ones still needed', () => {
    const list = setEntryStatus(setEntryStatus(withCards(deck(), line('a', 4), line('b'), line('c'), line('d')), 'b', 'proxy', T0), 'c', 'out_of_deck', T0);
    expect(listCounts(list)).toEqual({ cards: 4, needed: 2 });
  });
  it('is zero for an empty list', () => {
    expect(listCounts(deck())).toEqual({ cards: 0, needed: 0 });
  });
});

describe('sortLists', () => {
  const wish = createList({ id: WISHLIST_ID, kind: 'wishlist', name: 'Wishlist' }, new Date('2026-01-01T00:00:00Z'));
  const old = createList({ id: 'old', kind: 'deck', name: 'Old' }, new Date('2026-05-01T00:00:00Z'));
  const fresh = createList({ id: 'fresh', kind: 'deck', name: 'Fresh' }, new Date('2026-09-01T00:00:00Z'));

  it('puts decks newest first and the wishlist last', () => {
    expect(sortLists([wish, old, fresh]).map(l => l.id)).toEqual(['fresh', 'old', WISHLIST_ID]);
  });
  it('does not move when a list is edited', () => {
    const edited = setEntryStatus(addEntries(old, [line('a')], later(30)).list, 'a', 'proxy', later(31));
    expect(sortLists([wish, edited, fresh]).map(l => l.id)).toEqual(['fresh', 'old', WISHLIST_ID]);
  });
  it('is stable for lists made at the same moment', () => {
    const a = createList({ id: 'a', kind: 'deck', name: 'A' }, T0), b = createList({ id: 'b', kind: 'deck', name: 'B' }, T0);
    expect(sortLists([b, a]).map(l => l.id)).toEqual(['a', 'b']);
  });
  it('does not change the array it was given', () => {
    const input = [wish, old, fresh];
    sortLists(input);
    expect(input.map(l => l.id)).toEqual([WISHLIST_ID, 'old', 'fresh']);
  });
});

describe('updatedAge', () => {
  const at = (days: number) => updatedAge(deck(), later(days));
  it('says today, yesterday, then days', () => {
    expect(at(0)).toEqual({ kind: 'today' });
    expect(at(1)).toEqual({ kind: 'yesterday' });
    expect(at(3)).toEqual({ kind: 'days', n: 3 });
    expect(at(6)).toEqual({ kind: 'days', n: 6 });
  });
  it('says last week for a week to two weeks ago', () => {
    expect(at(7)).toEqual({ kind: 'last_week' });
    expect(at(13)).toEqual({ kind: 'last_week' });
  });
  it('counts weeks, then gives the date after a month', () => {
    expect(at(14)).toEqual({ kind: 'weeks', n: 2 });
    expect(at(29)).toEqual({ kind: 'weeks', n: 4 });
    expect(at(30)).toEqual({ kind: 'date', iso: T0.toISOString() });
  });
  it('counts calendar days, not 24-hour spans', () => {
    const late = createList({ id: 'x', kind: 'deck', name: 'x' }, new Date('2026-10-16T23:30:00'));
    expect(updatedAge(late, new Date('2026-10-17T00:30:00'))).toEqual({ kind: 'yesterday' });
  });
  it('treats a time in the future as today', () => {
    expect(updatedAge(deck('x', 'x', later(2)), T0)).toEqual({ kind: 'today' });
  });
});

describe('nextDiveSummary', () => {
  const a = withCards(deck('a', 'Lifegain Commander', new Date('2026-10-01T00:00:00Z')), line('sol'), line('ring'), line('mana'));
  const b = withCards(deck('b', 'Zombie Tribal', new Date('2026-09-01T00:00:00Z')), line('sol'), line('zombie'));
  const wish = withCards(createList({ id: WISHLIST_ID, kind: 'wishlist', name: 'Wishlist' }, new Date('2026-01-01T00:00:00Z')), line('mana'), line('fetch'));

  it('counts the lists that are on and the different cards they still need', () => {
    const s = nextDiveSummary([a, b, wish]);
    expect(s.listCount).toBe(3);
    expect(s.cardCount).toBe(5);       // sol, ring, mana, zombie, fetch: shared cards count once
  });
  it('leaves out lists that are switched off', () => {
    const s = nextDiveSummary([a, setInNextDive(b, false), wish]);
    expect(s.listNames).toEqual(['Lifegain Commander', 'Wishlist']);
    expect(s.cardCount).toBe(4);
  });
  it('does not count cards that are not needed', () => {
    const owned = setEntryStatus(a, 'sol', 'in_collection', T0);
    expect(nextDiveSummary([owned]).cardCount).toBe(2);
  });
  it('is empty when nothing is on', () => {
    expect(nextDiveSummary([setInNextDive(a, false)])).toEqual({ listIds: [], listNames: [], listCount: 0, cardCount: 0 });
    expect(nextDiveSummary([])).toEqual({ listIds: [], listNames: [], listCount: 0, cardCount: 0 });
  });
  it('names lists in My lists order', () => {
    expect(nextDiveSummary([wish, b, a]).listNames).toEqual(['Lifegain Commander', 'Zombie Tribal', 'Wishlist']);
  });
});

describe('mergeNeeded', () => {
  const a = withCards(deck('a', 'Lifegain Commander', new Date('2026-10-01T00:00:00Z')), line('elves', 3, 'Llanowar Elves'), line('sol', 1, 'Sol Ring'));
  const b = withCards(deck('b', 'Elves', new Date('2026-09-01T00:00:00Z')), line('elves', 1, 'Llanowar Elves'));
  const wish = withCards(createList({ id: WISHLIST_ID, kind: 'wishlist', name: 'Wishlist' }, new Date('2026-01-01T00:00:00Z')), line('elves', 1, 'Llanowar Elves'), line('fetch', 1, 'Misty Rainforest'));

  it('shows a card on several lists once, with every copy', () => {
    const merged = mergeNeeded([a, b, wish]);
    const elves = merged.find(m => m.cardKey === 'elves')!;
    expect(elves.copies).toBe(5);
    expect(elves.parts).toEqual([
      { listId: 'a', listName: 'Lifegain Commander', quantity: 3 },
      { listId: 'b', listName: 'Elves', quantity: 1 },
      { listId: WISHLIST_ID, listName: 'Wishlist', quantity: 1 },
    ]);
    expect(merged.map(m => m.cardKey)).toEqual(['elves', 'sol', 'fetch']);
  });
  it('lists the parts top to bottom in My lists order, whatever order the lists came in', () => {
    expect(mergeNeeded([wish, b, a]).find(m => m.cardKey === 'elves')!.parts.map(p => p.listId)).toEqual(['a', 'b', WISHLIST_ID]);
  });
  it('leaves out lists that are off and cards that are not needed', () => {
    const owned = setEntryStatus(b, 'elves', 'in_collection', T0);
    const merged = mergeNeeded([a, owned, setInNextDive(wish, false)]);
    expect(merged.find(m => m.cardKey === 'elves')!.copies).toBe(3);
    expect(merged.find(m => m.cardKey === 'fetch')).toBeUndefined();
  });
  it('is empty with no lists on', () => {
    expect(mergeNeeded([])).toEqual([]);
  });
  it('does not change the lists', () => {
    mergeNeeded([a, b]);
    expect(a.entries[0].quantity).toBe(3);
  });
});

describe('copyAsText', () => {
  it('writes one "quantity name" line per card, every card, in order', () => {
    const list = setEntryStatus(withCards(deck(), line('a', 2, 'Sol Ring'), line('b', 1, 'Fire // Ice')), 'b', 'proxy', T0);
    expect(copyAsText(list)).toBe('2 Sol Ring\n1 Fire // Ice');
  });
  it('is empty for an empty list', () => {
    expect(copyAsText(deck())).toBe('');
  });
});
