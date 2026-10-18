import { describe, expect, it } from 'vitest';
import type { CardSummary, FuzzyResult } from '../connector';
import { createList, addEntries } from '../lists';
import { combineEntries, parseDecklist } from '../parse/parseDecklist';
import {
  checkPaste, chooseCard, chunkForLimit, keepFirst, needsFixing, noneMatched, overLimit, pickCandidate, removeLine, resetStatuses, resolutionCounts,
  resolveLines, resolvedEntries, setAll, setStatus, splitByWishlist, statusCounts, statusOf, toIncoming, undoFix,
} from './index';

const NO_SECTIONS = { sideboard: false, maybeboard: false };
const card = (id: string, name: string): CardSummary => ({
  id, oracleId: 'o-' + id, name, typeLine: 'Artifact', colors: [], imageSmall: null, imageNormal: null, sourceUri: '', printingsUri: '',
});
const NOW = new Date('2026-10-18T12:00:00Z');
const entriesOf = (text: string) => combineEntries(parseDecklist(text).entries, NO_SECTIONS);

describe('checkPaste', () => {
  it('says empty for blanks and nothing', () => {
    expect(checkPaste('', NO_SECTIONS)).toEqual({ status: 'empty' });
    expect(checkPaste('  \n \t\n', NO_SECTIONS)).toEqual({ status: 'empty' });
  });

  it('says no names when no line looks like a card', () => {
    expect(checkPaste('0 Sol Ring\n0 Cultivate', NO_SECTIONS)).toEqual({ status: 'no_names' });
  });

  it('reads cards, combining a card listed twice and saying so', () => {
    const result = checkPaste('1 Cultivate\n1 Sol Ring\n1 Cultivate', NO_SECTIONS);
    expect(result).toMatchObject({ status: 'ready', combined: [{ name: 'Cultivate', times: 2, quantity: 2 }] });
    if (result.status === 'ready') expect(result.entries.map(e => [e.name, e.quantity])).toEqual([['Cultivate', 2], ['Sol Ring', 1]]);
  });

  it('counts copies in each section and leaves out sections that are off', () => {
    const text = '1 Sol Ring\n2 Command Tower\nSIDEBOARD:\n1 Swords to Plowshares\nMAYBEBOARD:\n1 Path to Exile';
    const off = checkPaste(text, NO_SECTIONS);
    expect(off).toMatchObject({ status: 'ready', sections: { main: 3, sideboard: 1, maybeboard: 1 } });
    if (off.status === 'ready') expect(off.entries.map(e => e.name)).toEqual(['Sol Ring', 'Command Tower']);
    const on = checkPaste(text, { sideboard: true, maybeboard: true });
    if (on.status === 'ready') expect(on.entries.map(e => e.name)).toEqual(['Sol Ring', 'Command Tower', 'Swords to Plowshares', 'Path to Exile']);
  });

  it('does not report a duplicate that sits in a section that is off', () => {
    const result = checkPaste('1 Sol Ring\nSIDEBOARD:\n1 Sol Ring', NO_SECTIONS);
    expect(result).toMatchObject({ status: 'ready', combined: [] });
  });

  it('says so when the only cards are in sections that are off', () => {
    expect(checkPaste('SIDEBOARD:\n1 Sol Ring', NO_SECTIONS)).toMatchObject({ status: 'nothing_included', sections: { sideboard: 1 } });
  });

  it('drops set codes, numbers and foil tags', () => {
    const result = checkPaste('1 Lightning Greaves (CMM) 410\n1 Sol Ring *F*', NO_SECTIONS);
    if (result.status === 'ready') expect(result.entries.map(e => e.name)).toEqual(['Lightning Greaves', 'Sol Ring']);
  });
});

