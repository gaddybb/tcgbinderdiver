// Small helpers that turn data into the words on screen.
import type { CardList, UpdatedAge } from '../core/lists';
import { updatedAge } from '../core/lists';
import { copy } from './copy/en';

// "Lifegain Commander", "Lifegain Commander and Wishlist", "A, B and C".
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

export function describeUpdated(age: UpdatedAge): string {
  const words = copy.myLists.updated;
  switch (age.kind) {
    case 'today': return words.today;
    case 'yesterday': return words.yesterday;
    case 'days': return words.days(age.n);
    case 'last_week': return words.lastWeek;
    case 'weeks': return words.weeks(age.n);
    case 'date': return words.on(dateFormat.format(new Date(age.iso)));
  }
}

// "11 needed of 13 · Updated today" for a deck, "23 cards · Updated last week" for the wishlist.
export function listSummaryLine(list: CardList, now: Date): string {
  const cards = list.entries.length;
  const needed = list.entries.filter(e => e.status === 'needed').length;
  const count = list.kind === 'wishlist' ? copy.myLists.wishlistSummary(cards) : copy.myLists.deckSummary(needed, cards);
  return `${count} · ${describeUpdated(updatedAge(list, now))}`;
}

// For example $0.25. A card with no known price shows a dash.
export const formatUsd = (amount: number | null): string => (amount === null ? '—' : `$${amount.toFixed(2)}`);
