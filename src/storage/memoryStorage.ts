import { COLLECTIONS } from './types';
import type { AppStorage, Collection } from './types';

// In-memory storage: the fallback when IndexedDB is unavailable, and the test double for code that needs storage.
// Copies values on the way in and out, like IndexedDB, so callers can't change stored data by mutating it.
export class MemoryStorage implements AppStorage {
  readonly persistent: boolean = false;
  private readonly data = new Map<Collection, Map<string, unknown>>(COLLECTIONS.map(c => [c, new Map()]));

  private store(collection: Collection): Map<string, unknown> {
    return this.data.get(collection)!;
  }

  async get<T>(collection: Collection, key: string): Promise<T | undefined> {
    const store = this.store(collection);
    return store.has(key) ? (structuredClone(store.get(key)) as T) : undefined;
  }

  async put<T>(collection: Collection, key: string, value: T): Promise<void> {
    this.store(collection).set(key, structuredClone(value));
  }

  async delete(collection: Collection, key: string): Promise<void> {
    this.store(collection).delete(key);
  }

  async list<T>(collection: Collection): Promise<T[]> {
    return [...this.store(collection).entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))   // same order IndexedDB uses for string keys
      .map(([, value]) => structuredClone(value) as T);
  }

  async clear(collection: Collection): Promise<void> {
    this.store(collection).clear();
  }
}
