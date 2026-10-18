// Turns the slimmed catalog files back into structured cards and printings the app can use.
// The browser's bulk connector is the main caller:
//   const catalog = decodeCatalog(cardsFile, pricesFile);   // pricesFile is optional, see applyPrices
//   const card = catalog.find('Fire');                      // same name rules as the decklist parser (nameKey)
//   catalog.summary(card)                                   // a CardSummary for the screens
//   card.printings                                          // the engine's Printing[], newest first
import type { CardSummary, SetInfo } from '../connector';
import type { Printing } from '../engine/engine';
import type { Finish } from '../engine/types';
import { nameKey } from '../parse/parseDecklist';
import {
  FINISH_ETCHED, FINISH_FOIL, FINISH_NONFOIL, FLAG_FULL_ART, FLAG_PROMO, FORMAT_VERSION,
  type CardsFile, type ImageSize, type PriceRow, type PricesFile,
} from './types.ts';

export class CatalogFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogFormatError';
  }
}

export interface CatalogCard {
  oracleId: string;
  name: string;               // Scryfall's spelling, for example "Fire // Ice"
  typeLine: string;
  colors: string[];           // front face, for example ["W", "U"]
  imageId: string | null;     // a printing id, see cardImageUrl
  printings: Printing[];      // every paper printing, newest first
}

export interface Catalog {
  sets: SetInfo[];
  cards: CatalogCard[];
  // Exact lookup. Case, accents and apostrophe style do not matter. "A // B" cards also answer to "A".
  find(name: string): CatalogCard | undefined;
  // Full card names that start like the query, in alphabetical order. Tokens and emblems are left out.
  autocomplete(query: string, limit?: number): string[];
  summary(card: CatalogCard): CardSummary;
}

