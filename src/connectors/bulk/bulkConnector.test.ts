// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { buildManifest, decodeCatalog, encodeScryfallCards } from '../../core/catalog';
import { fingerprint } from '../../core/handoff';
import fixture from '../../core/catalog/fixtures/default-cards.sample.jsonl?raw';
import { pr } from '../../core/engine/fixtures';
import { fakeConnector } from '../fakeConnector';
import { ScryfallError } from '../scryfall';
import { BulkConnector, createBulkConnector } from './bulkConnector';
import type { LoadedCatalog } from './catalogLoader';

const built = encodeScryfallCards(fixture.split('\n').filter(l => l.trim()).map(l => JSON.parse(l) as unknown));
const UPDATED = '2026-10-17T21:05:45.300+00:00';
const manifest = buildManifest({ builtAt: '2026-10-17T22:00:00.000Z', scryfallUpdatedAt: UPDATED, counts: built.counts, cardsHash: 'a', pricesHash: 'b' });
const loaded = (offline = false): LoadedCatalog => ({ catalog: decodeCatalog(built.cards, built.prices), manifest, offline });

// A brand-new card the catalog does not know, that the live fake does.
const NEW_CARD = { name: 'Brand New Card', printings: [pr({ setCode: 'new', usd: '2.00' })] };

function setup(options: { load?: () => Promise<LoadedCatalog>; live?: Parameters<typeof fakeConnector>[0] } = {}) {
  const load = vi.fn(options.load ?? (async () => loaded()));
  const live = fakeConnector(options.live ?? [NEW_CARD, 'Sol Ring']);
  const connector = createBulkConnector({ load, fallback: live.connector });
  return { connector, load, live };
}

describe('BulkConnector: looking up names', () => {
  it('answers exact names from the catalog without asking the live API', async () => {
    const { connector, live } = setup();
    const result = await connector.lookupNames(['Sol Ring', 'Lightning Bolt']);
    expect(result.found.map(f => f.card.name)).toEqual(['Sol Ring', 'Lightning Bolt']);
    expect(result.notFound).toEqual([]);
    expect(live.calls.lookups).toEqual([]);
  });

  it('keeps the name as asked beside the card it found', async () => {
    const { connector } = setup();
    const { found } = await connector.lookupNames(['sol ring']);
    expect(found[0].requested).toBe('sol ring');
    expect(found[0].card.name).toBe('Sol Ring');
  });

  it('ignores case, accents and apostrophe style', async () => {
    const { connector } = setup();
    const { found } = await connector.lookupNames(['lim-dul\'s vault', 'AETHER VIAL'.replace('AE', 'Æ'), "Ajani's Pridemate"]);
    expect(found.map(f => f.card.name)).toEqual(["Lim-Dûl's Vault", 'Æther Vial', 'Ajani’s Pridemate']);
  });

  it('finds a double-faced or split card by its full name or its front face', async () => {
    const { connector } = setup();
    const { found } = await connector.lookupNames(['Fire // Ice', 'Fire', 'Delver of Secrets']);
    expect(found.map(f => f.card.name)).toEqual(['Fire // Ice', 'Delver of Secrets // Insectile Aberration']);   // "Fire" and "Fire // Ice" are one card
  });

  it('asks for a name given twice once', async () => {
    const { connector } = setup();
    const { found } = await connector.lookupNames(['Sol Ring', 'sol ring', 'SOL RING']);
    expect(found).toHaveLength(1);
  });

  it('does not offer a token as a card', async () => {
    const { connector, live } = setup({ live: [] });
    const result = await connector.lookupNames(['Treasure']);
    expect(result.found.map(f => f.card.typeLine)).toEqual(['Token Artifact — Treasure']);   // it is exact, so it answers, but autocomplete leaves it out
    expect(live.calls.lookups).toEqual([]);
  });

  it('marks each card with the time of the catalog data, and gives its pictures', async () => {
    const { connector } = setup();
    const { found } = await connector.lookupNames(['Sol Ring']);
    const card = found[0].card;
    expect(card.dataTime).toBe(UPDATED);
    expect(card.imageSmall).toMatch(/^https:\/\/cards\.scryfall\.io\/small\/front\/[0-9a-f]\/[0-9a-f]\/[0-9a-f-]+\.jpg$/);
    expect(card.imageNormal).toContain('/normal/front/');
    expect(card.oracleId).toBeTruthy();
  });

  it('reports the catalog batch to onBatch', async () => {
    const { connector } = setup();
    const batches: number[] = [];
    await connector.lookupNames(['Sol Ring', 'Forest'], { onBatch: b => { batches.push(b.found.length); } });
    expect(batches).toEqual([2]);
  });

  it('makes no live request when everything is local, and none for an empty list', async () => {
    const { connector, live } = setup();
    await connector.lookupNames(['Sol Ring']);
    expect(await connector.lookupNames([])).toEqual({ found: [], notFound: [] });
    expect(live.calls.lookups).toEqual([]);
  });
});

