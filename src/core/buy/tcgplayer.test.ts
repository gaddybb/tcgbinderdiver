import { describe, expect, it } from 'vitest';
import { MASS_ENTRY_MAX_CHARS, MASS_ENTRY_URL, cardSearchUrl, massEntryUrl, withAffiliate } from './tcgplayer';

describe('cardSearchUrl', () => {
  it('searches TCGplayer Magic products for the card name', () => {
    expect(cardSearchUrl('Sol Ring')).toBe('https://www.tcgplayer.com/search/magic/product?q=Sol%20Ring&productLineName=magic&view=grid');
  });
  it('encodes names with symbols so they stay one value', () => {
    const url = cardSearchUrl('Fire // Ice & "more"');
    expect(new URL(url).searchParams.get('q')).toBe('Fire // Ice & "more"');
    expect(new URL(url).searchParams.get('productLineName')).toBe('magic');
  });
});

describe('MASS_ENTRY_URL', () => {
  it('is the Mass Entry page, with nothing pre-filled', () => {
    expect(MASS_ENTRY_URL).toBe('https://www.tcgplayer.com/massentry');
  });
});

describe('massEntryUrl', () => {
  it('fills Mass Entry with one "quantity name" per card, joined by ||', () => {
    expect(massEntryUrl([{ name: 'Sol Ring', copies: 1 }, { name: 'Lightning Bolt', copies: 2 }]))
      .toBe('https://www.tcgplayer.com/massentry?productline=Magic&c=1%20Sol%20Ring||2%20Lightning%20Bolt');
  });
  it('encodes each name on its own, so a symbol in one cannot split or break the list', () => {
    const url = massEntryUrl([{ name: 'Fire // Ice', copies: 1 }, { name: "Ajani's Pridemate", copies: 3 }])!;
    expect(url).toContain("1%20Fire%20%2F%2F%20Ice||3%20Ajani's%20Pridemate");
    expect(decodeURIComponent(url.split('c=')[1]).split('||')).toEqual(['1 Fire // Ice', "3 Ajani's Pridemate"]);
  });
  it('gives nothing for an empty list', () => {
    expect(massEntryUrl([])).toBeNull();
  });
  it('gives nothing when the list is too long for an address, so the caller copies it instead', () => {
    const many = Array.from({ length: 400 }, (_, i) => ({ name: `A Fairly Long Card Name Number ${i}`, copies: 1 }));
    expect(massEntryUrl(many)).toBeNull();
    expect(massEntryUrl(many.slice(0, 5))!.length).toBeLessThanOrEqual(MASS_ENTRY_MAX_CHARS);
  });
  it('can go through the affiliate address like any other TCGplayer address', () => {
    const url = withAffiliate(massEntryUrl([{ name: 'Sol Ring', copies: 1 }])!, 'https://tcgplayer.pxf.io/c/1/2/3');
    expect(new URL(url).searchParams.get('u')).toBe('https://www.tcgplayer.com/massentry?productline=Magic&c=1%20Sol%20Ring');
  });
});

describe('withAffiliate', () => {
  it('leaves the address alone when there is no tracking address', () => {
    expect(withAffiliate(MASS_ENTRY_URL, null)).toBe(MASS_ENTRY_URL);
  });
  it('sends the landing address, percent-encoded, through the tracking address', () => {
    const url = withAffiliate(cardSearchUrl('Sol Ring'), 'https://tcgplayer.pxf.io/c/123/456/789');
    expect(url.startsWith('https://tcgplayer.pxf.io/c/123/456/789?u=')).toBe(true);
    expect(new URL(url).searchParams.get('u')).toBe(cardSearchUrl('Sol Ring'));
  });
});
