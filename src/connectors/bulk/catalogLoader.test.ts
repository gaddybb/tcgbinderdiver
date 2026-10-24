// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { FORMAT_VERSION, MANIFEST_FILE, buildManifest, encodeScryfallCards } from '../../core/catalog';
import type { Manifest } from '../../core/catalog';
import fixture from '../../core/catalog/fixtures/default-cards.sample.jsonl?raw';
import { MemoryStorage } from '../../storage';
import { CatalogUnavailableError, loadCatalog } from './catalogLoader';

const raws = fixture.split('\n').filter(l => l.trim()).map(l => JSON.parse(l) as unknown);
const built = encodeScryfallCards(raws);

// A pretend site: a manifest and the two data files, as the build script would publish them.
function site(build: { cardsHash: string; pricesHash: string; at?: string; priceTweak?: boolean; updatedAt?: string }) {
  const prices = JSON.parse(JSON.stringify(built.prices));
  if (build.priceTweak) prices.prices[0][0] = [99999, null, null];
  const manifest: Manifest = buildManifest({
    builtAt: build.at ?? '2026-10-17T22:00:00.000Z',
    scryfallUpdatedAt: build.updatedAt ?? '2026-10-17T21:05:45.300+00:00',
    counts: built.counts,
    cardsHash: build.cardsHash,
    pricesHash: build.pricesHash,
  });
  const files = new Map<string, string>([
    ['/data/magic/' + MANIFEST_FILE, JSON.stringify(manifest)],
    ['/data/magic/' + manifest.files.cards, JSON.stringify(built.cards)],
    ['/data/magic/' + manifest.files.prices, JSON.stringify(prices)],
  ]);
  return { manifest, files };
}

// A fetch that serves a site, records every request, and can be made to fail.
function server(files: Map<string, string>, options: { down?: boolean; failFiles?: boolean; html?: boolean; status?: number } = {}) {
  const requests: { url: string; init?: RequestInit }[] = [];
  const state = { ...options, files };
  const fetch = async (url: string, init?: RequestInit): Promise<Response> => {
    requests.push({ url, init });
    if (state.down) throw new TypeError('Failed to fetch');
    const isManifest = url.endsWith(MANIFEST_FILE);
    if (!isManifest && state.failFiles) throw new TypeError('Failed to fetch');
    if (state.status) return new Response('nope', { status: state.status });
    if (isManifest && state.html) return new Response('<!doctype html><html></html>', { status: 200 });
    const body = state.files.get(url);
    return body === undefined ? new Response('not found', { status: 404 }) : new Response(body, { status: 200 });
  };
  return { fetch, requests, state, urls: () => requests.map(r => r.url) };
}

const A = site({ cardsHash: 'aaaa', pricesHash: 'pppp' });
const rejection = async (p: Promise<unknown>) => { try { await p; } catch (e) { return e as Error; } throw new Error('did not reject'); };

