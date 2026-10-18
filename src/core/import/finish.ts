// Step 4 and the end of the import: per-card status, the 250-line limit and the wishlist rule. Pure.
import { CARD_STATUSES } from '../status';
import type { CardStatus } from '../status';
import { MAX_CARDS_PER_LIST } from '../lists/limits';
import type { CardList, IncomingEntry } from '../lists';
import type { ResolvedEntry } from './resolve';

// The statuses chosen in step 4, by card key. A card with none is Needed.
export type StatusChoices = ReadonlyMap<string, CardStatus>;

export const statusOf = (choices: StatusChoices, cardKey: string): CardStatus => choices.get(cardKey) ?? 'needed';

export function setStatus(choices: StatusChoices, cardKey: string, status: CardStatus): StatusChoices {
  const next = new Map(choices);
  if (status === 'needed') next.delete(cardKey); else next.set(cardKey, status);
  return next;
}

// "Set all to".
export function setAll(entries: readonly ResolvedEntry[], status: CardStatus): StatusChoices {
  return status === 'needed' ? new Map() : new Map(entries.map(e => [e.cardKey, status]));
}

// "Reset to needed".
export const resetStatuses = (): StatusChoices => new Map();

// "2 in collection · 1 ordered · 1 proxy · 9 still needed": cards (lines), not copies.
export function statusCounts(entries: readonly ResolvedEntry[], choices: StatusChoices): Record<CardStatus, number> {
  const counts = Object.fromEntries(CARD_STATUSES.map(s => [s, 0])) as Record<CardStatus, number>;
  for (const e of entries) counts[statusOf(choices, e.cardKey)]++;
  return counts;
}

export const toIncoming = (entries: readonly ResolvedEntry[], choices: StatusChoices): IncomingEntry[] =>
  entries.map(e => ({ cardKey: e.cardKey, name: e.name, quantity: e.quantity, tags: e.tags, status: statusOf(choices, e.cardKey) }));

// Lines are counted, as everywhere else: the limit is 250 lines in one list.
export const overLimit = (count: number): boolean => count > MAX_CARDS_PER_LIST;

export function chunkForLimit<T>(items: readonly T[], size: number = MAX_CARDS_PER_LIST): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export const keepFirst = <T>(items: readonly T[], size: number = MAX_CARDS_PER_LIST): T[] => items.slice(0, size);

// The wishlist import ignores cards already on the wishlist.
export function splitByWishlist<T extends { cardKey: string }>(items: readonly T[], wishlist: CardList): { fresh: T[]; already: T[] } {
  const have = new Set(wishlist.entries.map(e => e.cardKey));
  return { fresh: items.filter(i => !have.has(i.cardKey)), already: items.filter(i => have.has(i.cardKey)) };
}
