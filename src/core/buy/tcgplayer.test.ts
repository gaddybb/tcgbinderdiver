import { describe, expect, it } from 'vitest';
import { MASS_ENTRY_URL, cardSearchUrl, withAffiliate } from './tcgplayer';

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
