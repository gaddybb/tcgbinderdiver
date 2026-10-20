import { describe, expect, it } from 'vitest';
import type { CardRecord } from '../cards/types';
import { listedPrinting, lockedPrintings } from '../cards/printingArt';
import { V1_STORE } from '../engine/engine';
import type { Printing } from '../engine/engine';
import { NOW, pr } from '../engine/fixtures';
import { buildHandoff, fromWire, toIncoming, toWire } from '../handoff';
import { resolveLines, resolvedEntries, toIncoming as toIncomingFromImport } from '../import';
import { combineEntries, parseDecklist } from '../parse/parseDecklist';
import { planLists } from '../plan';
import { tripCards, startTrip } from '../trip';
import { DEFAULT_STORE_SETTINGS } from '../store';
import { addEntries, bannerCardName, createList, mergeNeeded, setBanner, setEntryVersion } from './index';
import type { CardList } from './index';

const regular = pr({ setCode: 'fdn', setType: 'core', releasedAt: '2026-06-01', rarity: 'rare', collectorNumber: '141', usd: '0.56' });
const bordered = pr({ setCode: 'fdn', setType: 'core', releasedAt: '2026-06-01', rarity: 'rare', collectorNumber: '298', usd: '4.72', borderColor: 'borderless' });
const record = (key: string, name: string, printings: Printing[]): CardRecord => ({
  key,
  summary: { id: key, oracleId: key, name, typeLine: 'Creature', colors: [], imageSmall: null, imageNormal: null, sourceUri: 'u', printingsUri: 'p' },
  printings,
  fetchedAt: NOW.toISOString(),
});
const deck = (id = 'a'): CardList => addEntries(createList({ id, kind: 'deck', name: id }, NOW), [{ cardKey: 'giada', name: 'Giada', quantity: 1 }], NOW).list;
const ref = (p: Printing) => ({ setCode: p.setCode, collectorNumber: p.collectorNumber });

describe('choosing a version', () => {
  it('stores the chosen print and the lock on the entry, and clears them', () => {
    const chosen = setEntryVersion(deck(), 'giada', { print: ref(bordered), locked: true }, NOW);
    expect(chosen.entries[0]).toMatchObject({ print: { setCode: 'fdn', collectorNumber: '298' }, locked: true });
    const unlocked = setEntryVersion(chosen, 'giada', { print: ref(bordered), locked: false }, NOW);
    expect(unlocked.entries[0].print).toBeDefined();
    expect(unlocked.entries[0].locked).toBeUndefined();
    const cleared = setEntryVersion(unlocked, 'giada', null, NOW);
    expect(cleared.entries[0].print).toBeUndefined();
  });

  it('keeps the printing a pasted line named, without locking it', () => {
    const list = addEntries(createList({ id: 'a', kind: 'deck', name: 'a' }, NOW), [{ cardKey: 'giada', name: 'Giada', quantity: 1, listed: ref(bordered) }], NOW).list;
    expect(list.entries[0].listed).toEqual(ref(bordered));
    expect(list.entries[0].locked).toBeUndefined();
    const records = new Map([['giada', record('giada', 'Giada', [regular, bordered])]]);
    const { targets } = planLists([list], records, V1_STORE, NOW);
    expect(targets.get('giada')).toMatchObject({ kind: 'stop', collectorNumber: '141' });   // the listed print does not steer the plan
  });
});

