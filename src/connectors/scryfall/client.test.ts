// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ScryfallClient, ScryfallError } from './client';
import { json, makeClock, scripted } from './testkit';

function setup(handler: Parameters<typeof scripted>[0], options: ConstructorParameters<typeof ScryfallClient>[0] = {}) {
  const clock = makeClock();
  const s = scripted(handler, clock.now);
  const client = new ScryfallClient({ fetch: s.fetch, sleep: clock.sleep, now: clock.now, ...options });
  return { client, clock, ...s };
}

const rejection = async (p: Promise<unknown>) => { try { await p; } catch (e) { return e as ScryfallError; } throw new Error('did not reject'); };

describe('ScryfallClient headers', () => {
  it('sends Accept, and no custom User-Agent, on a GET', async () => {
    const { client, calls } = setup(() => json({ ok: true }));
    await client.get('/cards/named?exact=Sol+Ring');
    expect(calls[0].url).toBe('https://api.scryfall.com/cards/named?exact=Sol+Ring');
    expect(calls[0].method).toBe('GET');
    expect(calls[0].headers.Accept).toContain('application/json');
    expect(Object.keys(calls[0].headers).map(h => h.toLowerCase())).not.toContain('user-agent');
  });

  it('sends a JSON body and Content-Type on a POST', async () => {
    const { client, calls } = setup(() => json({ ok: true }));
    await client.post('/cards/collection', { identifiers: [{ name: 'Sol Ring' }] });
    expect(calls[0].method).toBe('POST');
    expect(calls[0].headers['Content-Type']).toBe('application/json');
    expect(calls[0].body).toEqual({ identifiers: [{ name: 'Sol Ring' }] });
  });
});

describe('ScryfallClient pacing', () => {
  it('starts requests at least 100 ms apart', async () => {
    const { client, calls } = setup(() => json({}));
    await client.get('/a'); await client.get('/b'); await client.get('/c');
    expect(calls.map(c => c.at)).toEqual([0, 100, 200]);
  });

  it('reserves a separate slot for each concurrent request', async () => {
    // The clock never moves, so every wait is measured from the same start: 0, 100, 200.
    const waits: number[] = [];
    const client = new ScryfallClient({
      now: () => 0,
      sleep: async (ms) => { waits.push(ms); },
      fetch: async () => json({}),
    });
    await Promise.all([client.get('/a'), client.get('/b'), client.get('/c')]);
    expect(waits).toEqual([100, 200]);
  });
});

describe('ScryfallClient retries', () => {
  it('retries a 429 with doubling backoff (1 s, 2 s) and then succeeds', async () => {
    let n = 0;
    const { client, calls } = setup(() => (++n <= 2 ? json({}, 429) : json({ ok: true })));
    const res = await client.get('/x');
    expect(res.status).toBe(200);
    expect(calls.map(c => c.at)).toEqual([0, 1000, 3000]);
  });

  it('waits for Retry-After when it is longer than the backoff', async () => {
    let n = 0;
    const { client, calls } = setup(() => (++n === 1 ? json({}, 429, { 'Retry-After': '5' }) : json({})));
    await client.get('/x');
    expect(calls[1].at).toBe(5000);
  });

  it('caps a huge Retry-After', async () => {
    let n = 0;
    const { client, calls } = setup(() => (++n === 1 ? json({}, 429, { 'Retry-After': '9999' }) : json({})));
    await client.get('/x');
    expect(calls[1].at).toBe(30_000);
  });

  it('retries 5xx and gives up after 3 retries with a server error', async () => {
    const { client, calls } = setup(() => json({}, 503));
    const err = await rejection(client.get('/x'));
    expect(err.kind).toBe('server');
    expect(err.status).toBe(503);
    expect(calls).toHaveLength(4);
  });

  it('reports a rate limit when 429 never clears', async () => {
    const { client } = setup(() => json({}, 429));
    expect((await rejection(client.get('/x'))).kind).toBe('rate_limited');
  });

  it('retries a network failure, then succeeds', async () => {
    let n = 0;
    const { client, calls } = setup(() => { if (++n === 1) throw new TypeError('Failed to fetch'); return json({ ok: true }); });
    expect((await client.get('/x')).status).toBe(200);
    expect(calls).toHaveLength(2);
  });

  it('reports a network error when it never recovers', async () => {
    const { client, calls } = setup(() => { throw new TypeError('Failed to fetch'); });
    expect((await rejection(client.get('/x'))).kind).toBe('network');
    expect(calls).toHaveLength(4);
  });

  it('honors maxRetries', async () => {
    const { client, calls } = setup(() => json({}, 500), { maxRetries: 0 });
    await rejection(client.get('/x'));
    expect(calls).toHaveLength(1);
  });
});

describe('ScryfallClient responses', () => {
  it('returns a 404 as a normal answer with its body', async () => {
    const { client, calls } = setup(() => json({ object: 'error', code: 'not_found' }, 404));
    expect(await client.get('/x')).toEqual({ status: 404, body: { object: 'error', code: 'not_found' } });
    expect(calls).toHaveLength(1);
  });

  it('treats other 4xx as a bad request and does not retry', async () => {
    const { client, calls } = setup(() => json({ object: 'error' }, 400));
    const err = await rejection(client.get('/x'));
    expect(err.kind).toBe('bad_request');
    expect(calls).toHaveLength(1);
  });

  it('reports a body that is not JSON', async () => {
    const { client } = setup(() => new Response('<html>oops</html>', { status: 200 }));
    expect((await rejection(client.get('/x'))).kind).toBe('bad_response');
  });
});

describe('ScryfallClient URLs', () => {
  it('follows a full Scryfall URL such as next_page', async () => {
    const { client, calls } = setup(() => json({}));
    await client.get('https://api.scryfall.com/cards/search?page=2&q=x');
    expect(calls[0].url).toBe('https://api.scryfall.com/cards/search?page=2&q=x');
  });

  it('refuses a URL on another host without calling it', async () => {
    const { client, calls } = setup(() => json({}));
    const err = await rejection(client.get('https://evil.example/cards'));
    expect(err.kind).toBe('bad_request');
    expect(calls).toHaveLength(0);
  });

  it('refuses a look-alike host', async () => {
    const { client, calls } = setup(() => json({}));
    await rejection(client.get('https://api.scryfall.com.evil.example/x'));
    expect(calls).toHaveLength(0);
  });
});

describe('ScryfallClient cancel', () => {
  it('does not call fetch when already cancelled', async () => {
    const { client, calls } = setup(() => json({}));
    const controller = new AbortController(); controller.abort();
    expect((await rejection(client.get('/x', controller.signal))).kind).toBe('aborted');
    expect(calls).toHaveLength(0);
  });

  it('does not retry when fetch is aborted', async () => {
    const controller = new AbortController();
    const { client, calls } = setup(() => { controller.abort(); throw new DOMException('aborted', 'AbortError'); });
    expect((await rejection(client.get('/x', controller.signal))).kind).toBe('aborted');
    expect(calls).toHaveLength(1);
  });
});
