// Turns Scryfall card objects (one line of the Default Cards bulk file each) into the slimmed catalog files.
// Pure: no fetch, no fs, no clock. The build script streams the bulk file through slimCard (so only a small
// record per printing stays in memory) and hands the records to encodeCatalog.
// The filtering rules are the ones in reference/engine/scryfall-integration.md and the Scryfall connector's mapper.
import {
  DEFAULT_EXTRAS, FINISH_ETCHED, FINISH_FOIL, FINISH_NONFOIL, FLAG_FULL_ART, FLAG_PROMO, FORMAT_VERSION,
  type CardRow, type CardsFile, type ExtrasRow, type PriceRow, type PricesFile, type PrintingRow, type SetRow,
} from './types.ts';

// What is kept from one Scryfall card object. Names and values are Scryfall's own, nothing is reconstructed.
export interface SlimPrinting {
  id: string;                  // the printing's Scryfall id, which is also the id in its image URLs
  oracleId: string;
  name: string;
  typeLine: string;
  colors: string;              // front face color letters joined, "" when colorless
  hasImage: boolean;
  setCode: string;             // lowercase
  setName: string;
  setType: string;
  releasedAt: string;
  rarity: string;
  collectorNumber: string;
  finishMask: number;
  flags: number;
  borderColor: string;
  promoTypes: string[];
  frameEffects: string[];
  games: string[];
  prices: PriceRow;            // cents
}

export interface EncodeResult {
  cards: CardsFile;
  prices: PricesFile;
  counts: { cards: number; printings: number; sets: number };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

// "12.34" -> 1234. Anything that is not a plain non-negative amount is unknown.
export function priceToCents(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value)) return null;
  return Math.round(Number(value) * 100);
}

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

const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

// Collector numbers sort by their leading number, then as text ("12" < "12a" < "100").
function compareCollector(a: string, b: string): number {
  const na = parseInt(a, 10), nb = parseInt(b, 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return compareText(a, b);
}

// Newest first, so the order never depends on the order of Scryfall's file.
function comparePrintings(a: SlimPrinting, b: SlimPrinting): number {
  return compareText(b.releasedAt, a.releasedAt) || compareText(a.setCode, b.setCode)
    || compareCollector(a.collectorNumber, b.collectorNumber) || compareText(a.id, b.id);
}

// The date most of a set's printings share (the earliest on a tie). Printings that differ carry their own date.
function setDates(printings: SlimPrinting[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const p of printings) {
    let byDate = counts.get(p.setCode);
    if (!byDate) counts.set(p.setCode, (byDate = new Map()));
    byDate.set(p.releasedAt, (byDate.get(p.releasedAt) ?? 0) + 1);
  }
  const result = new Map<string, string>();
  for (const [code, byDate] of counts) {
    let best = '', bestCount = 0;
    for (const [date, n] of byDate) {
      if (n > bestCount || (n === bestCount && date < best)) { best = date; bestCount = n; }
    }
    result.set(code, best);
  }
  return result;
}

export function encodeCatalog(printings: Iterable<SlimPrinting>): EncodeResult {
  const all = [...printings];
  const dates = setDates(all);

  const setInfo = new Map<string, SetRow>();
  for (const p of all) {
    if (!setInfo.has(p.setCode)) setInfo.set(p.setCode, [p.setCode, p.setName, p.setType, dates.get(p.setCode) ?? '']);
  }
  const sets = [...setInfo.values()].sort((a, b) => compareText(a[0], b[0]));
  const setIndex = new Map(sets.map((s, i) => [s[0], i]));

  const extras: ExtrasRow[] = [DEFAULT_EXTRAS.map((v) => (Array.isArray(v) ? [...v] : v)) as ExtrasRow];
  const extrasIndex = new Map<string, number>([[JSON.stringify(DEFAULT_EXTRAS), 0]]);

  const byOracle = new Map<string, SlimPrinting[]>();
  for (const p of all) {
    const list = byOracle.get(p.oracleId);
    if (list) list.push(p); else byOracle.set(p.oracleId, [p]);
  }

  const groups = [...byOracle.entries()].map(([oracleId, list]) => ({ oracleId, list: list.sort(comparePrintings) }));
  groups.sort((a, b) => compareText(a.list[0].name, b.list[0].name) || compareText(a.oracleId, b.oracleId));

  const cards: CardRow[] = [];
  const prices: (PriceRow | null)[][] = [];
  for (const { oracleId, list } of groups) {
    const first = list[0];
    const rows: PrintingRow[] = [];
    const priceRows: (PriceRow | null)[] = [];
    for (const p of list) {
      const extra: ExtrasRow = [p.borderColor, p.promoTypes, p.frameEffects, p.games];
      const key = JSON.stringify(extra);
      let ei = extrasIndex.get(key);
      if (ei === undefined) { ei = extras.length; extras.push(extra); extrasIndex.set(key, ei); }
      const si = setIndex.get(p.setCode) as number;
      const row: PrintingRow = [si, p.collectorNumber, p.rarity, p.finishMask, p.flags, ei];
      if (p.releasedAt !== sets[si][3]) row.push(p.releasedAt);
      rows.push(row);
      priceRows.push(p.prices.every((c) => c === null) ? null : p.prices);
    }
    const image = list.find((p) => p.hasImage);
    cards.push([oracleId, first.name, first.typeLine, first.colors, image ? image.id : null, rows]);
    prices.push(priceRows);
  }

  return {
    cards: { format: FORMAT_VERSION, sets, extras, cards },
    prices: { format: FORMAT_VERSION, prices },
    counts: { cards: cards.length, printings: all.length, sets: sets.length },
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