describe('a locked version', () => {
  const locked = setEntryVersion(deck(), 'giada', { print: ref(bordered), locked: true }, NOW);
  const records = new Map([['giada', record('giada', 'Giada', [regular, bordered])]]);

  it('is the only print the plan looks for', () => {
    expect(planLists([deck()], records, V1_STORE, NOW).targets.get('giada')).toMatchObject({ collectorNumber: '141', price: 0.56 });
    expect(planLists([locked], records, V1_STORE, NOW).targets.get('giada')).toMatchObject({ collectorNumber: '298', price: 4.72 });
  });

  it('is the only print the trip looks for', () => {
    const trip = startTrip('t', NOW, ['a']);
    const { needed } = tripCards([locked], trip, records);
    expect(needed[0].card.printings.map(p => p.collectorNumber)).toEqual(['298']);
  });

  it('carries to the merged list, and the first lock wins across lists', () => {
    const other = setEntryVersion(deck('b'), 'giada', { print: ref(regular), locked: true }, NOW);
    expect(mergeNeeded([locked, other])[0].lock).toEqual(ref(bordered));
    expect(mergeNeeded([deck()])[0].lock).toBeUndefined();
  });

  it('is ignored when the print is not known, so a stale choice cannot empty the plan', () => {
    expect(lockedPrintings([regular], { setCode: 'zzz', collectorNumber: '1' })).toEqual([regular]);
    expect(lockedPrintings([regular, bordered])).toEqual([regular, bordered]);
  });

  it('travels in the phone link, and unlocked choices do not', () => {
    const handoff = buildHandoff([locked, deck('b')], DEFAULT_STORE_SETTINGS);
    expect(handoff.lists[0].entries[0].lock).toEqual(ref(bordered));
    expect(handoff.lists[1].entries[0].lock).toBeUndefined();
    const back = fromWire(toWire(handoff))!;
    expect(back.lists[0].entries[0].lock).toEqual(ref(bordered));
    expect(toIncoming(back.lists[0])[0]).toMatchObject({ print: ref(bordered), locked: true });
    expect(toIncoming(back.lists[1])[0].locked).toBeUndefined();
  });

  it('rejects a link with a lock that is not a set and a number', () => {
    const wire = JSON.parse(toWire(buildHandoff([locked], DEFAULT_STORE_SETTINGS)));
    wire.l[0][2][0][2] = '<script>';
    expect(fromWire(JSON.stringify(wire))).toBeNull();
  });
});

describe('listedPrinting', () => {
  it('finds the exact print, or the cheapest print in a set named alone', () => {
    expect(listedPrinting([regular, bordered], { setCode: 'fdn', collectorNumber: '298' })).toBe(bordered);
    expect(listedPrinting([regular, bordered], { setCode: 'fdn', collectorNumber: '' })).toBe(regular);
    expect(listedPrinting([regular, bordered], { setCode: 'cmm', collectorNumber: '1' })).toBeUndefined();
  });
});

describe('the banner card', () => {
  it('is chosen by name, and cleared back to the first card', () => {
    const list = deck();
    expect(bannerCardName(setBanner(list, 'Lyra'))).toBe('Lyra');
    expect(bannerCardName(setBanner(setBanner(list, 'Lyra'), null))).toBe('Giada');
  });
});

describe('importing a line that names a print', () => {
  it('keeps the print on the list entry as information, not locked', () => {
    const { entries } = parseDecklist('2x Giada, Font of Hope (FDN) 298 *F* #angels');
    const combined = combineEntries(entries, { sideboard: false, maybeboard: false });
    const card = { id: 'g', oracleId: 'g', name: 'Giada, Font of Hope', typeLine: 'Legendary Creature', colors: ['W'], imageSmall: null, imageNormal: null, sourceUri: 'u', printingsUri: 'p' };
    const lines = resolveLines(combined, [{ requested: 'Giada, Font of Hope', card }], new Map());
    const incoming = toIncomingFromImport(resolvedEntries(lines), new Map());
    expect(incoming[0].listed).toEqual({ setCode: 'fdn', collectorNumber: '298' });
    const list = addEntries(createList({ id: 'a', kind: 'deck', name: 'a' }, NOW), incoming, NOW).list;
    expect(list.entries[0]).toMatchObject({ listed: { setCode: 'fdn', collectorNumber: '298' }, quantity: 2 });
    expect(list.entries[0].locked).toBeUndefined();
  });
});
