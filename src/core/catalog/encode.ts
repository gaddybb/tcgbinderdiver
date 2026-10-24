// Turns slim printings (the neutral shape every game's source produces) into the slimmed catalog files.
// Pure: no fetch, no fs, no clock. The build script streams a source's records through its mapper (for Magic, slimCard in
// sources/scryfall.ts, so only a small record per printing stays in memory) and hands the results to encodeCatalog.
import {
  DEFAULT_EXTRAS, FORMAT_VERSION,
  type CardRow, type CardsFile, type ExtrasRow, type PriceRow, type PricesFile, type PrintingRow, type SetRow,
} from './types.ts';

// What is kept from one source card printing (for Magic, one Scryfall card object). Names and values are the source's own, nothing is reconstructed.
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

// "12.34" -> 1234. Anything that is not a plain non-negative amount is unknown.
export function priceToCents(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value)) return null;
  return Math.round(Number(value) * 100);
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

