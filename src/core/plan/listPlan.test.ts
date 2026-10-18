import { describe, expect, it } from 'vitest';
import { V1_STORE } from '../engine/engine';
import { NOW, pr } from '../engine/fixtures';
import { addEntries, createList, setEntryStatus, setInNextDive } from '../lists';
import type { CardList } from '../lists';
import type { CardRecord } from '../cards/types';
import { planLists } from './listPlan';
import type { Printing } from '../engine/engine';

const record = (key: string, name: string, printings: Printing[], typeLine = 'Creature'): CardRecord => ({
  key,
  summary: { id: key, oracleId: key, name, typeLine, colors: [], imageSmall: null, imageNormal: null, sourceUri: 'u', printingsUri: 'p' },
  printings,
  fetchedAt: NOW.toISOString(),
});
const recordsOf = (...rs: CardRecord[]) => new Map(rs.map(r => [r.key, r]));
const deck = (id: string, ...cards: [key: string, quantity?: number][]): CardList =>
  addEntries(createList({ id, kind: 'deck', name: id }, NOW), cards.map(([cardKey, quantity = 1]) => ({ cardKey, name: cardKey, quantity })), NOW).list;

const recentSet = (over: Parameters<typeof pr>[0]) => pr({ setType: 'core', releasedAt: '2026-06-01', ...over });

describe('planLists', () => {
  it('gives each card the binder it is planned for, with the printing found there', () => {
    const records = recordsOf(
      record('ajani', "Ajani's Pridemate", [recentSet({ setCode: 'fdn', setName: 'Foundations', collectorNumber: '135', usd: '0.25' })]),
      record('tower', 'Command Tower', [pr({ setCode: 'fdc', setType: 'commander', collectorNumber: '352', usd: '0.35' })]),
    );
    const { targets } = planLists([deck('a', ['ajani'], ['tower'])], records, V1_STORE, NOW);
    expect(targets.get('ajani')).toEqual({ kind: 'stop', stopId: 'set:fdn', stopLabel: 'Foundations', stopKind: 'set_binder', setCode: 'fdn', collectorNumber: '135', finish: 'nonfoil', price: 0.25 });
    expect(targets.get('tower')).toMatchObject({ kind: 'stop', stopId: 'commander', stopLabel: 'Commander box', stopKind: 'commander_box', setCode: 'fdc', collectorNumber: '352' });
  });

  it('sends an expensive card to the display case, which is where the staff look', () => {
    const records = recordsOf(record('greaves', 'Lightning Greaves', [pr({ setCode: 'rna', releasedAt: '2019-01-25', rarity: 'rare', collectorNumber: '9', usd: '18.50' })]));
    expect(planLists([deck('a', ['greaves'])], records, V1_STORE, NOW).targets.get('greaves')).toMatchObject({ kind: 'stop', stopId: 'case', stopKind: 'display_case', price: 18.5 });
  });

  it('plans a card on several lists once, with every copy', () => {
    const records = recordsOf(record('elves', 'Llanowar Elves', [recentSet({ setCode: 'fdn', collectorNumber: '227' })]));
    const { plan, targets } = planLists([deck('a', ['elves', 3]), deck('b', ['elves', 1])], records, V1_STORE, NOW);
    expect(targets.size).toBe(1);
    expect(plan.stops[0].cards).toHaveLength(1);
    expect(plan.stops[0].copies).toBe(4);
  });

  it('leaves out a card whose data is missing, so it has no target yet', () => {
    const records = recordsOf(record('a', 'A', [recentSet({ setCode: 'fdn' })]));
    const { targets } = planLists([deck('x', ['a'], ['missing'])], records, V1_STORE, NOW);
    expect(targets.has('a')).toBe(true);
    expect(targets.has('missing')).toBe(false);
  });

  it('only plans cards that are still needed', () => {
    const records = recordsOf(record('a', 'A', [recentSet({ setCode: 'fdn' })]), record('b', 'B', [recentSet({ setCode: 'fdn' })]));
    const list = setEntryStatus(deck('x', ['a'], ['b']), 'b', 'in_collection', NOW);
    const { targets } = planLists([list], records, V1_STORE, NOW);
    expect([...targets.keys()]).toEqual(['a']);
  });

  it('only plans lists that are switched on', () => {
    const records = recordsOf(record('a', 'A', [recentSet({ setCode: 'fdn' })]));
    const off = setInNextDive(deck('x', ['a']), false);
    expect(planLists([off], records, V1_STORE, NOW).targets.size).toBe(0);
  });

  it('marks a basic land as skipped, since basics are off the hunt', () => {
    const records = recordsOf(record('forest', 'Forest', [recentSet({ setCode: 'fdn' })], 'Basic Land — Forest'));
    expect(planLists([deck('x', ['forest'])], records, V1_STORE, NOW).targets.get('forest')).toEqual({ kind: 'skipped_basic' });
  });

  it('marks a card with no paper printing as having no binder', () => {
    const records = recordsOf(record('online', 'Online Only', [pr({ setCode: 'ymid', digital: true, games: ['arena'] })]));
    expect(planLists([deck('x', ['online'])], records, V1_STORE, NOW).targets.get('online')).toEqual({ kind: 'no_binder' });
  });

  it('plans nothing when there are no cards', () => {
    const result = planLists([], new Map(), V1_STORE, NOW);
    expect(result.targets.size).toBe(0);
    expect(result.plan.stops).toEqual([]);
  });

  it('follows the store profile', () => {
    const records = recordsOf(record('a', 'A', [recentSet({ setCode: 'fdn' })]));
    const noBinders = { ...V1_STORE, usesSetBinders: false };
    expect(planLists([deck('x', ['a'])], records, noBinders, NOW).targets.get('a')).toMatchObject({ stopKind: 'ask_associate', stopLabel: 'Ask an associate' });
  });
});
