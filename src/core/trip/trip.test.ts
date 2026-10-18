import { describe, expect, it } from 'vitest';
import type { CardRecord } from '../cards/types';
import { V1_STORE } from '../engine/engine';
import type { Printing } from '../engine/engine';
import { NOW, pr } from '../engine/fixtures';
import { addEntries, createList, setEntryStatus } from '../lists';
import type { CardList } from '../lists';
import {
  clearNotAvailable, endTrip, finishBinder, finishedStops, foundCopies, fullyFound, markAllFound, markFound, markNotAvailable, massEntryText,
  remainingCopies, reopenBinder, setListOn, startTrip, stopLabel, tripCards, tripPlan, tripSummary, undoAllFound, undoFound,
} from './index';

const recent = (setCode: string, setName: string, over: Partial<Parameters<typeof pr>[0]> = {}): Printing =>
  pr({ setCode, setName, setType: 'core', releasedAt: '2026-06-01', usd: '1.00', ...over });

const record = (key: string, name: string, printings: Printing[], typeLine = 'Creature'): CardRecord => ({
  key,
  summary: { id: key, oracleId: key, name, typeLine, colors: [], imageSmall: null, imageNormal: null, sourceUri: 'u', printingsUri: 'p' },
  printings,
  fetchedAt: NOW.toISOString(),
});

// a and b are at Foundations, c only in the Commander box. 'a' is also in the Commander box as a second choice.
const RECORDS = new Map([
  record('a', 'Ajani', [recent('fdn', 'Foundations'), pr({ setCode: 'fdc', setType: 'commander', rarity: 'mythic', usd: '1.00' })]),
  record('b', 'Soul Warden', [recent('fdn', 'Foundations')]),
  record('c', 'Command Tower', [pr({ setCode: 'fdc', setType: 'commander', usd: '0.40' })]),
  record('d', 'Greaves', [pr({ setCode: 'rna', setType: 'expansion', releasedAt: '2019-01-25', usd: '18.00' })]),
].map(r => [r.key, r]));

const list = (id: string, ...cards: [key: string, quantity?: number][]): CardList => {
  let l = createList({ id, kind: 'deck', name: id.toUpperCase() }, NOW);
  l = addEntries(l, cards.map(([cardKey, quantity = 1]) => ({ cardKey, name: cardKey, quantity })), NOW).list;
  return { ...l, inNextDive: true };
};

const LISTS = [list('x', ['a', 2], ['b'], ['c']), list('y', ['a', 1], ['d'])];

function setup(listIds: string[] = ['x', 'y']) {
  const trip = startTrip('t1', NOW, listIds);
  const { needed, parts } = tripCards(LISTS, trip, RECORDS);
  return { trip, needed, parts, plan: () => tripPlan(needed, V1_STORE, NOW, trip) };
}

describe('trip cards', () => {
  it('merges the lists in the trip, each card once with every copy and the per-list split', () => {
    const { needed, parts } = setup();
    expect(needed.map(n => [n.key, n.copies]).sort()).toEqual([['a', 3], ['b', 1], ['c', 1], ['d', 1]]);
    expect(parts.get('a')!.parts.map(p => [p.listId, p.quantity])).toEqual([['x', 2], ['y', 1]]);
  });

  it('leaves out lists that are off, and cards that are not needed', () => {
    const owned = [setEntryStatus(LISTS[0], 'b', 'in_collection', NOW), LISTS[1]];
    const trip = startTrip('t', NOW, ['x']);
    const { needed } = tripCards(owned, trip, RECORDS);
    expect(needed.map(n => n.key).sort()).toEqual(['a', 'c']);
    expect(needed.find(n => n.key === 'a')!.copies).toBe(2);
  });

  it('skips cards whose data has not loaded', () => {
    const trip = startTrip('t', NOW, ['x']);
    const some = new Map([...RECORDS].filter(([k]) => k !== 'a'));
    expect(tripCards(LISTS, trip, some).needed.map(n => n.key).sort()).toEqual(['b', 'c']);
  });

  it('turns a list on or off, keeping the lists in order', () => {
    const t = startTrip('t', NOW, ['x']);
    expect(setListOn(t, 'y', true, ['x', 'y']).listIds).toEqual(['x', 'y']);
    expect(setListOn(setListOn(t, 'y', true, ['x', 'y']), 'x', false, ['x', 'y']).listIds).toEqual(['y']);
    expect(setListOn(t, 'x', true, ['x', 'y'])).toBe(t);
    expect(setListOn(startTrip('t', NOW, ['y']), 'x', true, ['x', 'y']).listIds).toEqual(['x', 'y']);
  });
});

