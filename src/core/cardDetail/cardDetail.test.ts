import { describe, expect, it } from 'vitest';
import { V1_STORE } from '../engine/engine';
import { NOW, card, pr, store } from '../engine/fixtures';
import { cardPlaces, printingRows } from './cardDetail';

const fdn = pr({ setCode: 'fdn', setName: 'Foundations', setType: 'core', releasedAt: '2026-06-01', rarity: 'uncommon', collectorNumber: '135', usd: '0.25' });
const cmm = pr({ setCode: 'cmm', setName: 'Commander Masters', setType: 'masters', releasedAt: '2023-08-04', rarity: 'uncommon', collectorNumber: '15', usd: '0.30', foil: '0.80', finishes: ['nonfoil', 'foil'] });
const war = pr({ setCode: 'war', setName: 'War of the Spark', releasedAt: '2019-05-03', rarity: 'uncommon', collectorNumber: '4', usd: '0.35' });
const ajani = card("Ajani's Pridemate", [war, cmm, fdn]);

describe('cardPlaces', () => {
  it('puts the engine\'s first choice first and the rest after it, in the engine\'s order', () => {
    const places = cardPlaces(ajani, V1_STORE, NOW);
    if (places.status !== 'routed') throw new Error('expected a route');
    expect(places.first.stop.label).toBe('Foundations');
    expect(places.first.printing.collectorNumber).toBe('135');
    expect(places.others.map(p => p.stop.id)).not.toContain(places.first.stop.id);
    expect(places.others.length).toBeGreaterThan(0);
  });

  it('in a store, puts the binder being searched first and the others after it', () => {
    const overall = cardPlaces(ajani, V1_STORE, NOW);
    if (overall.status !== 'routed') throw new Error('expected a route');
    const second = overall.others[0];
    const places = cardPlaces(ajani, V1_STORE, NOW, second.stop.id);
    if (places.status !== 'routed') throw new Error('expected a route');
    expect(places.first.stop.id).toBe(second.stop.id);
    expect(places.first.printing).toBe(second.printing);
    expect(places.others.map(p => p.stop.id)).toContain(overall.first.stop.id);
    expect(places.others.map(p => p.stop.id)).not.toContain(second.stop.id);
  });

  it('falls back to the first choice when the binder is not one of the card\'s places', () => {
    const places = cardPlaces(ajani, V1_STORE, NOW, 'nowhere');
    if (places.status !== 'routed') throw new Error('expected a route');
    expect(places.first.stop.label).toBe('Foundations');
  });

  it('says so for a basic land and for a card with no printing the store carries', () => {
    expect(cardPlaces(card('Forest', [fdn], 'Basic Land — Forest'), V1_STORE, NOW).status).toBe('skipped_basic');
    expect(cardPlaces(card('X', [fdn]), store({ notCarried: ['fdn'] }), NOW).status).toBe('no_stop');
  });
});

describe('printingRows', () => {
  it('lists every paper printing, newest first, with the price of each finish', () => {
    const rows = printingRows(ajani.printings, V1_STORE);
    expect(rows.map(r => r.setCode)).toEqual(['fdn', 'cmm', 'war']);
    expect(rows[1].prices).toEqual([{ finish: 'nonfoil', price: 0.3 }, { finish: 'foil', price: 0.8 }]);
  });

  it('leaves out online-only printings', () => {
    const online = pr({ setCode: 'mtga', digital: true, games: ['arena'] });
    expect(printingRows([fdn, online], V1_STORE).map(r => r.setCode)).toEqual(['fdn']);
  });

  it('marks the planned printing and the sets the store does not carry', () => {
    const rows = printingRows(ajani.printings, store({ notCarried: ['WAR'] }), { setCode: 'cmm', collectorNumber: '15' });
    expect(rows.find(r => r.planned)?.setCode).toBe('cmm');
    expect(rows.filter(r => !r.carried).map(r => r.setCode)).toEqual(['war']);
  });

  it('keeps a printing with no known price, shown as null', () => {
    const [row] = printingRows([pr({ setCode: 'zzz', usd: null })], V1_STORE);
    expect(row.prices).toEqual([{ finish: 'nonfoil', price: null }]);
  });
});