describe('BulkConnector: names the catalog does not know', () => {
  it('asks the live API for only those, and merges the answers', async () => {
    const { connector, live } = setup();
    const result = await connector.lookupNames(['Sol Ring', 'Brand New Card', 'Sol Rnig']);
    expect(live.calls.lookups).toEqual([['Brand New Card', 'Sol Rnig']]);
    expect(result.found.map(f => f.card.name)).toEqual(['Sol Ring', 'Brand New Card']);
    expect(result.notFound).toEqual(['Sol Rnig']);
  });

  it('marks live results as live, with no catalog time', async () => {
    const { connector } = setup();
    const { found } = await connector.lookupNames(['Brand New Card']);
    expect(found[0].card.dataTime).toBeUndefined();
  });

  it('reports the catalog batch and then the live batch', async () => {
    const { connector } = setup();
    const batches: string[][] = [];
    await connector.lookupNames(['Sol Ring', 'Brand New Card'], { onBatch: b => { batches.push(b.found.map(f => f.card.name)); } });
    expect(batches).toEqual([['Sol Ring'], ['Brand New Card']]);
  });

  it('lets a live failure surface, after the catalog batch was reported', async () => {
    const { connector, live } = setup();
    live.state.failLookup = true;
    const batches: number[] = [];
    await expect(connector.lookupNames(['Sol Ring', 'Brand New Card'], { onBatch: b => { batches.push(b.found.length); } })).rejects.toBeInstanceOf(ScryfallError);
    expect(batches).toEqual([1]);
  });
});

describe('BulkConnector: printings', () => {
  it('gives every paper printing from the catalog, with prices, without asking the live API', async () => {
    const { connector, live } = setup();
    const { found } = await connector.lookupNames(['Lightning Bolt']);
    const printings = await connector.printings(found[0].card);
    expect(printings.length).toBeGreaterThan(1);
    expect(printings.every(p => !p.digital && p.games.includes('paper'))).toBe(true);
    expect(printings.some(p => p.prices.usd !== null)).toBe(true);
    expect(live.calls.printings).toEqual([]);
  });

  it('includes basic lands, since they cost nothing here', async () => {
    const { connector } = setup();
    const { found } = await connector.lookupNames(['Forest']);
    expect((await connector.printings(found[0].card)).length).toBeGreaterThan(0);
  });

  it('leaves out digital, non-paper and memorabilia printings', async () => {
    const { connector } = setup();
    const { found } = await connector.lookupNames(['Black Lotus', 'Llanowar Elves']);
    const lotus = await connector.printings(found[0].card);
    expect(lotus.every(p => p.setType !== 'memorabilia')).toBe(true);
    const elves = await connector.printings(found[1].card);
    expect(elves.every(p => p.setType !== 'alchemy')).toBe(true);
  });

  it('asks the live API for a card that did not come from the catalog', async () => {
    const { connector, live } = setup();
    const { found } = await connector.lookupNames(['Brand New Card']);
    const printings = await connector.printings(found[0].card);
    expect(live.calls.printings).toEqual(['Brand New Card']);
    expect(printings[0].setCode).toBe('new');
  });
});