describe('finding cards', () => {
  it('Found +1 fills the lists top to bottom', () => {
    const { trip, parts } = setup();
    const a = parts.get('a')!;
    let t = markFound(trip, a);
    expect(t.found.a).toEqual({ x: 1 });
    t = markFound(t, a);
    expect(t.found.a).toEqual({ x: 2 });
    t = markFound(t, a);
    expect(t.found.a).toEqual({ x: 2, y: 1 });
    expect(foundCopies(t, a)).toBe(3);
    expect(remainingCopies(t, a)).toBe(0);
  });

  it('does nothing once every copy is found', () => {
    const { trip, parts } = setup();
    const done = markAllFound(trip, parts.get('a')!);
    expect(markFound(done, parts.get('a')!)).toBe(done);
  });

  it('Undo takes back the last copy found, from the bottom-most list', () => {
    const { trip, parts } = setup();
    const a = parts.get('a')!;
    const all = markAllFound(trip, a);
    const one = undoFound(all, a);
    expect(one.found.a).toEqual({ x: 2, y: 0 });
    expect(foundCopies(one, a)).toBe(2);
    expect(undoFound(trip, a)).toBe(trip);
    expect(foundCopies(undoAllFound(all, a), a)).toBe(0);
  });

  it('counts only lists that are on', () => {
    const { trip, parts } = setup();
    const all = markAllFound(trip, parts.get('a')!);
    const onlyX = tripCards(LISTS, { ...all, listIds: ['x'] }, RECORDS).parts.get('a')!;
    expect(foundCopies(all, onlyX)).toBe(2);
    expect(remainingCopies(all, onlyX)).toBe(0);
  });

  it('knows which cards are fully found', () => {
    const { trip, parts } = setup();
    const t = markFound(markAllFound(trip, parts.get('b')!), parts.get('a')!);
    expect([...fullyFound(t, parts)]).toEqual(['b']);
  });

  it('marks a card not available, and finding it clears that', () => {
    const { trip, parts } = setup();
    const t = markNotAvailable(trip, 'd');
    expect(t.notAvailable).toEqual(['d']);
    expect(markNotAvailable(t, 'd')).toBe(t);
    expect(markFound(t, parts.get('d')!).notAvailable).toEqual([]);
    expect(clearNotAvailable(t, 'd').notAvailable).toEqual([]);
  });

  it('does not change the trip it is given', () => {
    const { trip, parts } = setup();
    const before = JSON.stringify(trip);
    markFound(trip, parts.get('a')!); markNotAvailable(trip, 'a'); finishBinder(trip, 'set:fdn', parts);
    expect(JSON.stringify(trip)).toBe(before);
  });
});

