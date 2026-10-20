import { priceFor } from '../engine/engine';
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

// The printings a card is routed from: only the locked version when the player locked one (and it is a known printing),
// else all of them.
export function lockedPrintings(printings: readonly Printing[], lock?: { setCode: string; collectorNumber: string }): readonly Printing[] {
  if (!lock) return printings;
  const only = printings.filter(p => p.setCode === lock.setCode && p.collectorNumber === lock.collectorNumber);
  return only.length > 0 ? only : printings;
}

// The printing a pasted line named: exact when it gave a collector number, else the cheapest paper printing in that set.
export function listedPrinting(printings: readonly Printing[], listed: { setCode: string; collectorNumber: string }): Printing | undefined {
  if (listed.collectorNumber) return printings.find(p => p.setCode === listed.setCode && p.collectorNumber.toLowerCase() === listed.collectorNumber.toLowerCase());
  const price = (p: Printing): number => Math.min(...p.finishes.map(f => priceFor(p, f) ?? Number.POSITIVE_INFINITY));
  return printings.filter(p => p.setCode === listed.setCode && !p.digital).sort((a, b) => price(a) - price(b))[0];
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
