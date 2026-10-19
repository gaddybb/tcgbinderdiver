import { describe, expect, it } from 'vitest';
import { DEFAULT_PULL_SETTINGS, V1_STORE, buildPlan } from '../engine/engine';
import type { NeededCard } from '../engine/engine';
import { NOW, card, pr } from '../engine/fixtures';
import {
  DEFAULT_STORE_SETTINGS, addGroup, addSetToGroup, cardsInSets, commanderSets, deleteGroup, diveStops, groupByKind, isPullDefault, markNotCarried,
  placeOfSet, removeSetFromGroup, renameGroup, resetPull, setCombinedCommander, setIncludeBasicLands, setPullRule, setTypes, setsUsed, storeProfile, totalCards,
  unmarkNotCarried, verdictPreview,
} from './index';

const S = DEFAULT_STORE_SETTINGS;

describe('store settings: the profile', () => {
  it('is the fixed v1 store until the player sets something', () => {
    expect(storeProfile(S)).toEqual({ ...V1_STORE, hasCommanderSection: false });   // no combined Commander library until the player says so
  });

  it('carries the groups, not-carried sets and the basic lands switch', () => {
    const settings = setIncludeBasicLands(markNotCarried(addGroup(S, 'g1', 'Commander', ['cmm', 'FDC']), 'khm'), true);
    expect(storeProfile(settings)).toMatchObject({
      binderGroups: [{ id: 'g1', name: 'Commander', setCodes: ['cmm', 'fdc'] }], notCarried: ['khm'], includeBasicLands: true,
      displayCaseMin: 15, setBinderMaxAgeYears: 3,
    });
  });

  it('the combined Commander library switch turns the Commander box on', () => {
    expect(storeProfile(setCombinedCommander(S, true)).hasCommanderSection).toBe(true);
  });

  it('starts with no groups, nothing not carried, basics off and the default rule', () => {
    expect(S).toEqual({ binderGroups: [], notCarried: [], includeBasicLands: false, combinedCommander: false, pull: DEFAULT_PULL_SETTINGS });
    expect(isPullDefault(S)).toBe(true);
  });
});

