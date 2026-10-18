import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import { COLLECTIONS } from './types';
import type { AppStorage, Collection } from './types';

export const DB_NAME = 'binderdiver';
// Bump when a collection is removed or reshaped, and handle the old version inside `upgrade`.
// Adding a collection to COLLECTIONS needs no bump of its own: new names are created on open when the version changes.
export const DB_VERSION = 1;

// Browser storage on the device. One object store per collection, keys supplied by the caller.
export class IndexedDbStorage implements AppStorage {
  readonly persistent = true;

  private constructor(private readonly db: IDBPDatabase) {}

  static async open(name: string = DB_NAME): Promise<IndexedDbStorage> {
    const db = await openDB(name, DB_VERSION, {
      upgrade(database) {
        for (const collection of COLLECTIONS) {
          if (!database.objectStoreNames.contains(collection)) database.createObjectStore(collection);
        }
      },
    });
    return new IndexedDbStorage(db);
  }

  async get<T>(collection: Collection, key: string): Promise<T | undefined> {
    return (await this.db.get(collection, key)) as T | undefined;
  }

  async put<T>(collection: Collection, key: string, value: T): Promise<void> {
    await this.db.put(collection, value, key);
  }

  async delete(collection: Collection, key: string): Promise<void> {
    await this.db.delete(collection, key);
  }

  async list<T>(collection: Collection): Promise<T[]> {
    return (await this.db.getAll(collection)) as T[];   // IndexedDB returns values in key order
  }

  async clear(collection: Collection): Promise<void> {
    await this.db.clear(collection);
  }

  close(): void {
    this.db.close();
  }
}
