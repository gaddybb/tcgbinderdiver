import { describe, expect, it } from 'vitest';
import { NO_FILTERS, PRICE_FILTERS, filterCards, hasFilters, matchesPrice } from './cardFilter';
import type { CardFilters, FilterKeys } from './cardFilter';

const card = (name: string, price: number | null, color = 'White'): FilterKeys => ({ name, price, color });
const CARDS = [
  card("Ajani's Pridemate", 0.25), card('Cultivate', 0.99, 'Green'), card('Sol Ring', 1), card('Arcane Signet', 4.99, 'Colorless'),
  card('Heliod', 5), card('Archangel of Thune', 6.5), card('Online Only', null, 'Blue'),
];
const names = (filters: Partial<CardFilters>) => filterCards(CARDS, { ...NO_FILTERS, ...filters }, c => c).map(c => c.name);

describe('price bands', () => {
  it('has the four from the design', () => {
    expect(PRICE_FILTERS).toEqual(['any', 'under_1', '1_to_5', '5_up']);
  });
  it('Any price lets everything through, including a card with no price', () => {
    expect(matchesPrice(null, 'any')).toBe(true);
    expect(matchesPrice(0, 'any')).toBe(true);
  });
  it('Under $1 stops short of one dollar', () => {
    expect(matchesPrice(0, 'under_1')).toBe(true);
    expect(matchesPrice(0.99, 'under_1')).toBe(true);
    expect(matchesPrice(1, 'under_1')).toBe(false);
  });
  it('$1 to $5 starts at one dollar and stops short of five', () => {
    expect(matchesPrice(0.99, '1_to_5')).toBe(false);
    expect(matchesPrice(1, '1_to_5')).toBe(true);
    expect(matchesPrice(4.99, '1_to_5')).toBe(true);
    expect(matchesPrice(5, '1_to_5')).toBe(false);
  });
  it('$5 and up starts at five dollars', () => {
    expect(matchesPrice(4.99, '5_up')).toBe(false);
    expect(matchesPrice(5, '5_up')).toBe(true);
    expect(matchesPrice(120, '5_up')).toBe(true);
  });
  it('a card with no price is in no band', () => {
    for (const band of ['under_1', '1_to_5', '5_up'] as const) expect(matchesPrice(null, band)).toBe(false);
  });
});

describe('filterCards', () => {
  it('with no filters keeps everything, in order', () => {
    expect(names({})).toEqual(CARDS.map(c => c.name));
  });
  it('filters by price band', () => {
    expect(names({ price: 'under_1' })).toEqual(["Ajani's Pridemate", 'Cultivate']);
    expect(names({ price: '1_to_5' })).toEqual(['Sol Ring', 'Arcane Signet']);
    expect(names({ price: '5_up' })).toEqual(['Heliod', 'Archangel of Thune']);
  });
  it('filters by one or more colors', () => {
    expect(names({ colors: ['Green'] })).toEqual(['Cultivate']);
    expect(names({ colors: ['Green', 'Blue'] })).toEqual(['Cultivate', 'Online Only']);
  });
  it('searches by name, ignoring case and accents, and spaces around it', () => {
    expect(names({ query: '  ARCH ' })).toEqual(['Archangel of Thune']);
    expect(names({ query: 'ajání' })).toEqual(["Ajani's Pridemate"]);
  });
  it('combines every filter', () => {
    expect(names({ query: 'ar', price: '1_to_5', colors: ['Colorless'] })).toEqual(['Arcane Signet']);
    expect(names({ query: 'ar', price: '1_to_5', colors: ['White'] })).toEqual([]);
  });
  it('does not change the list it is given', () => {
    const before = [...CARDS];
    names({ price: '5_up' });
    expect(CARDS).toEqual(before);
  });
});

describe('hasFilters', () => {
  it('is false for none, and for a search of only spaces', () => {
    expect(hasFilters(NO_FILTERS)).toBe(false);
    expect(hasFilters({ ...NO_FILTERS, query: '   ' })).toBe(false);
  });
  it('is true when any filter is set', () => {
    expect(hasFilters({ ...NO_FILTERS, query: 'a' })).toBe(true);
    expect(hasFilters({ ...NO_FILTERS, price: 'under_1' })).toBe(true);
    expect(hasFilters({ ...NO_FILTERS, colors: ['Red'] })).toBe(true);
  });
});