describe('resolveLines', () => {
  const SOL = card('1', 'Sol Ring');
  const PRIDE = card('2', "Ajani's Pridemate");
  const entries = entriesOf('1 Sol Ring\n1 Ajanis Pridemate\n1 Archangel\n1 Zuran Orb Tribal\n1 Totally Unknown');
  const fuzzy = new Map<string, FuzzyResult>([
    ['Ajanis Pridemate', { status: 'match', card: PRIDE }],
    ['Archangel', { status: 'ambiguous', candidates: [card('3', 'Archangel of Thune'), card('4', 'Archangel Avacyn')] }],
    ['Zuran Orb Tribal', { status: 'none' }],
  ]);
  const lines = resolveLines(entries, [{ requested: 'Sol Ring', card: SOL }], fuzzy);

  it('sorts each name into exact, fixed, pick or missing, in pasted order', () => {
    expect(lines.map(l => [l.requested, l.state])).toEqual([
      ['Sol Ring', 'exact'], ['Ajanis Pridemate', 'fixed'], ['Archangel', 'pick'], ['Zuran Orb Tribal', 'missing'], ['Totally Unknown', 'missing'],
    ]);
    expect(lines[1].card?.name).toBe("Ajani's Pridemate");
    expect(lines[2].candidates).toHaveLength(2);
  });

  it('counts each kind for the step 3 heading', () => {
    expect(resolutionCounts(lines)).toEqual({ exact: 1, fixed: 1, chosen: 0, pick: 1, missing: 2 });
  });

  it('treats an ambiguous answer with no candidates as missing', () => {
    const out = resolveLines(entriesOf('1 Frog'), [], new Map([['Frog', { status: 'ambiguous', candidates: [] }]]));
    expect(out[0].state).toBe('missing');
  });

  it('says nothing matched when no pasted name found a card, which is how a paste of plain sentences shows up', () => {
    const prose = resolveLines(entriesOf('Check out my new deck!!'), [], new Map());
    expect(prose.map(l => l.state)).toEqual(['missing']);
    expect(noneMatched(prose)).toBe(true);
    expect(noneMatched(lines)).toBe(false);
    expect(noneMatched([])).toBe(false);
  });

  it('only needs step 3 when something is not an exact match', () => {
    expect(needsFixing(lines)).toBe(true);
    expect(needsFixing(resolveLines(entriesOf('1 Sol Ring'), [{ requested: 'Sol Ring', card: SOL }], new Map()))).toBe(false);
  });

  it('picking a candidate chooses that card and keeps quantity and tags', () => {
    const picked = pickCandidate(resolveLines(entriesOf('2 Archangel #angels'), [], fuzzy), 'archangel', '4');
    expect(picked[0]).toMatchObject({ state: 'chosen', quantity: 2, tags: ['angels'], card: { name: 'Archangel Avacyn' } });
    expect(picked[0].candidates).toBeUndefined();
  });

  it('ignores a pick that is not one of the candidates', () => {
    expect(pickCandidate(lines, 'archangel', 'nope')[2].state).toBe('pick');
  });

  it('choosing a card fixes a missing name', () => {
    const chosen = chooseCard(lines, 'zuran orb tribal', card('9', 'Zuran Orb'));
    expect(chosen[3]).toMatchObject({ state: 'chosen', card: { name: 'Zuran Orb' } });
  });

  it('undo on a fixed spelling sends it back to the pasted name, needing help', () => {
    const undone = undoFix(lines, 'ajanis pridemate');
    expect(undone[1]).toMatchObject({ state: 'missing', requested: 'Ajanis Pridemate' });
    expect(undone[1].card).toBeUndefined();
  });

  it('undo does nothing to a line that was not fixed for the player', () => {
    expect(undoFix(lines, 'sol ring')[0].state).toBe('exact');
  });

  it('removing a line leaves it out', () => {
    expect(removeLine(lines, 'zuran orb tribal').map(l => l.requested)).not.toContain('Zuran Orb Tribal');
  });

  it('leaves unresolved names out of the finished entries', () => {
    expect(resolvedEntries(lines).map(e => e.name)).toEqual(['Sol Ring', "Ajani's Pridemate"]);
  });

  it('combines two pasted names that are one card, adding quantities and merging tags', () => {
    const fire = card('7', 'Fire // Ice');
    const out = resolvedEntries(resolveLines(
      entriesOf('1 Fire #a\n2 Fire // Ice #b'),
      [{ requested: 'Fire', card: fire }, { requested: 'Fire // Ice', card: fire }],
      new Map(),
    ));
    expect(out).toEqual([{ cardKey: 'fire // ice', name: 'Fire // Ice', quantity: 3, tags: ['a', 'b'], card: fire }]);
  });

  it('does not change the lines it is given', () => {
    const before = JSON.stringify(lines);
    pickCandidate(lines, 'archangel', '3'); undoFix(lines, 'ajanis pridemate'); removeLine(lines, 'sol ring');
    expect(JSON.stringify(lines)).toBe(before);
  });
});

