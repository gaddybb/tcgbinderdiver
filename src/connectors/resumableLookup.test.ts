// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../storage';
import { ScryfallClient } from './scryfall/client';
import { ScryfallConnector } from './scryfall/scryfallConnector';
import { json, list, makeClock, notFound, rawCard, scripted } from './scryfall/testkit';
import type { Call } from './scryfall/testkit';
import { clearLookupJob, lookupJobKey, pendingLookupNames, resumableLookup } from './resumableLookup';

const sent = (call: Call) => (call.body as { identifiers: { name: string }[] }).identifiers.map(i => i.name);
const names = (n: number) => Array.from({ length: n }, (_, i) => `Card ${i}`);

function setup(handler: (call: Call, n: number) => Response) {
  const clock = makeClock();
  let n = 0;
  const s = scripted(call => handler(call, ++n), clock.now);
  const client = new ScryfallClient({ fetch: s.fetch, sleep: clock.sleep, now: clock.now, maxRetries: 0 });
  return { connector: new ScryfallConnector({ client }), storage: new MemoryStorage(), ...s };
}

// Answers every name except "Missing"; a request number in `failOn` fails like a dropped connection.
const reply = (failOn: number[] = []) => (call: Call, n: number): Response => {
  if (failOn.includes(n)) throw new TypeError('Failed to fetch');
  const found = sent(call).filter(name => name !== 'Missing');
  return json({ ...list(found.map(name => rawCard({ id: name, name }))), not_found: sent(call).includes('Missing') ? [{ name: 'Missing' }] : [] });
};

describe('resumableLookup', () => {
  it('looks everything up and returns it in the order given', async () => {
    const { connector, storage } = setup(reply());
    const input = ['Card B', 'Missing', 'Card A'];
    const result = await resumableLookup(connector, storage, 'job1', input);
    expect(result.found.map(f => f.requested)).toEqual(['Card B', 'Card A']);
    expect(result.notFound).toEqual(['Missing']);
  });

  it('saves progress after each batch', async () => {
    const { connector, storage } = setup(reply([2]));
    await expect(resumableLookup(connector, storage, 'job1', names(100))).rejects.toMatchObject({ kind: 'network' });
    const saved = await storage.get<{ found: Record<string, unknown> }>('cache', lookupJobKey('job1'));
    expect(Object.keys(saved!.found)).toHaveLength(75);
  });

  it('on the next run only asks for the names still missing', async () => {
    const { connector, storage, calls } = setup(reply([2]));
    const input = names(100);
    await expect(resumableLookup(connector, storage, 'job1', input)).rejects.toThrow();
    calls.length = 0;

    const result = await resumableLookup(connector, storage, 'job1', input);
    expect(calls).toHaveLength(1);
    expect(sent(calls[0])).toEqual(input.slice(75));
    expect(result.found).toHaveLength(100);
    expect(result.found.map(f => f.requested)).toEqual(input);
  });

  it('makes no request when the job is already complete', async () => {
    const { connector, storage, calls } = setup(reply());
    await resumableLookup(connector, storage, 'job1', names(10));
    calls.length = 0;
    const result = await resumableLookup(connector, storage, 'job1', names(10));
    expect(calls).toHaveLength(0);
    expect(result.found).toHaveLength(10);
  });

  it('remembers names that were not found, so they are not asked again', async () => {
    const { connector, storage, calls } = setup(reply());
    await resumableLookup(connector, storage, 'job1', ['Card A', 'Missing']);
    calls.length = 0;
    const result = await resumableLookup(connector, storage, 'job1', ['Card A', 'Missing']);
    expect(calls).toHaveLength(0);
    expect(result.notFound).toEqual(['Missing']);
  });

  it('picks up names added to the list after the first run', async () => {
    const { connector, storage, calls } = setup(reply());
    await resumableLookup(connector, storage, 'job1', ['Card A']);
    calls.length = 0;
    await resumableLookup(connector, storage, 'job1', ['Card A', 'Card B']);
    expect(sent(calls[0])).toEqual(['Card B']);
  });

  it('keeps jobs separate', async () => {
    const { connector, storage, calls } = setup(reply());
    await resumableLookup(connector, storage, 'job1', ['Card A']);
    calls.length = 0;
    await resumableLookup(connector, storage, 'job2', ['Card A']);
    expect(calls).toHaveLength(1);
  });

  it('passes each new batch to onBatch, and not the saved ones', async () => {
    const { connector, storage } = setup(reply([2]));
    const input = names(100);
    await expect(resumableLookup(connector, storage, 'job1', input)).rejects.toThrow();
    const sizes: number[] = [];
    await resumableLookup(connector, storage, 'job1', input, { onBatch: b => { sizes.push(b.found.length); } });
    expect(sizes).toEqual([25]);
  });

  it('treats "Fire" and "Fire // Ice" as the same card, like the lookup does', async () => {
    const { connector, storage, calls } = setup((call) => json(list(sent(call).map(name => rawCard({ name: name === 'Fire' ? 'Fire // Ice' : name })))));
    await resumableLookup(connector, storage, 'job1', ['Fire // Ice']);
    calls.length = 0;
    await resumableLookup(connector, storage, 'job1', ['Fire']);
    expect(calls).toHaveLength(0);
  });

  it('keeps what it has when the lookup is cancelled', async () => {
    const { connector, storage } = setup(reply());
    const controller = new AbortController();
    const input = names(100);
    await expect(resumableLookup(connector, storage, 'job1', input, {
      signal: controller.signal,
      onBatch: () => controller.abort(),
    })).rejects.toMatchObject({ kind: 'aborted' });
    expect(await pendingLookupNames(storage, 'job1', input)).toEqual(input.slice(75));
  });
});

describe('pendingLookupNames and clearLookupJob', () => {
  it('is null when no job was saved', async () => {
    const { storage } = setup(reply());
    expect(await pendingLookupNames(storage, 'nope', ['Card A'])).toBeNull();
  });

  it('lists the names still to look up, for a resume banner', async () => {
    const { connector, storage } = setup(reply([2]));
    const input = names(100);
    await expect(resumableLookup(connector, storage, 'job1', input)).rejects.toThrow();
    expect(await pendingLookupNames(storage, 'job1', input)).toEqual(input.slice(75));
  });

  it('is empty when the job finished', async () => {
    const { connector, storage } = setup(reply());
    await resumableLookup(connector, storage, 'job1', names(5));
    expect(await pendingLookupNames(storage, 'job1', names(5))).toEqual([]);
  });

  it('clearLookupJob forgets the job', async () => {
    const { connector, storage } = setup(reply());
    await resumableLookup(connector, storage, 'job1', names(5));
    await clearLookupJob(storage, 'job1');
    expect(await pendingLookupNames(storage, 'job1', names(5))).toBeNull();
  });
});

// Keeps the import used in a sanity check that a 404 for the whole batch is not an error.
describe('a batch where nothing is found', () => {
  it('reports every name as not found', async () => {
    const { connector, storage } = setup(call => json({ ...list([]), not_found: sent(call).map(name => ({ name })) }));
    const result = await resumableLookup(connector, storage, 'job1', ['A', 'B']);
    expect(result.notFound).toEqual(['A', 'B']);
    expect(notFound().code).toBe('not_found');
  });
});
