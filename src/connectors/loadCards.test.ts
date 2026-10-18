import { describe, expect, it } from 'vitest';
import type { CardRecord } from '../core/cards';
import { CardsRepository } from '../storage/cardsRepository';
import { MemoryStorage } from '../storage/memoryStorage';
import { fakeConnector } from './fakeConnector';
import { loadCards } from './loadCards';
import type { LoadProgress } from './loadCards';

const NOW = new Date('2026-10-17T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 3600 * 1000);

const setup = (known: string[], options?: Parameters<typeof fakeConnector>[1]) => {
  const storage = new MemoryStorage();
  return { storage, repo: new CardsRepository(storage), ...fakeConnector(known, options) };
};
const want = (...names: string[]) => names.map(name => ({ cardKey: name.toLowerCase(), name }));

describe('loadCards', () => {
  it('fetches each missing card and every printing, saves it and returns it', async () => {
    const { connector, repo, calls } = setup(['Sol Ring', 'Arcane Signet']);
    const result = await loadCards({ connector, repo, cards: want('Sol Ring', 'Arcane Signet'), now: NOW });
    expect([...result.records.keys()].sort()).toEqual(['arcane signet', 'sol ring']);
    expect(result.records.get('sol ring')).toMatchObject({ key: 'sol ring', fetchedAt: NOW.toISOString(), summary: { name: 'Sol Ring' } });
    expect(result.records.get('sol ring')!.printings).toHaveLength(1);
    expect(result).toMatchObject({ notFound: [], failed: false, aborted: false });
    expect(calls.lookups).toEqual([['Sol Ring', 'Arcane Signet']]);
    expect(calls.printings.sort()).toEqual(['Arcane Signet', 'Sol Ring']);
    expect(await repo.get('sol ring')).toBeDefined();
  });

  it('reports progress, counting every card including ones that were not found', async () => {
    const { connector, repo } = setup(['Sol Ring', 'Mana Crypt']);
    const seen: LoadProgress[] = [];
    await loadCards({ connector, repo, cards: want('Sol Ring', 'Nonsense', 'Mana Crypt'), now: NOW, onProgress: p => seen.push(p) });
    expect(seen[0]).toEqual({ total: 3, done: 0 });
    expect(seen[seen.length - 1]).toEqual({ total: 3, done: 3 });
    expect(seen.map(p => p.done)).toEqual([...seen.map(p => p.done)].sort((a, b) => a - b));
  });

  it('says which cards the data source does not know, by card key', async () => {
    const { connector, repo } = setup(['Sol Ring']);
    const result = await loadCards({ connector, repo, cards: want('Sol Ring', 'Sol Rnig'), now: NOW });
    expect(result.notFound).toEqual(['sol rnig']);
    expect(result.records.has('sol rnig')).toBe(false);
    expect(await repo.get('sol rnig')).toBeUndefined();
  });

  it('tells the screen about saved cards before fetching, and each new card as it arrives', async () => {
    const { connector, repo } = setup(['Sol Ring', 'Arcane Signet']);
    await loadCards({ connector, repo, cards: want('Sol Ring'), now: NOW });
    const cached: string[][] = [];
    const arrived: string[] = [];
    await loadCards({ connector, repo, cards: want('Sol Ring', 'Arcane Signet'), now: NOW, onCached: r => cached.push([...r.keys()]), onRecord: r => arrived.push(r.key) });
    expect(cached).toEqual([['sol ring']]);
    expect(arrived).toEqual(['arcane signet']);
  });

  it('does not ask again for cards that are saved and fresh', async () => {
    const { connector, repo, calls } = setup(['Sol Ring']);
    await loadCards({ connector, repo, cards: want('Sol Ring'), now: NOW });
    calls.lookups.length = 0; calls.printings.length = 0;
    const result = await loadCards({ connector, repo, cards: want('Sol Ring'), now: daysAgo(-3) });
    expect(calls.lookups).toEqual([]);
    expect(calls.printings).toEqual([]);
    expect(result.records.has('sol ring')).toBe(true);
  });

  it('makes no request at all when there is nothing to fetch', async () => {
    const { connector, repo, calls } = setup([]);
    const result = await loadCards({ connector, repo, cards: [], now: NOW });
    expect(calls.lookups).toEqual([]);
    expect(result).toMatchObject({ failed: false, aborted: false });
    expect(result.records.size).toBe(0);
  });

  it('fetches a saved card again once its data is a week old, so prices are fresh', async () => {
    const { connector, repo, calls } = setup(['Sol Ring']);
    await loadCards({ connector, repo, cards: want('Sol Ring'), now: daysAgo(8) });
    calls.lookups.length = 0;
    const result = await loadCards({ connector, repo, cards: want('Sol Ring'), now: NOW });
    expect(calls.lookups).toEqual([['Sol Ring']]);
    expect(result.records.get('sol ring')!.fetchedAt).toBe(NOW.toISOString());
  });

  it('fetches only the cards that are missing', async () => {
    const { connector, repo, calls } = setup(['Sol Ring', 'Arcane Signet']);
    await loadCards({ connector, repo, cards: want('Sol Ring'), now: NOW });
    calls.lookups.length = 0; calls.printings.length = 0;
    await loadCards({ connector, repo, cards: want('Sol Ring', 'Arcane Signet'), now: NOW });
    expect(calls.lookups).toEqual([['Arcane Signet']]);
    expect(calls.printings).toEqual(['Arcane Signet']);
  });

  it('asks once for a card wanted under two names ("Fire" and "Fire // Ice") and saves it under both keys', async () => {
    const { connector, repo, calls } = setup(['Fire // Ice']);
    const result = await loadCards({
      connector, repo, now: NOW,
      cards: [{ cardKey: 'k1', name: 'Fire // Ice' }, { cardKey: 'k2', name: 'Fire' }],
    });
    expect(calls.printings).toEqual(['Fire // Ice']);
    expect([...result.records.keys()].sort()).toEqual(['k1', 'k2']);
    expect(await repo.get('k2')).toMatchObject({ summary: { name: 'Fire // Ice' } });
  });

  it('counts a card key given twice once', async () => {
    const { connector, repo, calls } = setup(['Sol Ring']);
    const progress: LoadProgress[] = [];
    await loadCards({ connector, repo, now: NOW, cards: [...want('Sol Ring'), ...want('Sol Ring')], onProgress: p => progress.push(p) });
    expect(calls.lookups).toEqual([['Sol Ring']]);
    expect(progress[0].total).toBe(1);
  });

  describe('when the data source can not be reached', () => {
    it('says so, and has nothing new', async () => {
      const { connector, repo } = setup(['Sol Ring'], { failLookup: true });
      const result = await loadCards({ connector, repo, cards: want('Sol Ring'), now: NOW });
      expect(result).toMatchObject({ failed: true, aborted: false });
      expect(result.records.size).toBe(0);
    });

    it('keeps what was saved before, even out of date, so the list still shows', async () => {
      const { connector, repo } = setup(['Sol Ring']);
      await loadCards({ connector, repo, cards: want('Sol Ring'), now: daysAgo(30) });
      const down = fakeConnector(['Sol Ring'], { failLookup: true });
      const result = await loadCards({ connector: down.connector, repo, cards: want('Sol Ring'), now: NOW });
      expect(result.failed).toBe(true);
      expect(result.records.get('sol ring')!.summary.name).toBe('Sol Ring');
    });

    it('keeps the cards that arrived before the failure, and the next try fetches only the rest', async () => {
      const first = setup(['Sol Ring', 'Mana Crypt'], { failPrintingsFor: ['Mana Crypt'] });
      const result = await loadCards({ connector: first.connector, repo: first.repo, cards: want('Sol Ring', 'Mana Crypt'), now: NOW });
      expect(result.failed).toBe(true);
      expect([...result.records.keys()]).toEqual(['sol ring']);

      const second = fakeConnector(['Sol Ring', 'Mana Crypt']);
      const retried = await loadCards({ connector: second.connector, repo: first.repo, cards: want('Sol Ring', 'Mana Crypt'), now: NOW });
      expect(retried.failed).toBe(false);
      expect(second.calls.lookups).toEqual([['Mana Crypt']]);
      expect([...retried.records.keys()].sort()).toEqual(['mana crypt', 'sol ring']);
    });
  });

  describe('when it is stopped', () => {
    it('says it was stopped, not that it failed', async () => {
      const { connector, repo } = setup(['Sol Ring'], { abortOnLookup: true });
      const result = await loadCards({ connector, repo, cards: want('Sol Ring'), now: NOW });
      expect(result).toMatchObject({ aborted: true, failed: false });
    });

    it('stops straight away when already cancelled', async () => {
      const { connector, repo } = setup(['Sol Ring']);
      const controller = new AbortController(); controller.abort();
      const result = await loadCards({ connector, repo, cards: want('Sol Ring'), now: NOW, signal: controller.signal });
      expect(result.aborted).toBe(true);
      expect(await repo.get('sol ring')).toBeUndefined();
    });
  });

  it('returns saved records as CardRecord with the fields the app uses', async () => {
    const { connector, repo } = setup(['Sol Ring']);
    const { records } = await loadCards({ connector, repo, cards: want('Sol Ring'), now: NOW });
    const record: CardRecord = records.get('sol ring')!;
    expect(Object.keys(record).sort()).toEqual(['fetchedAt', 'key', 'printings', 'summary']);
  });
});