describe('the plan during a trip', () => {
  it('starts as the engine plan for the trip\'s cards', () => {
    const { plan } = setup();
    expect(plan().stops.map(s => [s.stop.id, s.copies])).toEqual([['set:fdn', 4], ['commander', 1], ['case', 1]]);
  });

  it('Finish binder moves the copies not found to their next binder, and found cards leave', () => {
    const { trip, needed, parts } = setup();
    const t = finishBinder(markAllFound(trip, parts.get('b')!), 'set:fdn', parts);
    const plan = tripPlan(needed, V1_STORE, NOW, t);
    expect(plan.stops.map(s => s.stop.id)).toEqual(['commander', 'case']);
    expect(plan.assignment.get('a')).toBe('commander');
    expect(plan.assignment.has('b')).toBe(false);
    expect(finishedStops(t)).toEqual(['set:fdn']);
  });

  it('keeps the order of binders frozen, and Reopen brings the unfound copies back to their place', () => {
    const { trip, needed, parts } = setup();
    const finished = finishBinder(trip, 'set:fdn', parts);
    const reopened = reopenBinder(finished, 'set:fdn', parts);
    const plan = tripPlan(needed, V1_STORE, NOW, reopened);
    expect(plan.stops.map(s => s.stop.id)).toEqual(['set:fdn', 'commander', 'case']);
    expect(plan.assignment.get('a')).toBe('set:fdn');
    expect(finishedStops(reopened)).toEqual([]);
  });

  it('a card found at a finished binder stays found when it is reopened', () => {
    const { trip, needed, parts } = setup();
    const found = markAllFound(trip, parts.get('b')!);
    const t = reopenBinder(finishBinder(found, 'set:fdn', parts), 'set:fdn', parts);
    expect(tripPlan(needed, V1_STORE, NOW, t).assignment.has('b')).toBe(false);
  });

  it('names a binder that was finished and has no cards left', () => {
    const { trip, needed, parts } = setup();
    const t = finishBinder(trip, 'set:fdn', parts);
    const plan = tripPlan(needed, V1_STORE, NOW, t);
    expect(stopLabel(plan, 'set:fdn')).toBe('Foundations');
    expect(stopLabel(plan, 'nope')).toBeUndefined();
  });

  it('rebuilding from the same events gives the same plan', () => {
    const { trip, needed, parts } = setup();
    const t = finishBinder(finishBinder(trip, 'set:fdn', parts), 'commander', parts);
    const a = tripPlan(needed, V1_STORE, NOW, t);
    const b = tripPlan(needed, V1_STORE, NOW, JSON.parse(JSON.stringify(t)));
    expect([...a.assignment]).toEqual([...b.assignment]);
    expect(a.order).toEqual(b.order);
  });

  it('a card with no next binder ends up with no binder when its last binder is finished', () => {
    const { trip, needed, parts } = setup();
    const t = finishBinder(trip, 'case', parts);
    expect(tripPlan(needed, V1_STORE, NOW, t).noStop).toContain('d');
  });
});

describe('the end of a trip', () => {
  it('counts what was found, the binders searched, and what is left in list order', () => {
    const { trip, needed, parts } = setup();
    let t = markFound(markAllFound(trip, parts.get('b')!), parts.get('a')!);
    t = finishBinder(t, 'set:fdn', parts);
    const summary = tripSummary(t, tripPlan(needed, V1_STORE, NOW, t), parts);
    expect(summary.foundCopies).toBe(2);
    expect(summary.searched).toBe(1);
    expect(summary.stops).toBe(3);
    expect(summary.left).toEqual([
      { cardKey: 'a', name: 'a', copies: 2 }, { cardKey: 'c', name: 'c', copies: 1 }, { cardKey: 'd', name: 'd', copies: 1 },
    ]);
    expect(summary.leftCopies).toBe(4);
  });

  it('leaves basic lands that are off the hunt out of what is left', () => {
    const records = new Map([...RECORDS, ...[record('f', 'Forest', [recent('fdn', 'Foundations')], 'Basic Land — Forest')].map(r => [r.key, r] as const)]);
    const lists = [list('x', ['b'], ['f', 3])];
    const trip = startTrip('t', NOW, ['x']);
    const { needed, parts } = tripCards(lists, trip, records);
    const summary = tripSummary(trip, tripPlan(needed, V1_STORE, NOW, trip), parts);
    expect(summary.left.map(l => l.cardKey)).toEqual(['b']);
    expect(summary.leftCopies).toBe(1);
  });

  it('writes the leftovers as quantity and name lines for TCGplayer Mass Entry', () => {
    expect(massEntryText([{ name: 'Sol Ring', copies: 1 }, { name: 'Path to Exile', copies: 3 }])).toBe('1 Sol Ring\n3 Path to Exile');
    expect(massEntryText([])).toBe('');
  });

  it('ends a trip once, with the time it ended', () => {
    const { trip } = setup();
    const ended = endTrip(trip, NOW);
    expect(ended.endedAt).toBe(NOW.toISOString());
    expect(endTrip(ended, new Date('2030-01-01'))).toBe(ended);
  });
});
