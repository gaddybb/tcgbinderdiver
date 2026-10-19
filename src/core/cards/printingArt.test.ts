import { describe, expect, it } from 'vitest';
import type { Printing } from '../engine/engine';
import { artKind, bannerImageUrl, findPrinting, printingImageUrl } from './printingArt';

const print = (over: Partial<Printing> = {}): Printing => ({
  setCode: 'fdn', setName: 'Foundations', setType: 'core', releasedAt: '2024-11-15', rarity: 'rare', collectorNumber: '141',
  finishes: ['nonfoil'], prices: { usd: '0.55', usd_foil: null, usd_etched: null }, promo: false, promoTypes: [], frameEffects: [],
  borderColor: 'black', fullArt: false, digital: false, games: ['paper'], ...over,
});

describe('printingImageUrl', () => {
  it('points at the one printing by set and collector number', () => {
    expect(printingImageUrl(print())).toBe('https://api.scryfall.com/cards/fdn/141?format=image&version=normal');
    expect(printingImageUrl(print({ setCode: 'pwcs', collectorNumber: '2023-2' }), 'small')).toBe('https://api.scryfall.com/cards/pwcs/2023-2?format=image&version=small');
  });
  it('encodes a collector number with symbols so it stays one path part', () => {
    expect(printingImageUrl(print({ collectorNumber: '12/★' }))).toContain('/12%2F%E2%98%85?');
  });
});

describe('artKind', () => {
  it('is null for an ordinary print', () => expect(artKind(print())).toBeNull());
  it('names borderless, showcase, extended art, full art and promo prints', () => {
    expect(artKind(print({ borderColor: 'borderless', frameEffects: ['legendary', 'inverted'] }))).toBe('borderless');
    expect(artKind(print({ frameEffects: ['showcase', 'legendary'] }))).toBe('showcase');
    expect(artKind(print({ frameEffects: ['extendedart'] }))).toBe('extendedart');
    expect(artKind(print({ fullArt: true }))).toBe('fullart');
    expect(artKind(print({ promoTypes: ['prerelease'] }))).toBe('promo');
  });
});

describe('findPrinting', () => {
  it('finds the printing a stop names', () => {
    const a = print(), b = print({ collectorNumber: '298', borderColor: 'borderless' });
    expect(findPrinting([a, b], 'fdn', '298')).toBe(b);
    expect(findPrinting([a, b], 'fdn', '999')).toBeUndefined();
  });
});

describe('bannerImageUrl', () => {
  it('asks for the cropped art of a card by its name, encoded', () => {
    expect(bannerImageUrl('Giada, Font of Hope')).toBe('https://api.scryfall.com/cards/named?exact=Giada%2C%20Font%20of%20Hope&format=image&version=art_crop');
    expect(new URL(bannerImageUrl('Fire // Ice & more')).searchParams.get('exact')).toBe('Fire // Ice & more');
  });
});
