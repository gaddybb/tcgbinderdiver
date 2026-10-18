// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync('public/sw.js', 'utf8');
const ORIGIN = 'https://binderdiver.test';

type Handler = (event: unknown) => void;

// Runs public/sw.js against a small pretend browser: a cache, a network that can be switched off, and the worker's events.
function worker(initialCaches: Record<string, Map<string, Response>> = {}) {
  const handlers: Record<string, Handler> = {};
  const stores = new Map<string, Map<string, Response>>(Object.entries(initialCaches));
  const network = { up: true, status: 200, fetched: [] as string[], body: 'from the network' };
  const keyOf = (k: string | { url: string }) => new URL(typeof k === 'string' ? k : k.url, ORIGIN).href;
  const current = () => {
    let store = stores.get('binder-diver-v1');
    if (!store) { store = new Map(); stores.set('binder-diver-v1', store); }
    return store;
  };

  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    open: async () => ({ put: async (k: string | { url: string }, v: Response) => { current().set(keyOf(k), v); } }),
    match: async (k: string | { url: string }) => { for (const store of stores.values()) { const hit = store.get(keyOf(k)); if (hit) return hit.clone(); } return undefined; },
  };
  const fetchStub = async (request: { url: string }) => {
    network.fetched.push(new URL(request.url).pathname);
    if (!network.up) throw new TypeError('offline');
    return new Response(network.body, { status: network.status });
  };
  const self = { location: { origin: ORIGIN }, addEventListener: (type: string, fn: Handler) => { handlers[type] = fn; }, skipWaiting: () => undefined, clients: { claim: async () => undefined } };
  runInNewContext(SOURCE, { self, caches, fetch: fetchStub, Response, URL, Promise });

  const request = (path: string, init: { method?: string; mode?: string; origin?: string } = {}) =>
    ({ method: init.method ?? 'GET', url: `${init.origin ?? ORIGIN}${path}`, mode: init.mode ?? 'no-cors' });
  const ask = async (req: ReturnType<typeof request>): Promise<Response | undefined> => {
    let answer: Promise<Response> | undefined;
    handlers.fetch({ request: req, respondWith: (p: Promise<Response>) => { answer = p; } });
    const response = await answer;
    await new Promise(r => setTimeout(r, 0));   // let the copy be saved
    return response;
  };
  return { handlers, stores, network, request, ask, current };
}

describe('the service worker', () => {
  it('leaves other requests alone: not a GET, and not this site', async () => {
    const w = worker();
    expect(await w.ask(w.request('/api', { method: 'POST' }))).toBeUndefined();
    expect(await w.ask(w.request('/cards/x.jpg', { origin: 'https://cards.scryfall.io' }))).toBeUndefined();
    expect(w.network.fetched).toEqual([]);
  });

  it('gives a page from the network and keeps it, then serves the kept page with no network', async () => {
    const w = worker();
    const online = await w.ask(w.request('/lists/abc', { mode: 'navigate' }));
    expect(await online!.text()).toBe('from the network');
    expect([...w.current().keys()]).toEqual([`${ORIGIN}/index.html`]);
    w.network.up = false;
    const offline = await w.ask(w.request('/dive', { mode: 'navigate' }));
    expect(await offline!.text()).toBe('from the network');   // the kept page: the app itself opens at any address
  });

  it('answers a page with an error when there is no network and nothing kept', async () => {
    const w = worker();
    w.network.up = false;
    expect((await w.ask(w.request('/plan', { mode: 'navigate' })))!.type).toBe('error');
  });

  it('serves a kept /assets file without asking the network, and keeps one it had to fetch', async () => {
    const w = worker();
    const first = await w.ask(w.request('/assets/index-abc.js'));
    expect(await first!.text()).toBe('from the network');
    expect(w.network.fetched).toEqual(['/assets/index-abc.js']);
    w.network.up = false;
    const again = await w.ask(w.request('/assets/index-abc.js'));
    expect(await again!.text()).toBe('from the network');
    expect(w.network.fetched).toHaveLength(1);
  });

  it('treats the hashed card data files the same way', async () => {
    const w = worker();
    await w.ask(w.request('/data/cards.3a1a6faee2.json'));
    w.network.up = false;
    expect((await w.ask(w.request('/data/cards.3a1a6faee2.json')))!.ok).toBe(true);
    await expect(async () => { const r = await w.ask(w.request('/data/prices.zzz.json')); if (r!.type === 'error') throw new Error('offline'); }).rejects.toThrow();
  });

  it('asks the network first for the data manifest, so a new build is noticed, and falls back to the kept one', async () => {
    const w = worker();
    w.network.body = 'manifest v1';
    await w.ask(w.request('/data/manifest.json'));
    w.network.body = 'manifest v2';
    expect(await (await w.ask(w.request('/data/manifest.json')))!.text()).toBe('manifest v2');
    w.network.up = false;
    expect(await (await w.ask(w.request('/data/manifest.json')))!.text()).toBe('manifest v2');
  });

  it('does not keep a failed answer', async () => {
    const w = worker();
    w.network.status = 404;
    const response = await w.ask(w.request('/icon.svg'));
    expect(response!.status).toBe(404);   // still passed on to the page
    expect(w.current().size).toBe(0);     // but not kept
  });

  it('on activation, deletes the caches of older versions', async () => {
    const w = worker({ 'binder-diver-v0': new Map(), 'binder-diver-v1': new Map() });
    let waited: Promise<unknown> | undefined;
    w.handlers.activate({ waitUntil: (p: Promise<unknown>) => { waited = p; } });
    await waited;
    expect([...w.stores.keys()]).toEqual(['binder-diver-v1']);
  });
});