// The picture of a printing, from its id alone. The front face, as Scryfall serves every printing.
export function cardImageUrl(id: string, size: ImageSize = 'normal'): string {
  return `https://cards.scryfall.io/${size}/front/${id[0]}/${id[1]}/${id}.jpg`;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function checkFile(value: unknown, what: string): void {
  if (!isObject(value)) throw new CatalogFormatError(`The ${what} file is not an object.`);
  if (value.format !== FORMAT_VERSION) throw new CatalogFormatError(`The ${what} file has format ${String(value.format)}; expected ${FORMAT_VERSION}.`);
}

const centsToString = (c: number | null): string | null => (c === null || c === undefined ? null : (c / 100).toFixed(2));

function pricesOf(row: PriceRow | null | undefined): Printing['prices'] {
  return {
    usd: centsToString(row?.[0] ?? null),
    usd_foil: centsToString(row?.[1] ?? null),
    usd_etched: centsToString(row?.[2] ?? null),
  };
}

const isNonCard = (typeLine: string): boolean => /^(Token|Emblem)\b/.test(typeLine);

export function decodeCatalog(cardsFile: CardsFile, pricesFile?: PricesFile): Catalog {
  checkFile(cardsFile, 'cards');
  if (!Array.isArray(cardsFile.sets) || !Array.isArray(cardsFile.extras) || !Array.isArray(cardsFile.cards)) {
    throw new CatalogFormatError('The cards file is missing its sets, extras or cards.');
  }
  const sets: SetInfo[] = cardsFile.sets.map(([code, name, setType, releasedAt]) => ({
    code, name, setType, releasedAt: releasedAt || null, digital: false,
  }));

  const cards: CatalogCard[] = cardsFile.cards.map(([oracleId, name, typeLine, colors, imageId, rows]) => ({
    oracleId, name, typeLine, colors: colors ? colors.split('') : [], imageId,
    printings: rows.map((row): Printing => {
      const [setIndex, collectorNumber, rarity, mask, flags, extrasIndex, releasedAt] = row;
      const set = cardsFile.sets[setIndex];
      const extras = cardsFile.extras[extrasIndex];
      if (!set || !extras) throw new CatalogFormatError(`A printing of "${name}" points at a set or extras row that does not exist.`);
      const finishes: Finish[] = [];
      if (mask & FINISH_NONFOIL) finishes.push('nonfoil');
      if (mask & FINISH_FOIL) finishes.push('foil');
      if (mask & FINISH_ETCHED) finishes.push('etched');
      return {
        setCode: set[0], setName: set[1], setType: set[2], releasedAt: releasedAt ?? set[3],
        rarity, collectorNumber, finishes,
        prices: { usd: null, usd_foil: null, usd_etched: null },
        promo: (flags & FLAG_PROMO) !== 0, promoTypes: [...extras[1]], frameEffects: [...extras[2]],
        borderColor: extras[0], fullArt: (flags & FLAG_FULL_ART) !== 0, digital: false, games: [...extras[3]],
      };
    }),
  }));

  // Full names win over front-face names, and real cards over tokens and emblems.
  const byKey = new Map<string, CatalogCard>();
  const claim = (key: string, card: CatalogCard, weak: boolean) => {
    const cur = byKey.get(key);
    if (!cur || (isNonCard(cur.typeLine) && !isNonCard(card.typeLine) && !weak)) byKey.set(key, card);
  };
  for (const card of cards) claim(nameKey(card.name), card, false);
  for (const card of cards) {
    if (card.name.includes(' // ')) claim(nameKey(card.name.split(' // ')[0]), card, true);
  }

  const sorted = cards.filter((c) => !isNonCard(c.typeLine)).map((c) => ({ key: nameKey(c.name), name: c.name }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const catalog: Catalog = {
    sets,
    cards,
    find: (name) => byKey.get(nameKey(name)),
    autocomplete(query, limit = 20) {
      const prefix = nameKey(query);
      if (!prefix) return [];
      let lo = 0, hi = sorted.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (sorted[mid].key < prefix) lo = mid + 1; else hi = mid;
      }
      const out: string[] = [];
      for (let i = lo; i < sorted.length && out.length < limit && sorted[i].key.startsWith(prefix); i++) out.push(sorted[i].name);
      return out;
    },
    summary(card) {
      const first = card.printings[0];
      return {
        id: card.imageId ?? card.oracleId,
        oracleId: card.oracleId,
        name: card.name,
        typeLine: card.typeLine,
        colors: [...card.colors],
        imageSmall: card.imageId ? cardImageUrl(card.imageId, 'small') : null,
        imageNormal: card.imageId ? cardImageUrl(card.imageId, 'normal') : null,
        // Scryfall redirects /card/{set}/{number} to the card's page, so the name part of the address is not needed.
        sourceUri: first ? `https://scryfall.com/card/${first.setCode}/${encodeURIComponent(first.collectorNumber)}` : 'https://scryfall.com',
        printingsUri: `https://api.scryfall.com/cards/search?order=released&q=oracleid%3A${card.oracleId}&unique=prints`,
      };
    },
  };
  if (pricesFile) applyPrices(catalog, pricesFile);
  return catalog;
}

// Sets every printing's prices from a prices file, in place. The catalog's cards and printings stay the same objects,
// so a daily prices refresh does not need the cards file decoded again. The two files must come from one build.
export function applyPrices(catalog: Catalog, pricesFile: PricesFile): void {
  checkFile(pricesFile, 'prices');
  if (!Array.isArray(pricesFile.prices) || pricesFile.prices.length !== catalog.cards.length) {
    throw new CatalogFormatError('The prices file does not match the cards file (different number of cards).');
  }
  catalog.cards.forEach((card, ci) => {
    const rows = pricesFile.prices[ci];
    if (!Array.isArray(rows) || rows.length !== card.printings.length) {
      throw new CatalogFormatError(`The prices for "${card.name}" do not match its printings.`);
    }
    card.printings.forEach((printing, pi) => { printing.prices = pricesOf(rows[pi]); });
  });
}