describe('loadCatalog: a first visit', () => {
  it('fetches the manifest, then both files, and returns the decoded catalog', async () => {
    const s = server(A.files);
    const loaded = await loadCatalog({ storage: new MemoryStorage(), fetch: s.fetch });
    expect(s.urls()).toEqual(['/data/magic/manifest.json', `/data/magic/${A.manifest.files.cards}`, `/data/magic/${A.manifest.files.prices}`]);
    expect(loaded.offline).toBe(false);
    expect(loaded.manifest).toEqual(A.manifest);
    expect(loaded.catalog.cards).toHaveLength(built.counts.cards);
    expect(loaded.catalog.find('Sol Ring')?.printings.length).toBeGreaterThan(0);
  });

  it('deletes the copy saved before each game had its own folder, and saves the new one under the game', async () => {
    const storage = new MemoryStorage();
    for (const k of ['manifest', 'cards', 'prices']) await storage.put('cache', `catalog:${k}`, { old: true });
    await loadCatalog({ storage, fetch: server(A.files).fetch });
    for (const k of ['manifest', 'cards', 'prices']) expect(await storage.get('cache', `catalog:${k}`)).toBeUndefined();
    expect(await storage.get('cache', 'catalog:magic:manifest')).toEqual(A.manifest);
  });

  it('still loads a manifest from before it named its game, variants and details', async () => {
    const old: Partial<Manifest> = { ...A.manifest };
    for (const added of ['game', 'variants', 'details'] as const) delete old[added];
    const files = new Map(A.files);
    files.set('/data/magic/' + MANIFEST_FILE, JSON.stringify(old));
    const loaded = await loadCatalog({ storage: new MemoryStorage(), fetch: server(files).fetch });
    expect(loaded.manifest.game).toBeUndefined();
    expect(loaded.catalog.cards).toHaveLength(built.counts.cards);
  });

  it('asks for the manifest fresh each time, because it is the only file that changes in place', async () => {
    const s = server(A.files);
    await loadCatalog({ storage: new MemoryStorage(), fetch: s.fetch });
    expect(s.requests[0].init?.cache).toBe('no-cache');
  });

  it('applies the prices, so printings come back with them', async () => {
    const s = server(A.files);
    const { catalog } = await loadCatalog({ storage: new MemoryStorage(), fetch: s.fetch });
    const anyPriced = catalog.cards.some(c => c.printings.some(p => p.prices.usd !== null));
    expect(anyPriced).toBe(true);
  });

  it('keeps what it downloaded on the device', async () => {
    const storage = new MemoryStorage();
    await loadCatalog({ storage, fetch: server(A.files).fetch });
    expect(await storage.get('cache', 'catalog:magic:manifest')).toEqual(A.manifest);
    expect(await storage.get<{ file: string }>('cache', 'catalog:magic:cards')).toMatchObject({ file: A.manifest.files.cards });
    expect(await storage.get<{ file: string }>('cache', 'catalog:magic:prices')).toMatchObject({ file: A.manifest.files.prices });
  });

  it('can be served from another folder', async () => {
    const moved = new Map([...A.files].map(([k, v]) => [k.replace('/data/magic/', '/assets/catalog/'), v]));
    const s = server(moved);
    await loadCatalog({ storage: new MemoryStorage(), fetch: s.fetch, base: '/assets/catalog/' });
    expect(s.urls()[0]).toBe('/assets/catalog/manifest.json');
  });
});

describe('loadCatalog: a repeat visit', () => {
  it('fetches only the manifest when nothing changed, and still returns the catalog', async () => {
    const storage = new MemoryStorage();
    await loadCatalog({ storage, fetch: server(A.files).fetch });
    const again = server(A.files);
    const loaded = await loadCatalog({ storage, fetch: again.fetch });
    expect(again.urls()).toEqual(['/data/magic/manifest.json']);
    expect(loaded.offline).toBe(false);
    expect(loaded.catalog.find('Sol Ring')).toBeDefined();
  });

  it('fetches only the prices file when only the prices changed (the daily refresh)', async () => {
    const storage = new MemoryStorage();
    const first = await loadCatalog({ storage, fetch: server(A.files).fetch });
    const B = site({ cardsHash: 'aaaa', pricesHash: 'qqqq', at: '2026-10-18T22:00:00.000Z', priceTweak: true });
    const s = server(B.files);
    const second = await loadCatalog({ storage, fetch: s.fetch });
    expect(s.urls()).toEqual(['/data/magic/manifest.json', `/data/magic/${B.manifest.files.prices}`]);
    expect(second.catalog.cards[0].printings[0].prices.usd).toBe('999.99');
    expect(first.catalog.cards[0].printings[0].prices.usd).not.toBe('999.99');
    expect(await storage.get<{ file: string }>('cache', 'catalog:magic:prices')).toMatchObject({ file: B.manifest.files.prices });
  });

  it('fetches the cards file when the cards changed', async () => {
    const storage = new MemoryStorage();
    await loadCatalog({ storage, fetch: server(A.files).fetch });
    const B = site({ cardsHash: 'bbbb', pricesHash: 'qqqq' });
    const s = server(B.files);
    await loadCatalog({ storage, fetch: s.fetch });
    expect(s.urls()).toEqual(['/data/magic/manifest.json', `/data/magic/${B.manifest.files.cards}`, `/data/magic/${B.manifest.files.prices}`]);
  });

  it('updates the saved manifest when only the build time changed', async () => {
    const storage = new MemoryStorage();
    await loadCatalog({ storage, fetch: server(A.files).fetch });
    const B = site({ cardsHash: 'aaaa', pricesHash: 'pppp', at: '2026-10-18T22:00:00.000Z' });
    await loadCatalog({ storage, fetch: server(B.files).fetch });
    expect((await storage.get<Manifest>('cache', 'catalog:magic:manifest'))!.builtAt).toBe('2026-10-18T22:00:00.000Z');
  });
});

