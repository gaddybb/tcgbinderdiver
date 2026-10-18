// Storage seam. The app talks only to AppStorage, so IndexedDB (v1) can be swapped for Supabase (v3) in one place.
// Values must be structured-cloneable (plain objects, arrays, strings, numbers, booleans, dates). No Maps, Sets or functions.

// Add a collection here and it is created on the next open. Removing or reshaping one needs a DB_VERSION bump.
export const COLLECTIONS = ['lists', 'cards', 'trips', 'settings', 'cache'] as const;
export type Collection = (typeof COLLECTIONS)[number];

export interface AppStorage {
  // False when data lives only in memory (IndexedDB unavailable). The UI can say "not saved on this device".
  readonly persistent: boolean;
  get<T>(collection: Collection, key: string): Promise<T | undefined>;
  put<T>(collection: Collection, key: string, value: T): Promise<void>;
  delete(collection: Collection, key: string): Promise<void>;
  // Every value in the collection, ordered by key.
  list<T>(collection: Collection): Promise<T[]>;
  clear(collection: Collection): Promise<void>;
}
