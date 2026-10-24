// Magic's source: Scryfall card objects (one line of the Default Cards bulk file each) become slim printings, and then the catalog
// files. Pure: no fetch, no fs, no clock. The build script (scripts/sources/scryfall.mjs) streams the bulk file through slimCard so only
// a small record per printing stays in memory. The filtering rules are the ones in reference/engine/scryfall-integration.md and the
// Scryfall connector's mapper.
import { encodeCatalog, priceToCents } from '../encode.ts';
import type { EncodeResult, SlimPrinting } from '../encode.ts';
import { FLAG_FULL_ART, FLAG_PROMO, FINISH_ETCHED, FINISH_FOIL, FINISH_NONFOIL } from '../types.ts';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function finishMaskOf(raw: Record<string, unknown>): number {
  if (Array.isArray(raw.finishes)) {
    let mask = 0;
    for (const f of raw.finishes) {
      if (f === 'nonfoil') mask |= FINISH_NONFOIL;
      else if (f === 'foil') mask |= FINISH_FOIL;
      else if (f === 'etched') mask |= FINISH_ETCHED;
    }
    if (mask) return mask;
  }
  // Old records: only the foil and nonfoil flags.
  let mask = raw.nonfoil !== false ? FINISH_NONFOIL : 0;
  if (raw.foil === true) mask |= FINISH_FOIL;
  return mask;
}

// Null when the line is not a usable paper printing: not a card, digital, not in paper, memorabilia, or missing
// the fields every printing has.
export function slimCard(raw: unknown): SlimPrinting | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.id), name = str(raw.name), set = str(raw.set), collectorNumber = str(raw.collector_number);
  if (!id || !name || !set || collectorNumber === undefined) return null;
  const games = strings(raw.games);
  if (raw.digital === true || !games.includes('paper') || raw.set_type === 'memorabilia') return null;

  const faces = Array.isArray(raw.card_faces) ? raw.card_faces.filter(isRecord) : [];
  const face = faces[0];
  const colors = Array.isArray(raw.colors) ? strings(raw.colors) : strings(face?.colors);
  const prices = isRecord(raw.prices) ? raw.prices : {};
  return {
    id,
    oracleId: str(raw.oracle_id) ?? str(face?.oracle_id) ?? id,
    name,
    typeLine: str(raw.type_line) ?? str(face?.type_line) ?? '',
    colors: colors.join(''),
    hasImage: isRecord(raw.image_uris) || isRecord(face?.image_uris),
    setCode: set.toLowerCase(),
    setName: str(raw.set_name) ?? set,
    setType: str(raw.set_type) ?? '',
    releasedAt: str(raw.released_at) ?? '',
    rarity: str(raw.rarity) ?? '',
    collectorNumber,
    finishMask: finishMaskOf(raw),
    flags: (raw.promo === true ? FLAG_PROMO : 0) | (raw.full_art === true ? FLAG_FULL_ART : 0),
    borderColor: str(raw.border_color) ?? 'black',
    promoTypes: strings(raw.promo_types),
    frameEffects: strings(raw.frame_effects),
    games,
    prices: [priceToCents(prices.usd), priceToCents(prices.usd_foil), priceToCents(prices.usd_etched)],
  };
}


// The usual path: Scryfall card objects in, files out. Lines that are not usable paper printings are skipped.
export function encodeScryfallCards(rawCards: Iterable<unknown>): EncodeResult {
  const slims: SlimPrinting[] = [];
  for (const raw of rawCards) {
    const slim = slimCard(raw);
    if (slim) slims.push(slim);
  }
  return encodeCatalog(slims);
}
