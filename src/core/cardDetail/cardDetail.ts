// What card detail shows about a card's print history: the places to look in the engine's order, and every paper printing.
// Pure: it reads the same engine the plan does, so the detail and the dive plan never disagree.
// There are no odds or chances here. The engine's order is the whole story, and the screen shows it as an order.
import { priceFor, routeCard } from '../engine/engine';
import type { CardInput, Finish, Printing, RankedStop, Stop, StoreProfile } from '../engine/engine';

export interface Place {
  stop: Stop;
  printing: Printing;       // the printing to look for in this place
  finish: Finish;
  price: number | null;
  hint?: 'value binders' | 'bulk boxes';
}

export type CardPlaces =
  | { status: 'routed'; first: Place; others: Place[] }
  | { status: 'skipped_basic' }    // a basic land, left off the hunt
  | { status: 'no_stop' };         // no paper printing anywhere the store carries

const placeOf = ({ stop, best }: RankedStop): Place => ({ stop, printing: best.printing, finish: best.finish, price: best.price, hint: best.hint });

// Where to look for a card, best place first. In a store, `hereStopId` is the binder being searched: it comes first,
// and the rest follow in the engine's order as the places to try if the card is not there.
export function cardPlaces(card: CardInput, store: StoreProfile, now: Date, hereStopId?: string): CardPlaces {
  const route = routeCard(card, store, now);
  if (route.status !== 'routed') return { status: route.status };
  const here = hereStopId ? route.ranked.find(r => r.stop.id === hereStopId) : undefined;
  const first = here ?? route.ranked[0];
  return { status: 'routed', first: placeOf(first), others: route.ranked.filter(r => r !== first).map(placeOf) };
}

export interface PrintingRow {
  key: string;                                  // set and collector number: unique for a printing
  setCode: string;
  setName: string;
  collectorNumber: string;
  rarity: string;
  releasedAt: string;
  prices: { finish: Finish; price: number | null }[];   // one per finish the printing comes in
  planned: boolean;                             // the printing the plan looks for first
  carried: boolean;                             // false when the store does not carry its set
}

// Every paper printing, newest first. Online-only printings are left out. `planned` marks the printing to look for first.
export function printingRows(printings: readonly Printing[], store: StoreProfile, planned?: { setCode: string; collectorNumber: string }): PrintingRow[] {
  const notCarried = new Set(store.notCarried.map(c => c.toLowerCase()));
  return printings
    .filter(p => !p.digital && p.games.includes('paper'))
    .map(p => ({
      key: `${p.setCode}:${p.collectorNumber}`,
      setCode: p.setCode,
      setName: p.setName,
      collectorNumber: p.collectorNumber,
      rarity: p.rarity,
      releasedAt: p.releasedAt,
      prices: p.finishes.map(finish => ({ finish, price: priceFor(p, finish) })),
      planned: planned !== undefined && planned.setCode === p.setCode && planned.collectorNumber === p.collectorNumber,
      carried: !notCarried.has(p.setCode.toLowerCase()),
    }))
    .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt) || a.setCode.localeCompare(b.setCode) || a.collectorNumber.localeCompare(b.collectorNumber, undefined, { numeric: true }));
}
