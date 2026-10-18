import { describe, expect, it } from 'vitest';
import { addEntries, createList, setEntryStatus } from '../core/lists';
import { describeUpdated, joinNames, listSummaryLine } from './format';

const NOW = new Date('2026-10-17T12:00:00');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 3600 * 1000);

describe('joinNames', () => {
  it('reads like a sentence', () => {
    expect(joinNames([])).toBe('');
    expect(joinNames(['Lifegain Commander'])).toBe('Lifegain Commander');
    expect(joinNames(['Lifegain Commander', 'Wishlist'])).toBe('Lifegain Commander and Wishlist');
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B and C');
  });
});

describe('describeUpdated', () => {
  it('uses the words from the design', () => {
    expect(describeUpdated({ kind: 'today' })).toBe('Updated today');
    expect(describeUpdated({ kind: 'yesterday' })).toBe('Updated yesterday');
    expect(describeUpdated({ kind: 'days', n: 3 })).toBe('Updated 3 days ago');
    expect(describeUpdated({ kind: 'last_week' })).toBe('Updated last week');
    expect(describeUpdated({ kind: 'weeks', n: 3 })).toBe('Updated 3 weeks ago');
  });
  it('gives a date for an old list', () => {
    expect(describeUpdated({ kind: 'date', iso: '2026-01-05T12:00:00' })).toMatch(/^Updated .*2026/);
  });
});

describe('listSummaryLine', () => {
  const deckWith = (statuses: ('needed' | 'proxy')[], updated: Date) => {
    let list = createList({ id: 'd', kind: 'deck', name: 'Deck' }, updated);
    statuses.forEach((status, i) => {
      list = addEntries(list, [{ cardKey: `c${i}`, name: `Card ${i}`, quantity: 1 }], updated).list;
      list = setEntryStatus(list, `c${i}`, status, updated);
    });
    return list;
  };

  it('says how many are needed of the whole deck, and when it changed', () => {
    expect(listSummaryLine(deckWith(['needed', 'needed', 'proxy'], NOW), NOW)).toBe('2 needed of 3 · Updated today');
    expect(listSummaryLine(deckWith(['needed'], daysAgo(3)), NOW)).toBe('1 needed of 1 · Updated 3 days ago');
  });

  it('says just the number of cards for the wishlist', () => {
    const wish = addEntries(createList({ id: 'wishlist', kind: 'wishlist', name: 'Wishlist' }, daysAgo(8)), [{ cardKey: 'a', name: 'A', quantity: 1 }, { cardKey: 'b', name: 'B', quantity: 1 }], daysAgo(8)).list;
    expect(listSummaryLine(wish, NOW)).toBe('2 cards · Updated last week');
    const one = addEntries(createList({ id: 'wishlist', kind: 'wishlist', name: 'Wishlist' }, NOW), [{ cardKey: 'a', name: 'A', quantity: 1 }], NOW).list;
    expect(listSummaryLine(one, NOW)).toBe('1 card · Updated today');
  });

  it('handles an empty deck', () => {
    expect(listSummaryLine(createList({ id: 'd', kind: 'deck', name: 'Empty' }, NOW), NOW)).toBe('0 needed of 0 · Updated today');
  });
});