describe('loadCatalog: when the site can not be reached', () => {
  const saved = async () => { const storage = new MemoryStorage(); await loadCatalog({ storage, fetch: server(A.files).fetch }); return storage; };

  it('uses the saved copy and says it is offline', async () => {
    const storage = await saved();
    const s = server(A.files, { down: true });
    const loaded = await loadCatalog({ storage, fetch: s.fetch });
    expect(loaded.offline).toBe(true);
    expect(loaded.catalog.find('Sol Ring')).toBeDefined();
    expect(s.urls()).toEqual(['/data/magic/manifest.json']);
  });

  it('uses the saved copy when a new file can not be downloaded', async () => {
    const storage = await saved();
    const B = site({ cardsHash: 'bbbb', pricesHash: 'qqqq' });
    const loaded = await loadCatalog({ storage, fetch: server(B.files, { failFiles: true }).fetch });
    expect(loaded.offline).toBe(true);
    expect(loaded.manifest).toEqual(A.manifest);
  });

  it('is unavailable on a first visit', async () => {
    const error = await rejection(loadCatalog({ storage: new MemoryStorage(), fetch: server(A.files, { down: true }).fetch }));
    expect(error).toBeInstanceOf(CatalogUnavailableError);
  });

  it('is unavailable when a file can not be downloaded on a first visit', async () => {
    const error = await rejection(loadCatalog({ storage: new MemoryStorage(), fetch: server(A.files, { failFiles: true }).fetch }));
    expect(error).toBeInstanceOf(CatalogUnavailableError);
  });
});

describe('loadCatalog: when there is no catalog on the site yet', () => {
  it('treats a 404 as unavailable', async () => {
    const error = await rejection(loadCatalog({ storage: new MemoryStorage(), fetch: server(new Map()).fetch }));
    expect(error).toBeInstanceOf(CatalogUnavailableError);
  });

  it('treats the single-page app fallback (the home page returned for any path) as unavailable', async () => {
    const error = await rejection(loadCatalog({ storage: new MemoryStorage(), fetch: server(A.files, { html: true }).fetch }));
    expect(error).toBeInstanceOf(CatalogUnavailableError);
  });

  it('treats a server error as unavailable', async () => {
    const error = await rejection(loadCatalog({ storage: new MemoryStorage(), fetch: server(A.files, { status: 503 }).fetch }));
    expect(error).toBeInstanceOf(CatalogUnavailableError);
  });

  it('treats a manifest in a format it does not know as unavailable', async () => {
    const odd = new Map(A.files);
    odd.set('/data/magic/manifest.json', JSON.stringify({ ...A.manifest, format: FORMAT_VERSION + 1 }));
    const error = await rejection(loadCatalog({ storage: new MemoryStorage(), fetch: server(odd).fetch }));
    expect(error).toBeInstanceOf(CatalogUnavailableError);
  });

  it('treats a manifest missing its fields as unavailable', async () => {
    const odd = new Map(A.files);
    odd.set('/data/magic/manifest.json', JSON.stringify({ format: FORMAT_VERSION }));
    const error = await rejection(loadCatalog({ storage: new MemoryStorage(), fetch: server(odd).fetch }));
    expect(error).toBeInstanceOf(CatalogUnavailableError);
  });

  it('still uses a saved copy when the site stops serving a manifest', async () => {
    const storage = new MemoryStorage();
    await loadCatalog({ storage, fetch: server(A.files).fetch });
    const loaded = await loadCatalog({ storage, fetch: server(new Map(), { html: true }).fetch });
    expect(loaded.offline).toBe(true);
  });
});

