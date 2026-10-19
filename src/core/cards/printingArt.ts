import type { Printing } from '../engine/engine';

// A printing's picture from its set and collector number alone: the catalog keeps no picture id for every printing, and
// Scryfall answers this address with the image (the front face). Used where one printing is meant, such as the one a
// binder is predicted to hold, so the picture, set, number and price on a card all describe the same print.
export function printingImageUrl(p: Pick<Printing, 'setCode' | 'collectorNumber'>, size: 'small' | 'normal' = 'normal'): string {
  return `https://api.scryfall.com/cards/${encodeURIComponent(p.setCode)}/${encodeURIComponent(p.collectorNumber)}?format=image&version=${size}`;
}

// The cropped art of a card, found by its name, for the banner over a deck. Any print of the card will do.
export function bannerImageUrl(name: string): string {
  return `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=art_crop`;
}

export type ArtKind = 'borderless' | 'showcase' | 'extendedart' | 'fullart' | 'promo';

// Why a printing looks different from the usual one, or null for an ordinary print.
export function artKind(p: Printing): ArtKind | null {
  if (p.borderColor === 'borderless') return 'borderless';
  if (p.frameEffects.includes('showcase')) return 'showcase';
  if (p.frameEffects.includes('extendedart')) return 'extendedart';
  if (p.fullArt) return 'fullart';
  if (p.promo || p.promoTypes.length > 0) return 'promo';
  return null;
}

export function findPrinting(printings: readonly Printing[], setCode: string, collectorNumber: string): Printing | undefined {
  return printings.find(p => p.setCode === setCode && p.collectorNumber === collectorNumber);
}
