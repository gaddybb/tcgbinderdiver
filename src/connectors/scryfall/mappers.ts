// Turns Scryfall JSON into the core's types. Rules from reference/engine/scryfall-integration.md:
// double-faced cards take colors and images from card_faces[0] when the top-level field is missing,
// and printings that are digital, not in paper, or memorabilia are ignored.
import type { Finish, Printing } from '../../core/engine/engine';
import type { CardSummary, SetInfo } from '../../core/connector';
import { ScryfallError } from './client';

interface ImageUris { small?: string; normal?: string }
interface CardFace { colors?: string[]; type_line?: string; image_uris?: ImageUris; oracle_id?: string }
export interface ScryfallCard {
  id: string; oracle_id?: string; name: string; type_line?: string; colors?: string[]; image_uris?: ImageUris;
  card_faces?: CardFace[]; scryfall_uri: string; prints_search_uri: string;
  set: string; set_name: string; set_type: string; released_at?: string; rarity: string; collector_number: string;
  finishes?: string[]; foil?: boolean; nonfoil?: boolean;
  prices?: { usd?: string | null; usd_foil?: string | null; usd_etched?: string | null };
  promo?: boolean; promo_types?: string[]; frame_effects?: string[]; border_color?: string; full_art?: boolean;
  digital?: boolean; games?: string[];
}
export interface ScryfallSet { code: string; name: string; released_at?: string; set_type: string; digital?: boolean }

const FINISHES: readonly Finish[] = ['nonfoil', 'foil', 'etched'];

export const MAGIC_SORT_ORDER = ['White', 'Blue', 'Black', 'Red', 'Green', 'Multicolor', 'Colorless', 'Land'] as const;
const COLOR_NAMES: Record<string, string> = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };

export const frontFaceName = (name: string): string => name.split(' // ')[0].trim();

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toCardSummary(raw: unknown): CardSummary {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string') {
    throw new ScryfallError('bad_response', 'Scryfall sent a card we could not read.');
  }
  const card = raw as unknown as ScryfallCard;
  const face = card.card_faces?.[0];
  const images = card.image_uris ?? face?.image_uris;
  return {
    id: card.id,
    oracleId: card.oracle_id ?? face?.oracle_id ?? card.id,
    name: card.name,
    typeLine: card.type_line ?? face?.type_line ?? '',
    colors: card.colors ?? face?.colors ?? [],
    imageSmall: images?.small ?? null,
    imageNormal: images?.normal ?? null,
    sourceUri: card.scryfall_uri,
    printingsUri: card.prints_search_uri,
  };
}

// Null when the printing should be ignored (digital, no paper, memorabilia).
export function toPrinting(raw: unknown): Printing | null {
  if (!isRecord(raw) || typeof raw.set !== 'string') throw new ScryfallError('bad_response', 'Scryfall sent a printing we could not read.');
  const p = raw as unknown as ScryfallCard;
  const games = p.games ?? [];
  if (p.digital === true || !games.includes('paper') || p.set_type === 'memorabilia') return null;

  let finishes = (p.finishes ?? []).filter((f): f is Finish => (FINISHES as readonly string[]).includes(f));
  if (finishes.length === 0) {
    if (p.nonfoil !== false) finishes.push('nonfoil');
    if (p.foil === true) finishes.push('foil');
    finishes = [...new Set(finishes)];
  }
  return {
    setCode: p.set.toLowerCase(),
    setName: p.set_name,
    setType: p.set_type,
    releasedAt: p.released_at ?? '',
    rarity: p.rarity,
    collectorNumber: p.collector_number,
    finishes,
    prices: { usd: p.prices?.usd ?? null, usd_foil: p.prices?.usd_foil ?? null, usd_etched: p.prices?.usd_etched ?? null },
    promo: p.promo ?? false,
    promoTypes: p.promo_types ?? [],
    frameEffects: p.frame_effects ?? [],
    borderColor: p.border_color ?? 'black',
    fullArt: p.full_art ?? false,
    digital: false,
    games,
  };
}

export function toSetInfo(raw: unknown): SetInfo {
  if (!isRecord(raw) || typeof raw.code !== 'string' || typeof raw.name !== 'string') {
    throw new ScryfallError('bad_response', 'Scryfall sent a set we could not read.');
  }
  const s = raw as unknown as ScryfallSet;
  return { code: s.code.toLowerCase(), name: s.name, releasedAt: s.released_at ?? null, setType: s.set_type, digital: s.digital ?? false };
}

// Store order for Magic: White, Blue, Black, Red, Green, Multicolor, Colorless, Land (front face decides).
export function sortCategory(card: Pick<CardSummary, 'typeLine' | 'colors'>): string {
  const frontType = card.typeLine.split(' // ')[0];
  if (/\bLand\b/.test(frontType)) return 'Land';
  if (card.colors.length > 1) return 'Multicolor';
  if (card.colors.length === 1) return COLOR_NAMES[card.colors[0]] ?? 'Colorless';
  return 'Colorless';
}
