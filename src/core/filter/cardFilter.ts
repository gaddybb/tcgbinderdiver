// Filters for the list review: price band, color and name search. Pure; they combine with each other and with sort.
import { nameKey } from '../parse/parseDecklist';

export const PRICE_FILTERS = ['any', 'under_1', '1_to_5', '5_up'] as const;
export type PriceFilter = (typeof PRICE_FILTERS)[number];

// Under $1, $1 up to (not including) $5, $5 and up. A card with no known price only shows under "Any price".
export function matchesPrice(price: number | null, filter: PriceFilter): boolean {
  if (filter === 'any') return true;
  if (price === null) return false;
  if (filter === 'under_1') return price < 1;
  if (filter === '1_to_5') return price >= 1 && price < 5;
  return price >= 5;
}

export interface CardFilters {
  query: string;                   // part of a name; case and accents ignored
  price: PriceFilter;
  colors: readonly string[];       // store-sort categories; none picked means every color
}

export const NO_FILTERS: CardFilters = { query: '', price: 'any', colors: [] };

export const hasFilters = (f: CardFilters): boolean => nameKey(f.query.trim()) !== '' || f.price !== 'any' || f.colors.length > 0;

export interface FilterKeys { name: string; price: number | null; color: string }

// Keeps the items that pass every filter, in their original order.
export function filterCards<T>(items: readonly T[], filters: CardFilters, keysOf: (item: T) => FilterKeys): T[] {
  const needle = nameKey(filters.query.trim());
  return items.filter(item => {
    const keys = keysOf(item);
    return (!needle || nameKey(keys.name).includes(needle))
      && matchesPrice(keys.price, filters.price)
      && (filters.colors.length === 0 || filters.colors.includes(keys.color));
  });
}
