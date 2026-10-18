import { describe, expect, it } from 'vitest';
import { MAX_CARDS_PER_LIST, addEntries, createList, listCounts, setEntryStatus } from './index';
import { binderCounts, cardKeysInBinder, copyEntries, removeEntries, setEntriesStatus } from './bulk';
import type { CardList, IncomingEntry } from './index';

const T0 = new Date('2026-10-17T12:00:00');
const T1 = new Date('2026-10-18T12:00:00');
const make = (id: string, ...lines: IncomingEntry[]): CardList => addEntries(createList({ id, kind: 'deck', name: id }, T0), lines, T0).list;
const line = (cardKey: string, quantity = 1): IncomingEntry => ({ cardKey, name: cardKey.toUpperCase(), quantity });
const lines = (n: number, prefix = 'c') => Array.from({ length: n }, (_, i) => line(`${prefix}${i}`));
const statuses = (list: CardList) => list.entries.map(e => `${e.cardKey}:${e.status}`);

describe('setEntriesStatus', () => {
  const list = make('a', line('x'), line('y'), line('z'));

  it('sets the status of the listed cards only, and marks the list updated', () => {
    const next = setEntriesStatus(list, ['x', 'z'], 'in_collection', T1);
    expect(statuses(next)).toEqual(['x:in_collection', 'y:needed', 'z:in_collection']);
    expect(next.updatedAt).toBe(T1.toISOString());
  });
  it('accepts a Set', () => {
    expect(statuses(setEntriesStatus(list, new Set(['y']), 'proxy', T1))).toEqual(['x:needed', 'y:proxy', 'z:needed']);
  });
  it('keeps quantity, name and tags', () => {
    const rich = addEntries(createList({ id: 'r', kind: 'deck', name: 'r' }, T0), [{ cardKey: 'x', name: 'X', quantity: 3, tags: ['ramp'] }], T0).list;
    expect(setEntriesStatus(rich, ['x'], 'ordered', T1).entries[0]).toEqual({ cardKey: 'x', name: 'X', quantity: 3, status: 'ordered', tags: ['ramp'] });
  });
  it('returns the same list, with "Updated" untouched, when nothing changes', () => {
    expect(setEntriesStatus(list, ['x', 'y'], 'needed', T1)).toBe(list);
    expect(setEntriesStatus(list, [], 'proxy', T1)).toBe(list);
    expect(setEntriesStatus(list, ['nope'], 'proxy', T1)).toBe(list);
  });
  it('skips cards that already have the status and keys that are not on the list', () => {
    const half = setEntryStatus(list, 'x', 'proxy', T0);
    const next = setEntriesStatus(half, ['x', 'y', 'nope'], 'proxy', T1);
    expect(statuses(next)).toEqual(['x:proxy', 'y:proxy', 'z:needed']);
    expect(next.entries[0]).toBe(half.entries[0]);
  });
  it('only Needed counts: leaving Needed drops cards from the count, returning adds them back', () => {
    const owned = setEntriesStatus(list, ['x', 'y', 'z'], 'in_collection', T1);
    expect(listCounts(owned)).toEqual({ cards: 3, needed: 0 });
    expect(listCounts(setEntriesStatus(owned, ['y'], 'needed', T1))).toEqual({ cards: 3, needed: 1 });
  });
  it('does not change the list it is given', () => {
    setEntriesStatus(list, ['x'], 'proxy', T1);
    expect(statuses(list)).toEqual(['x:needed', 'y:needed', 'z:needed']);
  });
});

describe('removeEntries', () => {
  const list = make('a', line('x'), line('y'), line('z'));
  it('removes the listed cards, counts them and marks the list updated', () => {
    const { list: next, removed } = removeEntries(list, ['x', 'z'], T1);
    expect(next.entries.map(e => e.cardKey)).toEqual(['y']);
    expect(removed).toBe(2);
    expect(next.updatedAt).toBe(T1.toISOString());
  });
  it('counts only cards that were there', () => {
    expect(removeEntries(list, ['x', 'nope'], T1).removed).toBe(1);
  });
  it('returns the same list when there is nothing to remove', () => {
    const result = removeEntries(list, ['nope'], T1);
    expect(result.list).toBe(list);
    expect(result.removed).toBe(0);
    expect(removeEntries(list, [], T1).list).toBe(list);
  });
  it('can empty the list', () => {
    expect(removeEntries(list, ['x', 'y', 'z'], T1).list.entries).toEqual([]);
  });
});

