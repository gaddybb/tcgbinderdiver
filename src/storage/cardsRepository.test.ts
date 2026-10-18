import { describe, expect, it } from 'vitest';
import type { CardRecord } from '../core/cards';
import { pr } from '../core/engine/fixtures';
import { CardsRepository } from './cardsRepository';
import { MemoryStorage } from './memoryStorage';

const record = (key: string, name = key): CardRecord => ({
  key,
  summary: { id: key, oracleId: key, name, typeLine: 'Artifact', colors: [], imageSmall: 'https://img/s.jpg', imageNormal: null, sourceUri: 'u', printingsUri: 'p' },
  printings: [pr({ setCode: 'cmm', usd: '1.50' })],
  fetchedAt: '2026-10-17T12:00:00.000Z',
});

describe('CardsRepository', () => {
  it('saves and returns a record', async () => {
    const repo = new CardsRepository(new MemoryStorage());
    await repo.put(record('sol', 'Sol Ring'));
    expect(await repo.get('sol')).toEqual(record('sol', 'Sol Ring'));
  });

  it('returns undefined for a card it does not have', async () => {
    expect(await new CardsRepository(new MemoryStorage()).get('nope')).toBeUndefined();
  });

  it('returns the ones it has from a list of keys, and leaves out the rest', async () => {
    const repo = new CardsRepository(new MemoryStorage());
    await repo.put(record('a'));
    await repo.put(record('b'));
    const found = await repo.getMany(['a', 'zzz', 'b']);
    expect([...found.keys()].sort()).toEqual(['a', 'b']);
  });

  it('returns nothing for no keys', async () => {
    expect((await new CardsRepository(new MemoryStorage()).getMany([])).size).toBe(0);
  });

  it('replaces a record saved again, as when prices are refreshed', async () => {
    const repo = new CardsRepository(new MemoryStorage());
    await repo.put(record('a'));
    await repo.put({ ...record('a'), fetchedAt: '2026-10-20T00:00:00.000Z' });
    expect((await repo.get('a'))!.fetchedAt).toBe('2026-10-20T00:00:00.000Z');
  });

  it('treats a damaged record as not saved', async () => {
    const storage = new MemoryStorage();
    const repo = new CardsRepository(storage);
    await storage.put('cards', 'junk', { hello: 'world' });
    await storage.put('cards', 'text', 'nope');
    await storage.put('cards', 'nothing', null);
    await storage.put('cards', 'no-summary', { key: 'x', fetchedAt: 'a', printings: [] });
    await storage.put('cards', 'no-printings', { key: 'x', fetchedAt: 'a', summary: { name: 'x' } });
    for (const key of ['junk', 'text', 'nothing', 'no-summary', 'no-printings']) expect(await repo.get(key)).toBeUndefined();
    expect((await repo.getMany(['junk', 'text'])).size).toBe(0);
  });
});
