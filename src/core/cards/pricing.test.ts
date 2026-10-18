import { describe, expect, it } from 'vitest';
import { pr } from '../engine/fixtures';
import { CARD_TTL_DAYS, isStale, lowestPrice, typicalOnline } from './pricing';
import type { CardRecord } from './types';

const NOW = new Date('2026-10-17T12:00:00Z');
const recordFetched = (iso: string): CardRecord => ({
  key: 'k',
  summary: { id: 'i', oracleId: 'o', name: 'N', typeLine: 'Creature', colors: [], imageSmall: null, imageNormal: null, sourceUri: 'u', printingsUri: 'p' },
  printings: [],
  fetchedAt: iso,
});
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 3600 * 1000).toISOString();

describe('isStale', () => {
  it('keeps card data for 7 days', () => {
    expect(CARD_TTL_DAYS).toBe(7);
    expect(isStale(recordFetched(daysAgo(0)), NOW)).toBe(false);
    expect(isStale(recordFetched(daysAgo(6.9)), NOW)).toBe(false);
    expect(isStale(recordFetched(daysAgo(7)), NOW)).toBe(true);
    expect(isStale(recordFetched(daysAgo(30)), NOW)).toBe(true);
  });
  it('can use another lifetime', () => {
    expect(isStale(recordFetched(daysAgo(2)), NOW, 1)).toBe(true);
    expect(isStale(recordFetched(daysAgo(2)), NOW, 3)).toBe(false);
  });
  it('treats a broken or future time as stale, so it gets fetched again', () => {
    expect(isStale(recordFetched('not a date'), NOW)).toBe(true);
    expect(isStale(recordFetched(new Date(NOW.getTime() + 1000).toISOString()), NOW)).toBe(true);
  });
});

describe('lowestPrice', () => {
  it('is the cheapest finish that has a price', () => {
    expect(lowestPrice(pr({ setCode: 'a', finishes: ['nonfoil', 'foil'], usd: '1.50', foil: '0.90' }))).toBe(0.9);
  });
  it('skips finishes without a price', () => {
    expect(lowestPrice(pr({ setCode: 'a', finishes: ['nonfoil', 'foil'], usd: null, foil: '3.00' }))).toBe(3);
  });
  it('ignores finishes the printing does not come in', () => {
    expect(lowestPrice(pr({ setCode: 'a', finishes: ['nonfoil'], usd: '2.00', foil: '0.10' }))).toBe(2);
  });
  it('is null when nothing has a price', () => {
    expect(lowestPrice(pr({ setCode: 'a', usd: null }))).toBeNull();
    expect(lowestPrice(pr({ setCode: 'a', usd: 'abc' }))).toBeNull();
  });
});

describe('typicalOnline', () => {
  const printingsAt = (...prices: (string | null)[]) => prices.map((usd, i) => pr({ setCode: 's' + i, usd }));

  it('is the middle price of an odd number of printings', () => {
    expect(typicalOnline(printingsAt('1.00', '5.00', '3.00'))).toBe(3);
  });
  it('is halfway between the two middle prices of an even number', () => {
    expect(typicalOnline(printingsAt('1.00', '2.00', '4.00', '9.00'))).toBe(3);
  });
  it('is not thrown off by a few collector printings, unlike an average', () => {
    // Four ordinary printings and two collector ones: the average would be over $175, the typical price is $1.75.
    expect(typicalOnline(printingsAt('1.00', '1.25', '1.50', '2.00', '400.00', '650.00'))).toBe(1.75);
    // Three ordinary and two collector printings: the typical price is the middle one, $1.50.
    expect(typicalOnline(printingsAt('1.00', '1.25', '1.50', '400.00', '650.00'))).toBe(1.5);
  });
  it('is the one price when there is only one', () => {
    expect(typicalOnline(printingsAt('0.25'))).toBe(0.25);
  });
  it('uses the cheapest finish of each printing', () => {
    expect(typicalOnline([pr({ setCode: 'a', finishes: ['nonfoil', 'foil'], usd: '2.00', foil: '0.50' })])).toBe(0.5);
  });
  it('leaves out printings with no price and printings not in paper', () => {
    const printings = [
      pr({ setCode: 'a', usd: '2.00' }),
      pr({ setCode: 'b', usd: null }),
      pr({ setCode: 'c', usd: '100.00', digital: true }),
      pr({ setCode: 'd', usd: '100.00', games: ['arena'] }),
    ];
    expect(typicalOnline(printings)).toBe(2);
  });
  it('is null when there is nothing to go on', () => {
    expect(typicalOnline([])).toBeNull();
    expect(typicalOnline(printingsAt(null, null))).toBeNull();
  });
  it('does not change the printings it was given', () => {
    const printings = printingsAt('3.00', '1.00', '2.00');
    typicalOnline(printings);
    expect(printings.map(p => p.prices.usd)).toEqual(['3.00', '1.00', '2.00']);
  });
});
