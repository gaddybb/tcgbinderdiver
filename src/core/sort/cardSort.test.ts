import { describe, expect, it } from 'vitest';
import { SORT_MODES, compareCollectorNumbers, sortCards } from './cardSort';
import type { SortKeys } from './cardSort';

const ORDER = ['White', 'Blue', 'Black', 'Red', 'Green', 'Multicolor', 'Colorless', 'Land'];
const card = (name: string, price: number | null = 1, collectorNumber: string | null = '1', color = 'White'): SortKeys => ({ name, price, collectorNumber, color });
const names = (items: SortKeys[], mode: Parameters<typeof sortCards>[1]) => sortCards(items, mode, k => k as SortKeys, ORDER).map(i => (i as SortKeys).name);

describe('sort modes', () => {
  it('has the four the design lists', () => {
    expect(SORT_MODES).toEqual(['alphabetical', 'price_desc', 'collector_number', 'color']);
  });
});

describe('alphabetical', () => {
  it('sorts by name, ignoring case and accents', () => {
    expect(names([card('soul Warden'), card('Ajani'), card('Éowyn'), card('Cultivate')], 'alphabetical')).toEqual(['Ajani', 'Cultivate', 'Éowyn', 'soul Warden']);
  });
  it('keeps equal names in their original order', () => {
    const a = { ...card('Same'), price: 1 }, b = { ...card('same'), price: 2 };
    expect(sortCards([b, a], 'alphabetical', k => k, ORDER)).toEqual([b, a]);
  });
});

describe('price, high to low', () => {
  it('puts the dearest first and unknown prices last', () => {
    expect(names([card('Cheap', 0.25), card('Unknown', null), card('Dear', 6.5), card('Mid', 1.5)], 'price_desc')).toEqual(['Dear', 'Mid', 'Cheap', 'Unknown']);
  });
  it('breaks ties by name', () => {
    expect(names([card('B', 1), card('A', 1), card('N', null), card('M', null)], 'price_desc')).toEqual(['A', 'B', 'M', 'N']);
  });
});

describe('collector number', () => {
  it('sorts numbers as numbers, not text', () => {
    expect(names([card('c', 1, '214'), card('a', 1, '24'), card('b', 1, '135')], 'collector_number')).toEqual(['a', 'b', 'c']);
  });
  it('puts a letter after its number, and numberless last', () => {
    expect(compareCollectorNumbers('135', '135a')).toBeLessThan(0);
    expect(compareCollectorNumbers('135a', '136')).toBeLessThan(0);
    expect(compareCollectorNumbers('12', '★12')).toBeLessThan(0);
    expect(compareCollectorNumbers('★12', null)).toBeLessThan(0);
    expect(compareCollectorNumbers(null, null)).toBe(0);
    expect(compareCollectorNumbers('a', 'b')).toBeLessThan(0);
  });
  it('breaks ties by name, and puts a missing number last', () => {
    expect(names([card('Z', 1, '5'), card('A', 1, '5'), card('N', 1, null)], 'collector_number')).toEqual(['A', 'Z', 'N']);
  });
});

describe('color', () => {
  it('follows store order, then collector number, then name', () => {
    const items = [
      card('Plains', 1, '90', 'Land'), card('Elf', 1, '227', 'Green'), card('Angel', 1, '5', 'White'), card('Bolt', 1, '120', 'Red'),
      card('Ajani', 1, '135', 'White'), card('Signet', 1, '334', 'Colorless'), card('Gold', 1, '10', 'Multicolor'), card('Island', 1, '88', 'Blue'),
    ];
    expect(names(items, 'color')).toEqual(['Angel', 'Ajani', 'Island', 'Bolt', 'Elf', 'Gold', 'Signet', 'Plains']);
  });
  it('puts an unknown category after the known ones', () => {
    expect(names([card('Odd', 1, '1', 'Sparkly'), card('Land', 1, '1', 'Land')], 'color')).toEqual(['Land', 'Odd']);
  });
});

describe('sortCards', () => {
  it('does not change the list it was given', () => {
    const input = [card('B'), card('A')];
    sortCards(input, 'alphabetical', k => k, ORDER);
    expect(input.map(i => i.name)).toEqual(['B', 'A']);
  });
  it('works on any items through the key function', () => {
    const rows = [{ title: 'Zed' }, { title: 'Ann' }];
    expect(sortCards(rows, 'alphabetical', r => card(r.title), ORDER).map(r => r.title)).toEqual(['Ann', 'Zed']);
  });
  it('handles an empty list', () => {
    expect(sortCards([], 'price_desc', k => k as SortKeys, ORDER)).toEqual([]);
  });
});
