import type { CardRecord } from '../core/cards';
import type { AppStorage } from './types';

// A saved record that is missing its basics (an older version, or damaged) is treated as not saved, so it is fetched again.
function isCardRecord(value: unknown): value is CardRecord {
  const v = value as Partial<CardRecord> | null;
  return typeof v === 'object' && v !== null && typeof v.key === 'string' && typeof v.fetchedAt === 'string'
    && Array.isArray(v.printings) && typeof v.summary === 'object' && v.summary !== null && typeof v.summary.name === 'string';
}

// Card data kept on the device in the 'cards' collection, by the list entry's card key.
export class CardsRepository {
  constructor(private readonly storage: AppStorage) {}

  async get(key: string): Promise<CardRecord | undefined> {
    const found = await this.storage.get<unknown>('cards', key);
    return isCardRecord(found) ? found : undefined;
  }

  async getMany(keys: readonly string[]): Promise<Map<string, CardRecord>> {
    const found = new Map<string, CardRecord>();
    await Promise.all(keys.map(async key => { const record = await this.get(key); if (record) found.set(key, record); }));
    return found;
  }

  async put(record: CardRecord): Promise<void> {
    await this.storage.put('cards', record.key, record);
  }
}
