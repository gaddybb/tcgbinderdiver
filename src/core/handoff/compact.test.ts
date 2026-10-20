import { describe, expect, it } from 'vitest';
import { addEntries, createList } from '../lists';
import type { CardList } from '../lists';
import { DEFAULT_STORE_SETTINGS } from '../store';
import { buildHandoff, fingerprint, fromWire, resolveFingerprints, toIncoming, toWire } from './handoff';

const NOW = new Date('2026-10-18T12:00:00Z');
const NAMES = Array.from({ length: 125 }, (_, i) => `Card Number ${i} of the Long Named Sort, Tamer of ${i * 7}`);
const deck = (names: readonly string[] = NAMES): CardList =>
  addEntries(createList({ id: 'a', kind: 'deck', name: 'Big deck' }, NOW), names.map(n => ({ cardKey: n.toLowerCase(), name: n, quantity: 1 })), NOW).list;
const catalog = (names: readonly string[]) => new Map(names.map(n => [fingerprint(n), n]));

describe('fingerprint', () => {
  it('is the same for the same card however it is written, and different for different cards', () => {
    expect(fingerprint('Lim-Dûl’s Vault')).toBe(fingerprint("lim-dul's vault"));
    expect(fingerprint('Sol Ring')).not.toBe(fingerprint('Mind Stone'));
    expect(fingerprint('Sol Ring')).toBeGreaterThanOrEqual(0);
    expect(fingerprint('Sol Ring')).toBeLessThan(2 ** 40);
  });
  it('does not repeat across thirty thousand names', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 30000; i++) seen.add(fingerprint(`Some Card ${i} // Other Half ${i * 3}`));
    expect(seen.size).toBe(30000);
  });
});

describe('the compact link', () => {
  const handoff = buildHandoff([deck()], DEFAULT_STORE_SETTINGS);

  it('is far shorter than the link with names, so a big deck fits in a QR code', () => {
    const names = toWire(handoff).length;
    const compact = toWire(handoff, true).length;
    expect(compact).toBeLessThan(names * 0.6);
  });

  it('gives the cards back by name when the receiver has the card catalog', () => {
    const back = fromWire(toWire(handoff, true))!;
    expect(back.lists[0].entries[0]).toMatchObject({ name: '', fp: fingerprint(NAMES[0]) });
    const { handoff: resolved, unmatched } = resolveFingerprints(back, catalog(NAMES));
    expect(unmatched).toBe(0);
    expect(resolved.lists[0].entries.map(e => e.name)).toEqual(NAMES);
    expect(toIncoming(resolved.lists[0])[3].cardKey).toBe(NAMES[3].toLowerCase());
  });

  it('keeps quantities, locks, the wishlist kind and the settings', () => {
    const list = addEntries(createList({ id: 'w', kind: 'wishlist', name: 'Wishes' }, NOW), [
      { cardKey: 'sol ring', name: 'Sol Ring', quantity: 3 },
      { cardKey: 'mind stone', name: 'Mind Stone', quantity: 1, print: { setCode: 'cmm', collectorNumber: '400' }, locked: true },
    ], NOW).list;
    const back = fromWire(toWire(buildHandoff([list], DEFAULT_STORE_SETTINGS), true))!;
    const { handoff: resolved } = resolveFingerprints(back, catalog(['Sol Ring', 'Mind Stone']));
    expect(resolved.lists[0]).toMatchObject({ name: 'Wishes', kind: 'wishlist' });
    expect(resolved.lists[0].entries).toEqual([
      { name: 'Sol Ring', quantity: 3 },
      { name: 'Mind Stone', quantity: 1, lock: { setCode: 'cmm', collectorNumber: '400' } },
    ]);
    expect(resolved.settings).toEqual(DEFAULT_STORE_SETTINGS);
  });

  it('leaves out, and counts, a card the receiver does not know', () => {
    const back = fromWire(toWire(handoff, true))!;
    const { handoff: resolved, unmatched } = resolveFingerprints(back, catalog(NAMES.slice(0, 100)));
    expect(unmatched).toBe(25);
    expect(resolved.lists[0].entries).toHaveLength(100);
  });

  it('is still read from the links people already have (names), and rejects a damaged compact link', () => {
    expect(fromWire(toWire(handoff))!.lists[0].entries[0].name).toBe(NAMES[0]);
    const wire = JSON.parse(toWire(handoff, true));
    const damaged = (change: (l: unknown[]) => void) => { const copy = JSON.parse(JSON.stringify(wire)); change(copy.l[0]); return fromWire(JSON.stringify(copy)); };
    expect(damaged(l => { l[2] = (l[2] as string).slice(0, -4); })).toBeNull();   // block too short for the quantities
    expect(damaged(l => { l[2] = '<script>'; })).toBeNull();
    expect(damaged(l => { l[3] = [0]; })).toBeNull();
    expect(damaged(l => { l[4] = [[999, 'cmm', '1']]; })).toBeNull();   // a lock for a card that is not there
  });
});
