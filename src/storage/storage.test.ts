import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COLLECTIONS, IndexedDbStorage, MemoryStorage, createStorage } from './index';
import type { AppStorage } from './index';

let dbCounter = 0;
const freshDbName = () => `test-db-${dbCounter++}`;

const opened: IndexedDbStorage[] = [];
afterEach(() => {
  vi.unstubAllGlobals();
  while (opened.length) opened.pop()!.close();
});

// The same contract for every backend, so swapping one for another (Supabase in v3) is safe.
const backends: [string, () => Promise<AppStorage>][] = [
  ['MemoryStorage', async () => new MemoryStorage()],
  ['IndexedDbStorage', async () => { const s = await IndexedDbStorage.open(freshDbName()); opened.push(s); return s; }],
];

describe.each(backends)('%s contract', (_name, make) => {
  it('get returns undefined for a missing key', async () => {
    const s = await make();
    expect(await s.get('lists', 'nope')).toBeUndefined();
  });

  it('put then get round-trips nested data, arrays and dates', async () => {
    const s = await make();
    const value = { id: 'a', entries: [{ name: 'Sol Ring', quantity: 2, tags: ['ramp'] }], at: new Date('2026-10-17T00:00:00Z'), none: null };
    await s.put('lists', 'a', value);
    expect(await s.get('lists', 'a')).toEqual(value);
  });

  it('put overwrites the existing value', async () => {
    const s = await make();
    await s.put('lists', 'a', { v: 1 });
    await s.put('lists', 'a', { v: 2 });
    expect(await s.get('lists', 'a')).toEqual({ v: 2 });
    expect(await s.list('lists')).toHaveLength(1);
  });

  it('delete removes a key and ignores a missing one', async () => {
    const s = await make();
    await s.put('lists', 'a', 1);
    await s.delete('lists', 'a');
    await s.delete('lists', 'never-existed');
    expect(await s.get('lists', 'a')).toBeUndefined();
  });

  it('list returns every value in the collection, ordered by key', async () => {
    const s = await make();
    await s.put('lists', 'b', 'second');
    await s.put('lists', 'c', 'third');
    await s.put('lists', 'a', 'first');
    expect(await s.list('lists')).toEqual(['first', 'second', 'third']);
  });

  it('list is empty for an empty collection', async () => {
    const s = await make();
    expect(await s.list('trips')).toEqual([]);
  });

  it('keeps collections separate, even with the same key', async () => {
    const s = await make();
    await s.put('lists', 'x', 'list value');
    await s.put('settings', 'x', 'settings value');
    expect(await s.get('lists', 'x')).toBe('list value');
    expect(await s.get('settings', 'x')).toBe('settings value');
    expect(await s.list('cards')).toEqual([]);
  });

  it('clear empties one collection and leaves the others', async () => {
    const s = await make();
    await s.put('lists', 'a', 1);
    await s.put('lists', 'b', 2);
    await s.put('settings', 'a', 3);
    await s.clear('lists');
    expect(await s.list('lists')).toEqual([]);
    expect(await s.get('settings', 'a')).toBe(3);
  });

  it('does not share objects with the caller', async () => {
    const s = await make();
    const original = { items: [1] };
    await s.put('lists', 'a', original);
    original.items.push(2);
    const read = await s.get<{ items: number[] }>('lists', 'a');
    expect(read!.items).toEqual([1]);
    read!.items.push(3);
    expect(await s.get('lists', 'a')).toEqual({ items: [1] });
  });

  it('works for every collection', async () => {
    const s = await make();
    for (const c of COLLECTIONS) {
      await s.put(c, 'k', c);
      expect(await s.get(c, 'k')).toBe(c);
    }
  });
});

describe('IndexedDbStorage', () => {
  it('is persistent and keeps data after closing and reopening', async () => {
    const name = freshDbName();
    const first = await IndexedDbStorage.open(name);
    expect(first.persistent).toBe(true);
    await first.put('lists', 'a', { name: 'My deck' });
    first.close();
    const second = await IndexedDbStorage.open(name);
    opened.push(second);
    expect(await second.get('lists', 'a')).toEqual({ name: 'My deck' });
  });

  it('keeps separate databases separate', async () => {
    const a = await IndexedDbStorage.open(freshDbName());
    const b = await IndexedDbStorage.open(freshDbName());
    opened.push(a, b);
    await a.put('lists', 'k', 1);
    expect(await b.get('lists', 'k')).toBeUndefined();
  });
});

describe('MemoryStorage', () => {
  it('is not persistent', () => {
    expect(new MemoryStorage().persistent).toBe(false);
  });
});

describe('createStorage', () => {
  it('uses IndexedDB when it is available', async () => {
    const s = await createStorage(freshDbName());
    expect(s.persistent).toBe(true);
    if (s instanceof IndexedDbStorage) opened.push(s);
  });

  it('falls back to memory when IndexedDB is missing', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const s = await createStorage(freshDbName());
    expect(s.persistent).toBe(false);
    await s.put('lists', 'a', 1);
    expect(await s.get('lists', 'a')).toBe(1);
  });

  it('falls back to memory when IndexedDB refuses to open', async () => {
    vi.stubGlobal('indexedDB', { open() { throw new Error('blocked'); } });
    const s = await createStorage(freshDbName());
    expect(s.persistent).toBe(false);
  });
});
