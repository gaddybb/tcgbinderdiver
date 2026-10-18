// The slimmed card data format (docs/DATA-PLAN.md). Pure types and constants: the build script writes these files
// and the browser's bulk connector reads them. Bump FORMAT_VERSION when a layout changes; the decoder refuses others.
// Imports use the .ts extension so Node can run the encoder straight from the build script.

export const FORMAT_VERSION = 1;

// Printing finish mask bits.
export const FINISH_NONFOIL = 1;
export const FINISH_FOIL = 2;
export const FINISH_ETCHED = 4;

// Printing flag bits.
export const FLAG_PROMO = 1;
export const FLAG_FULL_ART = 2;

// A set: [code, name, setType, releasedAt]. Code is lowercase. releasedAt is "YYYY-MM-DD" or "".
export type SetRow = [code: string, name: string, setType: string, releasedAt: string];

// Rarely varying printing details, shared between printings: [borderColor, promoTypes, frameEffects, games].
// Index 0 is always the default ["black", [], [], ["paper"]].
export type ExtrasRow = [borderColor: string, promoTypes: string[], frameEffects: string[], games: string[]];
export const DEFAULT_EXTRAS: ExtrasRow = ['black', [], [], ['paper']];

// A printing: [setIndex, collectorNumber, rarity, finishMask, flags, extrasIndex, releasedAt?].
// releasedAt is only present when the printing's date differs from its set's date.
export type PrintingRow =
  | [setIndex: number, collectorNumber: string, rarity: string, finishMask: number, flags: number, extrasIndex: number]
  | [setIndex: number, collectorNumber: string, rarity: string, finishMask: number, flags: number, extrasIndex: number, releasedAt: string];

// A card: [oracleId, name, typeLine, colors, imageId, printings].
// colors is the front face's color letters joined, for example "WU" ("" for colorless).
// imageId is the id of a printing whose picture stands for the card (see cardImageUrl), or null when none has one.
// Printings are newest first (release date, then set code, then collector number).
export type CardRow = [oracleId: string, name: string, typeLine: string, colors: string, imageId: string | null, printings: PrintingRow[]];

export interface CardsFile {
  format: number;
  sets: SetRow[];
  extras: ExtrasRow[];
  cards: CardRow[];
}

// A price triple in cents, [usd, usd_foil, usd_etched]; null when unknown. A whole printing with no price is null.
export type PriceRow = [usd: number | null, usdFoil: number | null, usdEtched: number | null];

// Aligned to CardsFile.cards and each card's printings: prices[cardIndex][printingIndex].
export interface PricesFile {
  format: number;
  prices: (PriceRow | null)[][];
}

export interface Manifest {
  format: number;
  builtAt: string;              // ISO time the files were built
  scryfallUpdatedAt: string;    // the bulk file's updated_at, as Scryfall reports it
  counts: { cards: number; printings: number; sets: number };
  files: { cards: string; prices: string };   // hashed file names, relative to the manifest
}

export type ImageSize = 'small' | 'normal' | 'large';
