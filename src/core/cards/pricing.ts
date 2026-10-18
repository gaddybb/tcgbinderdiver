import { priceFor } from '../engine/engine';
import type { Printing } from '../engine/engine';
import type { CardRecord } from './types';

// Card data older than this is fetched again when a list is opened, so prices do not go stale. Same as the sets list.
export const CARD_TTL_DAYS = 7;
const DAY_MS = 24 * 3600 * 1000;

export function isStale(record: CardRecord, now: Date, ttlDays: number = CARD_TTL_DAYS): boolean {
  const fetched = Date.parse(record.fetchedAt);
  if (Number.isNaN(fetched)) return true;
  const age = now.getTime() - fetched;
  return age < 0 || age >= ttlDays * DAY_MS;
}

// The cheapest price among a printing's finishes that have a price, or null when none does.
export function lowestPrice(printing: Printing): number | null {
  const prices = printing.finishes.map(f => priceFor(printing, f)).filter((p): p is number => p !== null);
  return prices.length > 0 ? Math.min(...prices) : null;
}

// "Avg online": the typical price of a card, which is the MEDIAN of its paper printings' cheapest prices. A plain average
// is thrown off by a few collector printings (an average Sol Ring would cost over $100), the median is not.
// Printings with no price are left out; null when none has a price.
export function typicalOnline(printings: readonly Printing[]): number | null {
  const prices = printings
    .filter(p => !p.digital && p.games.includes('paper'))
    .map(lowestPrice)
    .filter((p): p is number => p !== null)
    .sort((a, b) => a - b);
  if (prices.length === 0) return null;
  const middle = Math.floor(prices.length / 2);
  return prices.length % 2 === 1 ? prices[middle] : (prices[middle - 1] + prices[middle]) / 2;
}