describe('loadCatalog: bad data', () => {
  it('does not save a download that will not decode, and is unavailable', async () => {
    const storage = new MemoryStorage();
    const bad = new Map(A.files);
    bad.set(`/data/magic/${A.manifest.files.cards}`, '{ this is not json');
    const error = await rejection(loadCatalog({ storage, fetch: server(bad).fetch }));
    expect(error).toBeInstanceOf(CatalogUnavailableError);
    expect(await storage.get('cache', 'catalog:magic:cards')).toBeUndefined();
    expect(await storage.get('cache', 'catalog:magic:manifest')).toBeUndefined();
  });

  it('is unavailable when the files are a format it does not know', async () => {
    const bad = new Map(A.files);
    bad.set(`/data/magic/${A.manifest.files.cards}`, JSON.stringify({ ...built.cards, format: FORMAT_VERSION + 1 }));
    const error = await rejection(loadCatalog({ storage: new MemoryStorage(), fetch: server(bad).fetch }));
    expect(error).toBeInstanceOf(CatalogUnavailableError);
    expect(error.message).toContain('format');
  });

  it('is unavailable when the prices do not match the cards', async () => {
    const bad = new Map(A.files);
    bad.set(`/data/magic/${A.manifest.files.prices}`, JSON.stringify({ format: FORMAT_VERSION, prices: [] }));
    const error = await rejection(loadCatalog({ storage: new MemoryStorage(), fetch: server(bad).fetch }));
    expect(error).toBeInstanceOf(CatalogUnavailableError);
  });

  it('throws away a saved copy that no longer reads, and downloads it again', async () => {
    const storage = new MemoryStorage();
    await loadCatalog({ storage, fetch: server(A.files).fetch });
    await storage.put('cache', 'catalog:magic:cards', { file: A.manifest.files.cards, text: 'garbage' });
    const s = server(A.files);
    const loaded = await loadCatalog({ storage, fetch: s.fetch });
    expect(loaded.offline).toBe(false);
    expect(loaded.catalog.find('Sol Ring')).toBeDefined();
    expect(s.urls().filter(u => u !== '/data/magic/manifest.json').length).toBeGreaterThan(0);
    expect((await storage.get<{ text: string }>('cache', 'catalog:magic:cards'))!.text).not.toBe('garbage');
  });

  it('gives up cleanly when a saved copy is bad and the site is down', async () => {
    const storage = new MemoryStorage();
    await loadCatalog({ storage, fetch: server(A.files).fetch });
    await storage.put('cache', 'catalog:magic:prices', { file: A.manifest.files.prices, text: 'garbage' });
    const error = await rejection(loadCatalog({ storage, fetch: server(A.files, { down: true }).fetch }));
    expect(error).toBeInstanceOf(CatalogUnavailableError);
    expect(await storage.get('cache', 'catalog:magic:prices')).toBeUndefined();
  });

  it('ignores saved files that belong to another build than the saved manifest', async () => {
    const storage = new MemoryStorage();
    await loadCatalog({ storage, fetch: server(A.files).fetch });
    await storage.put('cache', 'catalog:magic:cards', { file: 'cards.other.json', text: '{}' });
    const error = await rejection(loadCatalog({ storage, fetch: server(A.files, { down: true }).fetch }));
    expect(error).toBeInstanceOf(CatalogUnavailableError);
  });
});
