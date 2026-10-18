// Sorting for card lists. Pure and stable: cards that compare equal keep their order.
export type SortMode = 'alphabetical' | 'price_desc' | 'collector_number' | 'color';
export const SORT_MODES: readonly SortMode[] = ['alphabetical', 'price_desc', 'collector_number', 'color'];

export interface SortKeys {
  name: string;
  price: number | null;                 // null (unknown) sorts last
  collectorNumber: string | null;       // null sorts last
  color: string;                        // a store-sort category such as "White" or "Land"
}

const byName = (a: SortKeys, b: SortKeys): number => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

// "24" before "135" before "135a": the number first, then any letters after it. Anything without a number goes last.
export function compareCollectorNumbers(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const parse = (s: string) => { const m = /^(\d+)(.*)$/.exec(s); return m ? { n: Number(m[1]), rest: m[2] } : null; };
  const pa = parse(a), pb = parse(b);
  if (pa && pb) return pa.n - pb.n || pa.rest.localeCompare(pb.rest);
  if (pa) return -1;
  if (pb) return 1;
  return a.localeCompare(b);
}

export function sortCards<T>(items: readonly T[], mode: SortMode, keys: (item: T) => SortKeys, colorOrder: readonly string[]): T[] {
  const colorRank = (color: string) => { const i = colorOrder.indexOf(color); return i === -1 ? colorOrder.length : i; };
  const compare = (a: SortKeys, b: SortKeys): number => {
    switch (mode) {
      case 'alphabetical':
        return byName(a, b);
      case 'price_desc':
        if (a.price === b.price) return byName(a, b);
        if (a.price === null) return 1;
        if (b.price === null) return -1;
        return b.price - a.price || byName(a, b);
      case 'collector_number':
        return compareCollectorNumbers(a.collectorNumber, b.collectorNumber) || byName(a, b);
      case 'color':
        return colorRank(a.color) - colorRank(b.color) || compareCollectorNumbers(a.collectorNumber, b.collectorNumber) || byName(a, b);
    }
  };
  return [...items].sort((x, y) => compare(keys(x), keys(y)));
}