describe('binder groups', () => {
  it('adds a group with a clean name, and sets inside it in lowercase', () => {
    const next = addGroup(S, 'g1', '  Commander   Box ', ['CMM', 'cmm']);
    expect(next.binderGroups).toEqual([{ id: 'g1', name: 'Commander Box', setCodes: ['cmm'] }]);
  });

  it('keeps a set in one place: adding it to a group takes it out of another group and out of not carried', () => {
    let s = addGroup(addGroup(S, 'a', 'A', ['fdn']), 'b', 'B');
    s = markNotCarried(s, 'khm');
    s = addSetToGroup(s, 'b', 'fdn');
    expect(s.binderGroups.map(g => [g.id, g.setCodes])).toEqual([['a', []], ['b', ['fdn']]]);
    s = addSetToGroup(s, 'b', 'KHM');
    expect(s.notCarried).toEqual([]);
    expect(s.binderGroups[1].setCodes).toEqual(['fdn', 'khm']);
  });

  it('marking a set not carried takes it out of its group', () => {
    const s = markNotCarried(addGroup(S, 'a', 'A', ['fdn', 'dsk']), 'FDN');
    expect(s.binderGroups[0].setCodes).toEqual(['dsk']);
    expect(s.notCarried).toEqual(['fdn']);
    expect(markNotCarried(s, 'fdn').notCarried).toEqual(['fdn']);   // not twice
  });

  it('can bring a set back from not carried, and out of a group', () => {
    let s = markNotCarried(S, 'khm');
    s = unmarkNotCarried(s, 'KHM');
    expect(s.notCarried).toEqual([]);
    s = removeSetFromGroup(addGroup(S, 'a', 'A', ['fdn', 'dsk']), 'a', 'fdn');
    expect(s.binderGroups[0].setCodes).toEqual(['dsk']);
  });

  it('renames and deletes a group, freeing its sets', () => {
    let s = addGroup(S, 'a', 'A', ['fdn']);
    s = renameGroup(s, 'a', '  New name ');
    expect(s.binderGroups[0].name).toBe('New name');
    s = deleteGroup(s, 'a');
    expect(s.binderGroups).toEqual([]);
    expect(placeOfSet(s, 'fdn')).toBeNull();
  });

  it('says where a set is', () => {
    const s = markNotCarried(addGroup(S, 'a', 'A', ['fdn']), 'khm');
    expect(placeOfSet(s, 'FDN')).toBe('a');
    expect(placeOfSet(s, 'khm')).toBe('not_carried');
    expect(placeOfSet(s, 'dsk')).toBeNull();
  });

  it('ignores adding to a group that does not exist, and does not change what it is given', () => {
    const before = JSON.stringify(S);
    expect(addSetToGroup(S, 'nope', 'fdn')).toBe(S);
    addGroup(S, 'a', 'A', ['fdn']); markNotCarried(S, 'x');
    expect(JSON.stringify(S)).toBe(before);
  });

  it('changes where the engine sends a card: a group makes sets share one binder, not carried skips a set', () => {
    const cards: NeededCard[] = [
      { key: 'a', copies: 1, card: card('A', [pr({ setCode: 'fdn', setName: 'Foundations', setType: 'core', releasedAt: '2026-06-01' })]) },
      { key: 'b', copies: 1, card: card('B', [pr({ setCode: 'dsk', setName: 'Duskmourn', setType: 'expansion', releasedAt: '2026-05-01' })]) },
    ];
    const alone = buildPlan(cards, storeProfile(S), NOW);
    expect(alone.stops.map(s => s.stop.label).sort()).toEqual(['Duskmourn', 'Foundations']);
    const grouped = buildPlan(cards, storeProfile(addGroup(S, 'g', 'Recent', ['fdn', 'dsk'])), NOW);
    expect(grouped.stops.map(s => [s.stop.label, s.copies])).toEqual([['Recent', 2]]);
    const skipped = buildPlan(cards, storeProfile(markNotCarried(S, 'fdn')), NOW);
    expect(skipped.noStop).toEqual(['a']);
  });
});

describe('the worth-a-pull rule and basics', () => {
  it('changes by whole numbers within limits', () => {
    expect(setPullRule(S, { worthPullMinCards: 3, worthPullMinUsd: 20 }).pull).toEqual({ worthPullMinCards: 3, worthPullMinUsd: 20 });
    expect(setPullRule(S, { worthPullMinCards: 0 }).pull.worthPullMinCards).toBe(1);
    expect(setPullRule(S, { worthPullMinCards: 500 }).pull.worthPullMinCards).toBe(99);
    expect(setPullRule(S, { worthPullMinUsd: -4 }).pull.worthPullMinUsd).toBe(0);
    expect(setPullRule(S, { worthPullMinUsd: 2.6 }).pull.worthPullMinUsd).toBe(3);
  });

  it('changing one value leaves the other', () => {
    expect(setPullRule(S, { worthPullMinUsd: 5 }).pull).toEqual({ worthPullMinCards: 2, worthPullMinUsd: 5 });
  });

  it('resets to the defaults, and knows when it is on them', () => {
    const changed = setPullRule(S, { worthPullMinCards: 5 });
    expect(isPullDefault(changed)).toBe(false);
    expect(isPullDefault(resetPull(changed))).toBe(true);
    expect(isPullDefault(setIncludeBasicLands(S, true))).toBe(false);
  });
});