describe('BulkConnector: typos, suggestions and sets', () => {
  it('fuzzy finds an exact name locally and goes live otherwise', async () => {
    const { connector, live } = setup();
    expect(await connector.fuzzy('sol ring')).toMatchObject({ status: 'match', card: { name: 'Sol Ring', dataTime: UPDATED } });
    expect(await connector.fuzzy('zzzz nothing')).toEqual({ status: 'none' });
    expect(live.calls.lookups).toEqual([]);   // the fake's fuzzy answers none without a lookup; the point is it was asked after the local miss
  });

  it('autocompletes from the catalog, from two letters, in alphabetical order', async () => {
    const { connector, live } = setup();
    expect(await connector.autocomplete('s')).toEqual([]);
    expect(await connector.autocomplete(' l ')).toEqual([]);
    expect(await connector.autocomplete('li')).toEqual(["Lightning Bolt", "Lim-Dûl's Vault"]);
    expect(await connector.autocomplete('FOR')).toEqual(['Forest']);
    expect(await connector.autocomplete('aj')).toEqual(['Ajani’s Pridemate']);
    expect(live.calls.lookups).toEqual([]);
  });

  it('leaves tokens out of autocomplete', async () => {
    const { connector } = setup();
    expect(await connector.autocomplete('trea')).toEqual([]);
  });

  it('gives the sets from the catalog, not the live API', async () => {
    const { connector } = setup();
    const sets = await connector.sets(new Date());
    expect(sets.length).toBe(built.counts.sets);
    expect(sets[0]).toMatchObject({ digital: false });
    expect(sets.every(s => s.code === s.code.toLowerCase())).toBe(true);
  });

  it('files cards for the store the same way the live connector does', async () => {
    const { connector } = setup();
    expect(connector.sortOrder).toEqual(['White', 'Blue', 'Black', 'Red', 'Green', 'Multicolor', 'Colorless', 'Land']);
    const { found } = await connector.lookupNames(['Forest', 'Sol Ring', 'Lightning Bolt', 'Fire // Ice']);
    expect(found.map(f => connector.sortCategory(f.card))).toEqual(['Land', 'Colorless', 'Red', 'Multicolor']);
  });
});

describe('BulkConnector: when the catalog is not available', () => {
  const down = () => Promise.reject(new Error('no catalog'));

  it('sends every call to the live API', async () => {
    const { connector, live } = setup({ load: down });
    expect((await connector.lookupNames(['Sol Ring'])).found.map(f => f.card.name)).toEqual(['Sol Ring']);
    expect(live.calls.lookups).toEqual([['Sol Ring']]);
    const { found } = await connector.lookupNames(['Sol Ring']);
    await connector.printings(found[0].card);
    expect(live.calls.printings).toEqual(['Sol Ring']);
    expect(await connector.fuzzy('x')).toEqual({ status: 'none' });
    expect(await connector.autocomplete('so')).toEqual(['Sol Ring']);   // the live fake's own answer
    expect(await connector.sets(new Date())).toEqual([]);
  });

  it('gives live results no catalog time, so they are saved like before', async () => {
    const { connector } = setup({ load: down });
    const { found } = await connector.lookupNames(['Sol Ring']);
    expect(found[0].card.dataTime).toBeUndefined();
  });

  it('does not try the catalog again on every call', async () => {
    const { connector, load } = setup({ load: down });
    await connector.lookupNames(['Sol Ring']);
    await connector.lookupNames(['Sol Ring']);
    await connector.autocomplete('so');
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('BulkConnector: loading', () => {
  it('loads the catalog once, however many calls arrive at the same time', async () => {
    const { connector, load } = setup();
    await Promise.all([connector.lookupNames(['Sol Ring']), connector.autocomplete('so'), connector.sets(new Date()), connector.fuzzy('Forest')]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not load anything until it is used', () => {
    const { load } = setup();
    expect(load).not.toHaveBeenCalled();
  });

  it('says which catalog is in use, and whether it came from the saved copy', async () => {
    const { connector } = setup();
    expect(await connector.catalogInfo()).toEqual({ builtAt: manifest.builtAt, scryfallUpdatedAt: UPDATED, offline: false });
    const offline = createBulkConnector({ load: async () => loaded(true), fallback: fakeConnector([]).connector });
    expect((await offline.catalogInfo())?.offline).toBe(true);
  });

  it('says there is no catalog when it could not be loaded', async () => {
    const { connector } = setup({ load: () => Promise.reject(new Error('x')) });
    expect(await connector.catalogInfo()).toBeNull();
  });

  it('has every catalog card name by fingerprint, for the compact phone link, and none when the live API is in use', async () => {
    const { connector } = setup();
    const index = (await connector.fingerprintIndex())!;
    expect(index.get(fingerprint('Sol Ring'))).toBe('Sol Ring');
    expect(index.size).toBeGreaterThan(1);
    const { connector: live } = setup({ load: () => Promise.reject(new Error('x')) });
    expect(await live.fingerprintIndex()).toBeNull();
  });

  it('is a GameConnector for Magic', () => {
    const { connector } = setup();
    expect(connector).toBeInstanceOf(BulkConnector);
    expect(connector.game).toBe('magic');
  });
});