describe('copyEntries', () => {
  it('adds new cards to the other list with their quantity and status, and leaves the source alone', () => {
    const source = setEntryStatus(make('a', line('x', 2), line('y')), 'y', 'proxy', T0);
    const result = copyEntries(source, ['x', 'y'], make('b', line('q')), T1);
    expect(result.list.entries.map(e => [e.cardKey, e.quantity, e.status])).toEqual([['q', 1, 'needed'], ['x', 2, 'needed'], ['y', 1, 'proxy']]);
    expect([result.added, result.merged, result.overflow]).toEqual([2, 0, []]);
    expect(result.list.updatedAt).toBe(T1.toISOString());
    expect(source.entries).toHaveLength(2);
  });
  it('a card already there gains the copies and keeps its own status', () => {
    const target = setEntryStatus(make('b', line('x', 3)), 'x', 'in_collection', T0);
    const result = copyEntries(make('a', line('x', 2)), ['x'], target, T1);
    expect(result.list.entries).toEqual([{ cardKey: 'x', name: 'X', quantity: 5, status: 'in_collection', tags: [] }]);
    expect([result.added, result.merged]).toEqual([0, 1]);
  });
  it('copies tags without sharing the array', () => {
    const source = addEntries(createList({ id: 'a', kind: 'deck', name: 'a' }, T0), [{ cardKey: 'x', name: 'X', quantity: 1, tags: ['ramp'] }], T0).list;
    const result = copyEntries(source, ['x'], make('b'), T1);
    expect(result.list.entries[0].tags).toEqual(['ramp']);
    expect(result.list.entries[0].tags).not.toBe(source.entries[0].tags);
  });
  it('ignores keys that are not on the source list', () => {
    const result = copyEntries(make('a', line('x')), ['x', 'nope'], make('b'), T1);
    expect(result.list.entries.map(e => e.cardKey)).toEqual(['x']);
    expect(result.added).toBe(1);
  });
  it('copies in the order of the source list, not the order of the keys', () => {
    const result = copyEntries(make('a', line('x'), line('y'), line('z')), ['z', 'x'], make('b'), T1);
    expect(result.list.entries.map(e => e.cardKey)).toEqual(['x', 'z']);
  });
  it('fills a list up to 250 and returns the cards that did not fit, in order', () => {
    const nearlyFull = make('b', ...lines(MAX_CARDS_PER_LIST - 3), line('x', 3));
    const source = make('a', line('x'), line('n1'), line('n2'), line('n3'), line('n4'));
    const result = copyEntries(source, ['x', 'n1', 'n2', 'n3', 'n4'], nearlyFull, T1);
    expect(result.list.entries).toHaveLength(MAX_CARDS_PER_LIST);
    expect([result.added, result.merged]).toEqual([2, 1]);
    expect(result.overflow.map(e => e.cardKey)).toEqual(['n3', 'n4']);
    expect(result.list.entries.find(e => e.cardKey === 'x')!.quantity).toBe(4);
  });
  it('a full list still takes extra copies of cards it has', () => {
    const full = make('b', ...lines(MAX_CARDS_PER_LIST));
    const result = copyEntries(make('a', line('c0', 2), line('new')), ['c0', 'new'], full, T1);
    expect(result.merged).toBe(1);
    expect(result.overflow.map(e => e.cardKey)).toEqual(['new']);
    expect(result.list.entries[0].quantity).toBe(3);
  });
  it('returns the same target, with "Updated" untouched, when nothing was copied', () => {
    const target = make('b', line('q'));
    expect(copyEntries(make('a', line('x')), [], target, T1).list).toBe(target);
    expect(copyEntries(make('a', line('x')), ['nope'], target, T1).list).toBe(target);
    const full = make('b', ...lines(MAX_CARDS_PER_LIST));
    const none = copyEntries(make('a', line('new')), ['new'], full, T1);
    expect(none.list).toBe(full);
    expect(none.overflow).toHaveLength(1);
  });
});

describe('select by binder', () => {
  const binderOf = new Map([['a', 'Foundations'], ['b', 'Commander Box'], ['c', 'Foundations'], ['d', 'Theros Beyond Death']]);
  it('finds the cards planned for a binder', () => {
    expect(cardKeysInBinder(binderOf, 'Foundations')).toEqual(['a', 'c']);
    expect(cardKeysInBinder(binderOf, 'Commander Box')).toEqual(['b']);
  });
  it('finds nothing for a binder that is not there, or an empty map', () => {
    expect(cardKeysInBinder(binderOf, 'Magic 2014')).toEqual([]);
    expect(cardKeysInBinder(new Map(), 'Foundations')).toEqual([]);
  });
  it('counts the cards in each binder, in the order the binders first appear', () => {
    expect(binderCounts(binderOf)).toEqual([
      { binder: 'Foundations', cards: 2 }, { binder: 'Commander Box', cards: 1 }, { binder: 'Theros Beyond Death', cards: 1 },
    ]);
    expect(binderCounts(new Map())).toEqual([]);
  });
});