describe('sets used by the needed cards', () => {
  const cards = [
    { printings: [pr({ setCode: 'fdn', setName: 'Foundations', setType: 'core' }), pr({ setCode: 'cmm', setName: 'Commander Masters', setType: 'commander' }), pr({ setCode: 'cmm', setName: 'Commander Masters', setType: 'commander' })] },
    { printings: [pr({ setCode: 'cmm', setName: 'Commander Masters', setType: 'commander' }), pr({ setCode: 'fdc', setName: 'Foundations Commander', setType: 'commander' })] },
    { printings: [pr({ setCode: 'fdn', setName: 'Foundations', setType: 'core' }), pr({ setCode: 'xyz', digital: true })] },
  ];

  it('counts each needed card once per set, most cards first, then by name', () => {
    expect(setsUsed(cards)).toEqual([
      { code: 'cmm', name: 'Commander Masters', setType: 'commander', neededCards: 2 },
      { code: 'fdn', name: 'Foundations', setType: 'core', neededCards: 2 },
      { code: 'fdc', name: 'Foundations Commander', setType: 'commander', neededCards: 1 },
    ]);
  });

  it('leaves out digital printings', () => {
    expect(setsUsed(cards).some(s => s.code === 'xyz')).toBe(false);
  });

  it('counts a binder\'s cards once even when they are in several of its sets', () => {
    expect(cardsInSets(cards, ['cmm', 'fdc'])).toBe(2);
    expect(cardsInSets(cards, ['fdn'])).toBe(2);
    expect(cardsInSets(cards, [])).toBe(0);
    expect(cardsInSets(cards, ['FDN', 'CMM'])).toBe(3);
  });

  it('finds the commander sets and the set types', () => {
    expect(commanderSets(setsUsed(cards)).map(s => s.code)).toEqual(['cmm', 'fdc']);
    expect(setTypes(setsUsed(cards))).toEqual(['commander', 'core']);
  });

  it('is empty for no cards', () => {
    expect(setsUsed([])).toEqual([]);
  });
});

describe('the dive plan view', () => {
  const recent = (code: string, name: string, over: Partial<Parameters<typeof pr>[0]> = {}) => pr({ setCode: code, setName: name, setType: 'core', releasedAt: '2026-06-01', ...over });
  const needed: NeededCard[] = [
    { key: 'a', copies: 3, card: card('A', [recent('fdn', 'Foundations', { usd: '1.00' })]) },
    { key: 'b', copies: 1, card: card('B', [recent('dsk', 'Duskmourn', { usd: '2.00' })]) },
    { key: 'c', copies: 1, card: card('C', [pr({ setCode: 'fdc', setType: 'commander', usd: '1.00' })]) },
    { key: 'd', copies: 1, card: card('D', [pr({ setCode: 'rna', setType: 'expansion', releasedAt: '2019-01-25', usd: '20.00' })]) },
    { key: 'e', copies: 2, card: card('E', [pr({ setCode: 'old', setType: 'expansion', releasedAt: '2010-01-01', usd: '0.30' })]) },
  ];
  const plan = buildPlan(needed, V1_STORE, NOW);
  const stops = diveStops(plan, DEFAULT_PULL_SETTINGS);

  it('lists stops in walking order with copies, value and verdict', () => {
    expect(stops.map(s => [s.label, s.cards, Math.round(s.value * 100) / 100, s.verdict])).toEqual([
      ['Foundations', 3, 3, 'worth_a_pull'],
      ['Duskmourn', 1, 2, 'buy_online'],
      ['Commander box', 1, 1, 'buy_online'],
      ['Display case', 1, 20, 'show_staff'],
      ['Ask an associate', 2, 0.6, 'show_staff'],
    ]);
    expect(totalCards(stops)).toBe(8);
  });

  it('groups by stop type, keeping order', () => {
    expect(groupByKind(stops).map(g => [g.kind, g.stops.length])).toEqual([['set_binder', 2], ['commander_box', 1], ['display_case', 1], ['ask_associate', 1]]);
    expect(groupByKind([])).toEqual([]);
  });

  it('previews how many flip stops are worth a pull under a rule, live', () => {
    expect(verdictPreview(stops)).toEqual({ worth: 1, buyOnline: 2 });
    const strict = diveStops(plan, { worthPullMinCards: 5, worthPullMinUsd: 50 });
    expect(verdictPreview(strict)).toEqual({ worth: 0, buyOnline: 3 });
    const loose = diveStops(plan, { worthPullMinCards: 1, worthPullMinUsd: 0 });
    expect(verdictPreview(loose)).toEqual({ worth: 3, buyOnline: 0 });
  });

  it('never changes where a card goes (the verdict is only a label)', () => {
    const strict = buildPlan(needed, V1_STORE, NOW);
    expect([...strict.assignment]).toEqual([...plan.assignment]);
  });
});
