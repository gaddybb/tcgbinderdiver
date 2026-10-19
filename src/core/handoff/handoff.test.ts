import { describe, expect, it } from 'vitest';
import { addEntries, createList, setEntryStatus, setInNextDive } from '../lists';
import type { CardList } from '../lists';
import { DEFAULT_STORE_SETTINGS, addGroup, markNotCarried } from '../store';
import { buildHandoff, fromWire, handoffCards, toIncoming, toWire } from './handoff';

const NOW = new Date('2026-10-18T12:00:00Z');
const deck = (name: string, cards: [string, number][], over: Partial<CardList> = {}): CardList => ({
  ...addEntries(createList({ id: name, kind: 'deck', name }, NOW), cards.map(([n, quantity]) => ({ cardKey: n.toLowerCase(), name: n, quantity })), NOW).list,
  ...over,
});

describe('buildHandoff', () => {
  it('takes the lists that are on for the next dive, with only the cards still needed', () => {
    const a = setEntryStatus(deck('A', [['Sol Ring', 2], ['Cultivate', 1]]), 'cultivate', 'in_collection', NOW);
    const off = setInNextDive(deck('Off', [['Mana Crypt', 1]]), false);
    const handoff = buildHandoff([a, off], DEFAULT_STORE_SETTINGS);
    expect(handoff.lists).toEqual([{ name: 'A', kind: 'deck', entries: [{ name: 'Sol Ring', quantity: 2 }] }]);
    expect(handoff.settings).toEqual(DEFAULT_STORE_SETTINGS);
  });

  it('keeps a sample deck, and leaves out a list with nothing needed', () => {
    const sample = deck('Sample', [['Sol Ring', 1]], { sample: true });
    const done = setEntryStatus(deck('Done', [['Sol Ring', 1]]), 'sol ring', 'proxy', NOW);
    expect(buildHandoff([sample, done], DEFAULT_STORE_SETTINGS).lists.map(l => l.name)).toEqual(['Sample']);
  });

  it('counts the cards across its lists', () => {
    expect(handoffCards(buildHandoff([deck('A', [['A', 1], ['B', 1]]), deck('B', [['C', 3]])], DEFAULT_STORE_SETTINGS))).toBe(3);
  });
});

describe('the wire form', () => {
  const settings = markNotCarried(addGroup(DEFAULT_STORE_SETTINGS, 'g1', 'Commander', ['cmm', 'fdc']), 'khm');
  const handoff = buildHandoff([deck('A', [['Sol Ring', 2]]), { ...deck('Wishlist', [['Cultivate', 1]]), kind: 'wishlist' }], { ...settings, includeBasicLands: true, pull: { worthPullMinCards: 3, worthPullMinUsd: 20 } });

  it('reads back exactly what was written, groups and settings included', () => {
    expect(fromWire(toWire(handoff))).toEqual(handoff);
  });

  it('works without settings', () => {
    const bare = { lists: handoff.lists };
    expect(fromWire(toWire(bare))).toEqual(bare);
  });

  it('is short: arrays, no field names', () => {
    expect(toWire(handoff).length).toBeLessThan(JSON.stringify(handoff).length);
  });

  it('turns a list into incoming entries keyed by name', () => {
    expect(toIncoming(handoff.lists[0])).toEqual([{ cardKey: 'sol ring', name: 'Sol Ring', quantity: 2 }]);
  });

  it.each([
    ['not JSON', 'nope'],
    ['not an object', '3'],
    ['a version it does not know', '{"v":2,"l":[["A",0,[["Sol Ring",1]]]]}'],
    ['no lists', '{"v":1,"l":[]}'],
    ['a list that is not the right shape', '{"v":1,"l":[["A",0]]}'],
    ['a kind that is not 0 or 1', '{"v":1,"l":[["A",2,[["Sol Ring",1]]]]}'],
    ['an empty name', '{"v":1,"l":[["",0,[["Sol Ring",1]]]]}'],
    ['a quantity of 0', '{"v":1,"l":[["A",0,[["Sol Ring",0]]]]}'],
    ['a quantity that is not a whole number', '{"v":1,"l":[["A",0,[["Sol Ring",1.5]]]]}'],
    ['a card name that is not text', '{"v":1,"l":[["A",0,[[7,1]]]]}'],
    ['settings of the wrong length', '{"v":1,"l":[["A",0,[["Sol Ring",1]]]],"s":[[],[],0]}'],
    ['set codes that are not codes', '{"v":1,"l":[["A",0,[["Sol Ring",1]]]],"s":[[],["<script>"],0,2,10]}'],
    ['a group that is not the right shape', '{"v":1,"l":[["A",0,[["Sol Ring",1]]]],"s":[[["g"]],[],0,2,10]}'],
  ])('refuses %s', (_why, text) => {
    expect(fromWire(text)).toBeNull();
  });

  it('refuses more lists than the app allows, and more cards than a list can hold', () => {
    const lists = Array.from({ length: 26 }, (_, i) => [`L${i}`, 0, [['Sol Ring', 1]]]);
    expect(fromWire(JSON.stringify({ v: 1, l: lists }))).toBeNull();
    const cards = Array.from({ length: 251 }, (_, i) => [`Card ${i}`, 1]);
    expect(fromWire(JSON.stringify({ v: 1, l: [['Big', 0, cards]] }))).toBeNull();
  });

  it('keeps the pull rule inside its limits', () => {
    const wire = '{"v":1,"l":[["A",0,[["Sol Ring",1]]]],"s":[[],[],0,500,-5]}';
    expect(fromWire(wire)?.settings?.pull).toEqual({ worthPullMinCards: 99, worthPullMinUsd: 0 });
  });

  it('lowercases set codes', () => {
    const wire = '{"v":1,"l":[["A",0,[["Sol Ring",1]]]],"s":[[["g","G",["CMM"]]],["KHM"],0,2,10]}';
    const s = fromWire(wire)!.settings!;
    expect(s.binderGroups[0].setCodes).toEqual(['cmm']);
    expect(s.notCarried).toEqual(['khm']);
  });
});