describe('statuses at import', () => {
  const entries = resolvedEntries(resolveLines(entriesOf('1 Sol Ring\n1 Command Tower\n1 Cultivate'), [
    { requested: 'Sol Ring', card: card('1', 'Sol Ring') }, { requested: 'Command Tower', card: card('2', 'Command Tower') }, { requested: 'Cultivate', card: card('3', 'Cultivate') },
  ], new Map()));

  it('starts everything as needed', () => {
    expect(statusCounts(entries, resetStatuses())).toEqual({ needed: 3, in_collection: 0, ordered: 0, proxy: 0, out_of_deck: 0 });
  });

  it('sets one card, and setting it back to needed forgets it', () => {
    const owned = setStatus(resetStatuses(), 'sol ring', 'in_collection');
    expect(statusOf(owned, 'sol ring')).toBe('in_collection');
    expect(statusCounts(entries, owned)).toMatchObject({ needed: 2, in_collection: 1 });
    expect(setStatus(owned, 'sol ring', 'needed').size).toBe(0);
  });

  it('sets all, and resets to needed', () => {
    expect(statusCounts(entries, setAll(entries, 'proxy'))).toMatchObject({ proxy: 3, needed: 0 });
    expect(statusCounts(entries, resetStatuses())).toMatchObject({ needed: 3 });
  });

  it('puts the choices on the incoming entries', () => {
    const incoming = toIncoming(entries, setStatus(resetStatuses(), 'cultivate', 'ordered'));
    expect(incoming.map(i => [i.name, i.status])).toEqual([['Sol Ring', 'needed'], ['Command Tower', 'needed'], ['Cultivate', 'ordered']]);
  });
});

describe('the 250 limit and the wishlist', () => {
  const items = Array.from({ length: 412 }, (_, i) => ({ cardKey: 'c' + i }));

  it('is over only past 250 lines', () => {
    expect(overLimit(250)).toBe(false);
    expect(overLimit(251)).toBe(true);
  });

  it('splits 412 lines into 250 and 162, in order', () => {
    const parts = chunkForLimit(items);
    expect(parts.map(p => p.length)).toEqual([250, 162]);
    expect(parts[1][0].cardKey).toBe('c250');
  });

  it('keeps the first 250', () => {
    expect(keepFirst(items)).toHaveLength(250);
    expect(keepFirst(items)[249].cardKey).toBe('c249');
  });

  it('does not split a list that fits', () => {
    expect(chunkForLimit(items.slice(0, 10))).toHaveLength(1);
    expect(chunkForLimit([])).toEqual([]);
  });

  it('sets aside cards already on the wishlist', () => {
    const wishlist = addEntries(createList({ id: 'wishlist', kind: 'wishlist', name: 'Wishlist' }, NOW), [{ cardKey: 'sol ring', name: 'Sol Ring', quantity: 1 }], NOW).list;
    const incoming = [{ cardKey: 'sol ring' }, { cardKey: 'cultivate' }];
    expect(splitByWishlist(incoming, wishlist)).toEqual({ fresh: [{ cardKey: 'cultivate' }], already: [{ cardKey: 'sol ring' }] });
  });
});
