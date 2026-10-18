import { describe, expect, it } from 'vitest';
import type { CardRecord } from '../core/cards';
import { CardsRepository } from '../storage/cardsRepository';
import { MemoryStorage } from '../storage/memoryStorage';
import { fakeConnector } from './fakeConnector';
import type { FakeCard } from './fakeConnector';
import { loadCards, PRINTINGS_CONCURRENCY } from './loadCards';
import type { LoadProgress } from './loadCards';
import { ScryfallClient, ScryfallConnector } from './scryfall';
import { json, list, makeVirtualClock, rawCard, scripted } from './scryfall/testkit';
import type { Call } from './scryfall/testkit';

const NOW = new Date('2026-10-17T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 3600 * 1000);

const setup = (known: (string | FakeCard)[], options?: Parameters<typeof fakeConnector>[1]) => {
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

  describe('basic lands', () => {
    const lands = [{ name: 'Forest', typeLine: 'Basic Land — Forest' }, { name: 'Snow-Covered Island', typeLine: 'Basic Snow Land — Island' }];

    it('are saved with their picture and type but no printings, and no printings are requested for them', async () => {
      const { connector, repo, calls } = setup(['Sol Ring', ...lands]);
      const seen: LoadProgress[] = [];
      const result = await loadCards({ connector, repo, cards: want('Sol Ring', 'Forest', 'Snow-Covered Island'), now: NOW, onProgress: p => seen.push(p) });
      expect(calls.printings).toEqual(['Sol Ring']);
      expect(result.records.get('forest')).toMatchObject({ summary: { name: 'Forest', typeLine: 'Basic Land — Forest' }, printings: [], fetchedAt: NOW.toISOString() });
      expect(result.records.get('forest')!.summary.imageSmall).toBeTruthy();
      expect(await repo.get('snow-covered island')).toMatchObject({ printings: [] });
      expect(result).toMatchObject({ failed: false, notFound: [] });
      expect(seen[seen.length - 1]).toEqual({ total: 3, done: 3 });
    });

    it('are fetched in full when basics are included', async () => {
      const { connector, repo, calls } = setup(['Sol Ring', ...lands]);
      const result = await loadCards({ connector, repo, cards: want('Sol Ring', 'Forest'), now: NOW, includeBasics: true });
      expect(calls.printings.sort()).toEqual(['Forest', 'Sol Ring']);
      expect(result.records.get('forest')!.printings).toHaveLength(1);
    });

    it('never touch the printings source, so a list of only basics can not fail there', async () => {
      const { connector, repo } = setup(lands, { failPrintingsFor: ['Forest'] });
      const result = await loadCards({ connector, repo, cards: want('Forest'), now: NOW });
      expect(result.failed).toBe(false);
      expect(result.records.has('forest')).toBe(true);
    });

    it('are told apart by type, not by name', async () => {
      const { connector, repo, calls } = setup([{ name: 'Basic Wizard', typeLine: 'Creature — Wizard' }]);
      await loadCards({ connector, repo, cards: want('Basic Wizard'), now: NOW });
      expect(calls.printings).toEqual(['Basic Wizard']);
    });
  });

  // The real Scryfall connector and client over a scripted fetch on a virtual clock, so request timing can be checked.
  describe('with the paced Scryfall client', () => {
    const LATENCY_MS = 300;
    const CARDS = 12;
    const names = Array.from({ length: CARDS }, (_, i) => `Card ${i}`);

    function scryfall(options: { names?: string[]; failName?: string; onPrintings?: (call: Call) => void } = {}) {
      const known = options.names ?? names;
      const clock = makeVirtualClock();
      const state = { inFlight: 0, maxInFlight: 0 };
      const cardOf = (name: string) => rawCard({
        id: `id-${name}`, oracle_id: `oracle-${name}`, name,
        type_line: name === 'Forest' ? 'Basic Land — Forest' : 'Artifact',
        prints_search_uri: `https://api.scryfall.com/cards/search?q=oracleid%3A${encodeURIComponent(name)}&unique=prints`,
      });
      const { fetch, calls } = scripted(async call => {
        if (call.method === 'POST') return json(list((call.body as { identifiers: { name: string }[] }).identifiers.map(x => cardOf(x.name))));
        options.onPrintings?.(call);
        state.maxInFlight = Math.max(state.maxInFlight, ++state.inFlight);
        await clock.sleep(LATENCY_MS);
        state.inFlight--;
        const name = decodeURIComponent(new URL(call.url).searchParams.get('q')!.replace('oracleid:', ''));
        if (name === options.failName) return json({ object: 'error' }, 503);
        return json(list([rawCard({ oracle_id: `oracle-${name}` })]));
      }, clock.now);
      const client = new ScryfallClient({ fetch, sleep: clock.sleep, now: clock.now, maxRetries: 0 });
      return { clock, state, calls, known, connector: new ScryfallConnector({ client }) };
    }

    const printingCalls = (calls: Call[]) => calls.filter(c => c.method === 'GET');
    const timed = async (concurrency: number) => {
      const s = scryfall();
      const repo = new CardsRepository(new MemoryStorage());
      const result = await s.clock.run(loadCards({ connector: s.connector, repo, cards: want(...names), now: NOW, concurrency }));
      return { ...s, result, elapsed: s.clock.time };
    };

    it('starts every request at least 100 ms after the one before, however many are in flight', async () => {
      const { calls, state, result } = await timed(PRINTINGS_CONCURRENCY);
      expect(result).toMatchObject({ failed: false, aborted: false });
      expect(result.records.size).toBe(CARDS);
      expect(calls).toHaveLength(CARDS + 1);   // one name lookup, one printings request per card
      const starts = calls.map(c => c.at);
      for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(100);
      expect(state.maxInFlight).toBe(PRINTINGS_CONCURRENCY);
    });

    it('takes much less time than one card at a time, for the same requests', async () => {
      const one = await timed(1);
      const four = await timed(PRINTINGS_CONCURRENCY);
      expect(one.state.maxInFlight).toBe(1);
      expect(one.elapsed).toBeGreaterThanOrEqual(CARDS * LATENCY_MS);
      expect(four.elapsed).toBeLessThan(one.elapsed * 0.45);   // 3700 ms against 1500 ms with 300 ms requests: starts are staggered 100 ms apart
      expect(four.calls.map(c => c.url).sort()).toEqual(one.calls.map(c => c.url).sort());
    });

    it('saves each card as it arrives and counts progress up to the total', async () => {
      const s = scryfall();
      const repo = new CardsRepository(new MemoryStorage());
      const progress: number[] = [];
      const arrived: string[] = [];
      await s.clock.run(loadCards({
        connector: s.connector, repo, cards: want(...names), now: NOW,
        onProgress: p => progress.push(p.done), onRecord: r => arrived.push(r.key),
      }));
      expect(progress[0]).toBe(0);
      expect(progress[progress.length - 1]).toBe(CARDS);
      expect(progress).toEqual([...progress].sort((a, b) => a - b));
      expect(arrived.sort()).toEqual(names.map(n => n.toLowerCase()).sort());
      expect((await repo.getMany(names.map(n => n.toLowerCase()))).size).toBe(CARDS);
    });

    it('makes no printings request for basic lands', async () => {
      const withForest = [...names.slice(0, CARDS - 1), 'Forest'];
      const s = scryfall({ names: withForest });
      const repo = new CardsRepository(new MemoryStorage());
      const result = await s.clock.run(loadCards({ connector: s.connector, repo, cards: want(...withForest), now: NOW }));
      expect(printingCalls(s.calls)).toHaveLength(CARDS - 1);
      expect(result.records.get('forest')!.printings).toEqual([]);
    });

    it('stops starting new cards after the first real failure, and keeps what was saved', async () => {
      const s = scryfall({ failName: 'Card 1' });
      const repo = new CardsRepository(new MemoryStorage());
      const result = await s.clock.run(loadCards({ connector: s.connector, repo, cards: want(...names), now: NOW }));
      expect(result).toMatchObject({ failed: true, aborted: false });
      expect(printingCalls(s.calls).length).toBeLessThan(CARDS);
      const saved = [...result.records.keys()];
      expect(saved).not.toContain('card 1');
      expect(saved.length).toBeGreaterThan(0);
      expect([...(await repo.getMany(names.map(n => n.toLowerCase()))).keys()].sort()).toEqual([...saved].sort());
    });

    it('abort stops everything and says it was stopped, not failed', async () => {
      const controller = new AbortController();
      const s = scryfall({ onPrintings: () => controller.abort() });
      const repo = new CardsRepository(new MemoryStorage());
      const result = await s.clock.run(loadCards({ connector: s.connector, repo, cards: want(...names), now: NOW, signal: controller.signal }));
      expect(result).toMatchObject({ aborted: true, failed: false });
      expect(printingCalls(s.calls).length).toBeLessThanOrEqual(PRINTINGS_CONCURRENCY);
    });
  });

  it('returns saved records as CardRecord with the fields the app uses', async () => {
    const { connector, repo } = setup(['Sol Ring']);
    const { records } = await loadCards({ connector, repo, cards: want('Sol Ring'), now: NOW });
    const record: CardRecord = records.get('sol ring')!;
    expect(Object.keys(record).sort()).toEqual(['fetchedAt', 'key', 'printings', 'summary']);
  });
});
