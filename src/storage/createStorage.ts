import { IndexedDbStorage } from './indexedDbStorage';
import { MemoryStorage } from './memoryStorage';
import type { AppStorage } from './types';

// The one place the app picks a storage backend. Falls back to memory when IndexedDB is missing or won't open
// (some private windows, blocked site data), so the app still works for the session; check `persistent` to warn.
export async function createStorage(dbName?: string): Promise<AppStorage> {
  if (typeof indexedDB === 'undefined') return new MemoryStorage();
  try {
    return await IndexedDbStorage.open(dbName);
  } catch {
    return new MemoryStorage();
  }
}
