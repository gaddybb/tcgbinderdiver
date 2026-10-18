// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../../storage';
import { routeCard, V1_STORE } from '../../core/engine/engine';
import type { CardInput } from '../../core/engine/engine';
import type { CardSummary } from '../../core/connector';
import { COLLECTION_BATCH_SIZE, MAX_FUZZY_CANDIDATES, SETS_CACHE_KEY, SETS_TTL_MS, ScryfallConnector } from './scryfallConnector';
import { ScryfallClient, ScryfallError } from './client';
import { sortCategory } from './mappers';
import { json, list, makeClock, notFound, rawCard, scripted } from './testkit';
import type { Call } from './testkit';

type Handler = (call: Call) => Response | Promise<Response>;

function setup(handler: Handler, withCache = false) {
  const clock = makeClock();
  const s = scripted(handler, clock.now);
  const client = new ScryfallClient({ fetch: s.fetch, sleep: clock.sleep, now: clock.now, maxRetries: 0 });
  const cache = withCache ? new MemoryStorage() : undefined;
  return { connector: new ScryfallConnector({ client, cache }), cache, clock, ...s };
}

const identifiers = (call: Call) => (call.body as { identifiers: { name: string }[] }).identifiers.map(i => i.name);
const collectionReply = (call: Call) => json(list(identifiers(call).map((name, i) => rawCard({ id: `id-${name}-${i}`, name }))), 200);

describe('lookupNames', () => {
  it('asks for exact names in one request and maps the cards', async () => {
    const { connector, calls } = setup(() => json({ ...list([rawCard({ name: 'Sol Ring' })]), not_found: [{ name: 'Nope' }] }));
    const result = await connector.lookupNames(['Sol Ring', 'Nope']);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.scryfall.com/cards/collection');
    expect(identifiers(calls[0])).toEqual(['Sol Ring', 'Nope']);
    expect(result.found.map(f => [f.requested, f.card.name])).toEqual([['Sol Ring', 'Sol Ring']]);
    expect(result.notFound).toEqual(['Nope']);
  });

  it('maps a card to its summary', async () => {
    const { connector } = setup(() => json(list([rawCard()])));
    const { found } = await connector.lookupNames(['Sol Ring']);
    expect(found[0].card).toEqual({
      id: 'id-1', oracleId: 'oracle-1', name: 'Sol Ring', typeLine: 'Artifact', colors: [],
      imageSmall: 'https://img.example/s.jpg', imageNormal: 'https://img.example/n.jpg',
      sourceUri: 'https://scryfall.com/card/cmm/400/sol-ring?utm_source=api',
      printingsUri: 'https://api.scryfall.com/cards/search?order=released&q=oracleid%3Aoracle-1&unique=prints',
    });
  });

  it('sends the front-face name and matches it back to the full card name', async () => {
    const { connector, calls } = setup(() => json(list([rawCard({ name: 'Fire // Ice' })])));
    const { found } = await connector.lookupNames(['Fire // Ice']);
    expect(identifiers(calls[0])).toEqual(['Fire']);
    expect(found[0].requested).toBe('Fire // Ice');
    expect(found[0].card.name).toBe('Fire // Ice');
  });

  it('matches a front-face-only request to a double-faced card', async () => {
    const { connector } = setup(() => json(list([rawCard({ name: 'Fire // Ice' })])));
    const { found } = await connector.lookupNames(['Fire']);
    expect(found[0].card.name).toBe('Fire // Ice');
  });

  it('matches regardless of case and accents', async () => {
    const { connector } = setup(() => json(list([rawCard({ name: "Lim-Dûl's Vault" })])));
    const { found, notFound } = await connector.lookupNames(["lim-dul's vault"]);
    expect(found).toHaveLength(1);
    expect(notFound).toEqual([]);
  });

  it(`sends at most ${COLLECTION_BATCH_SIZE} names per request`, async () => {
    const names = Array.from({ length: 160 }, (_, i) => `Card ${i}`);
    const { connector, calls } = setup(collectionReply);
    const result = await connector.lookupNames(names);
    expect(calls.map(c => identifiers(c).length)).toEqual([75, 75, 10]);
    expect(result.found).toHaveLength(160);
    expect(result.notFound).toEqual([]);
  });

  it('reports each batch as it finishes', async () => {
    const names = Array.from({ length: 80 }, (_, i) => `Card ${i}`);
    const { connector } = setup(collectionReply);
    const sizes: number[] = [];
    await connector.lookupNames(names, { onBatch: batch => { sizes.push(batch.found.length); } });
    expect(sizes).toEqual([75, 5]);
  });

  it('sends a repeated name once', async () => {
    const { connector, calls } = setup(collectionReply);
    await connector.lookupNames(['Sol Ring', 'sol ring', 'Sol Ring']);
    expect(identifiers(calls[0])).toEqual(['Sol Ring']);
  });

  it('makes no request for an empty list', async () => {
    const { connector, calls } = setup(collectionReply);
    expect(await connector.lookupNames([])).toEqual({ found: [], notFound: [] });
    expect(calls).toHaveLength(0);
  });

  it('paces batches 100 ms apart', async () => {
    const { connector, calls } = setup(collectionReply);
    await connector.lookupNames(Array.from({ length: 160 }, (_, i) => `Card ${i}`));
    expect(calls.map(c => c.at)).toEqual([0, 100, 200]);
  });

  it('throws when Scryfall sends something that is not a card list', async () => {
    const { connector } = setup(() => json({ object: 'list' }));
    await expect(connector.lookupNames(['Sol Ring'])).rejects.toMatchObject({ kind: 'bad_response' });
  });
});

describe('fuzzy', () => {
  it('returns the match with Scryfall\'s spelling', async () => {
    const { connector, calls } = setup(() => json(rawCard({ name: 'Sol Ring' })));
    const r = await connector.fuzzy('Sol Rign');
    expect(calls[0].url).toBe('https://api.scryfall.com/cards/named?fuzzy=Sol%20Rign');
    expect(r).toMatchObject({ status: 'match', card: { name: 'Sol Ring' } });
  });

  it('returns none when nothing matches, without searching', async () => {
    const { connector, calls } = setup(() => json(notFound(), 404));
    expect(await connector.fuzzy('zzzz')).toEqual({ status: 'none' });
    expect(calls).toHaveLength(1);
  });

  it('searches for candidates when the name is ambiguous', async () => {
    const { connector, calls } = setup(call =>
      call.url.includes('/cards/named')
        ? json(notFound({ type: 'ambiguous' }), 404)
        : json(list([rawCard({ id: 'a', name: 'Lightning Bolt' }), rawCard({ id: 'b', name: 'Bolt Bend' })])));
    const r = await connector.fuzzy('bolt');
    expect(calls[1].url).toBe('https://api.scryfall.com/cards/search?q=bolt&unique=cards&order=name');
    expect(r.status).toBe('ambiguous');
    if (r.status === 'ambiguous') expect(r.candidates.map(c => c.name)).toEqual(['Lightning Bolt', 'Bolt Bend']);
  });

  it(`keeps at most ${MAX_FUZZY_CANDIDATES} candidates`, async () => {
    const many = Array.from({ length: 41 }, (_, i) => rawCard({ id: `c${i}`, name: `Bolt ${i}` }));
    const { connector } = setup(call => call.url.includes('/cards/named') ? json(notFound({ type: 'ambiguous' }), 404) : json(list(many)));
    const r = await connector.fuzzy('bolt');
    expect(r.status === 'ambiguous' && r.candidates.length).toBe(MAX_FUZZY_CANDIDATES);
  });

  it('treats a single candidate as the match', async () => {
    const { connector } = setup(call => call.url.includes('/cards/named') ? json(notFound({ type: 'ambiguous' }), 404) : json(list([rawCard({ name: 'Only One' })])));
    expect(await connector.fuzzy('only')).toMatchObject({ status: 'match', card: { name: 'Only One' } });
  });

  it('returns none when the candidate search finds nothing', async () => {
    const { connector } = setup(call => call.url.includes('/cards/named') ? json(notFound({ type: 'ambiguous' }), 404) : json(notFound(), 404));
    expect(await connector.fuzzy('bolt')).toEqual({ status: 'none' });
  });
});

describe('autocomplete', () => {
  it('makes no request for fewer than two characters', async () => {
    const { connector, calls } = setup(() => json({ data: [] }));
    expect(await connector.autocomplete(' s ')).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('returns the suggested names', async () => {
    const { connector, calls } = setup(() => json({ object: 'catalog', data: ['Sol Ring', 'Sol Talisman'] }));
    expect(await connector.autocomplete('sol r')).toEqual(['Sol Ring', 'Sol Talisman']);
    expect(calls[0].url).toBe('https://api.scryfall.com/cards/autocomplete?q=sol%20r');
  });

  it('returns nothing on a 404', async () => {
    const { connector } = setup(() => json(notFound(), 404));
    expect(await connector.autocomplete('zz')).toEqual([]);
  });
});

describe('printings', () => {
  const card = (): CardSummary => ({
    id: 'id-1', oracleId: 'oracle-1', name: 'Sol Ring', typeLine: 'Artifact', colors: [], imageSmall: null, imageNormal: null,
    sourceUri: 'x', printingsUri: 'https://api.scryfall.com/cards/search?order=released&q=oracleid%3Aoracle-1&unique=prints',
  });

  it('follows next_page until has_more is false', async () => {
    const page2 = 'https://api.scryfall.com/cards/search?page=2&q=oracleid%3Aoracle-1';
    const { connector, calls } = setup(call => call.url === page2
      ? json(list([rawCard({ set: 'fdn', collector_number: '2' })]))
      : json(list([rawCard({ set: 'cmm', collector_number: '1' })], { has_more: true, next_page: page2 })));
    const out = await connector.printings(card());
    expect(calls.map(c => c.url)).toEqual([card().printingsUri, page2]);
    expect(out.map(p => p.setCode)).toEqual(['cmm', 'fdn']);
  });

  it('drops digital, non-paper and memorabilia printings', async () => {
    const { connector } = setup(() => json(list([
      rawCard({ set: 'a' }),
      rawCard({ set: 'b', digital: true, games: ['mtgo'] }),
      rawCard({ set: 'c', games: ['arena'] }),
      rawCard({ set: 'd', set_type: 'memorabilia' }),
      rawCard({ set: 'e', digital: true }),
    ])));
    expect((await connector.printings(card())).map(p => p.setCode)).toEqual(['a']);
  });

  it('maps a printing to the engine type', async () => {
    const { connector } = setup(() => json(list([rawCard({
      promo: true, promo_types: ['prerelease'], frame_effects: ['showcase'], border_color: 'borderless', full_art: true,
      finishes: ['nonfoil', 'foil', 'etched', 'glossy'], prices: { usd: '1.50', usd_foil: null },
    })])));
    expect((await connector.printings(card()))[0]).toEqual({
      setCode: 'cmm', setName: 'Commander Masters', setType: 'masters', releasedAt: '2023-08-04', rarity: 'uncommon',
      collectorNumber: '400', finishes: ['nonfoil', 'foil', 'etched'],
      prices: { usd: '1.50', usd_foil: null, usd_etched: null },
      promo: true, promoTypes: ['prerelease'], frameEffects: ['showcase'], borderColor: 'borderless', fullArt: true,
      digital: false, games: ['paper', 'mtgo'],
    });
  });

  it('fills defaults for fields Scryfall leaves out', async () => {
    const { connector } = setup(() => json(list([{ set: 'xyz', set_name: 'X', set_type: 'expansion', rarity: 'common', collector_number: '9', games: ['paper'], nonfoil: true, foil: true }])));
    expect((await connector.printings(card()))[0]).toMatchObject({
      finishes: ['nonfoil', 'foil'], prices: { usd: null, usd_foil: null, usd_etched: null },
      promo: false, promoTypes: [], frameEffects: [], borderColor: 'black', fullArt: false, releasedAt: '',
    });
  });

  it('returns an empty list on a 404', async () => {
    const { connector } = setup(() => json(notFound(), 404));
    expect(await connector.printings(card())).toEqual([]);
  });

  it('feeds the engine: a recent cheap printing routes to its set binder', async () => {
    const { connector } = setup(() => json(list([rawCard({ set: 'FDN', set_name: 'Foundations', set_type: 'core', released_at: '2025-11-14', prices: { usd: '0.25' } })])));
    const printings = await connector.printings(card());
    const input: CardInput = { name: 'Sol Ring', typeLine: 'Artifact', printings };
    const route = routeCard(input, V1_STORE, new Date('2026-10-17T00:00:00Z'));
    expect(route.status === 'routed' && route.ranked[0].stop.id).toBe('set:fdn');
  });
});

describe('double-faced cards', () => {
  it('takes colors and images from the front face when the top level has none', async () => {
    const dfc = rawCard({
      name: 'Delver of Secrets // Insectile Aberration', type_line: 'Creature — Human Wizard // Creature — Human Insect',
      colors: undefined, image_uris: undefined, oracle_id: undefined,
      card_faces: [
        { colors: ['U'], type_line: 'Creature — Human Wizard', image_uris: { small: 'https://img.example/front-s.jpg', normal: 'https://img.example/front-n.jpg' }, oracle_id: 'face-oracle' },
        { colors: ['U'], type_line: 'Creature — Human Insect', image_uris: { small: 'https://img.example/back-s.jpg' } },
      ],
    });
    const { connector } = setup(() => json(list([dfc])));
    const { found } = await connector.lookupNames(['Delver of Secrets']);
    expect(found[0].card).toMatchObject({
      colors: ['U'], imageSmall: 'https://img.example/front-s.jpg', imageNormal: 'https://img.example/front-n.jpg',
      typeLine: 'Creature — Human Wizard // Creature — Human Insect', oracleId: 'face-oracle',
    });
  });

  it('has no image when none exists', async () => {
    const { connector } = setup(() => json(list([rawCard({ image_uris: undefined })])));
    const { found } = await connector.lookupNames(['Sol Ring']);
    expect(found[0].card.imageSmall).toBeNull();
  });
});

describe('sortCategory', () => {
  const cat = (typeLine: string, colors: string[]) => sortCategory({ typeLine, colors });
  it('files by color in store order', () => {
    expect(cat('Creature', ['W'])).toBe('White');
    expect(cat('Instant', ['U'])).toBe('Blue');
    expect(cat('Sorcery', ['B'])).toBe('Black');
    expect(cat('Instant', ['R'])).toBe('Red');
    expect(cat('Creature', ['G'])).toBe('Green');
  });
  it('files two or more colors as Multicolor and none as Colorless', () => {
    expect(cat('Creature', ['W', 'U'])).toBe('Multicolor');
    expect(cat('Artifact', [])).toBe('Colorless');
  });
  it('files lands as Land, using the front face', () => {
    expect(cat('Land', [])).toBe('Land');
    expect(cat('Basic Land — Forest', [])).toBe('Land');
    expect(cat('Land // Creature — Elf', [])).toBe('Land');
    expect(cat('Creature — Elf // Land', ['G'])).toBe('Green');
  });
  it('is exposed with its order on the connector', () => {
    const { connector } = setup(() => json({}));
    expect(connector.sortOrder).toEqual(['White', 'Blue', 'Black', 'Red', 'Green', 'Multicolor', 'Colorless', 'Land']);
    expect(connector.sortCategory({ typeLine: 'Land', colors: [] } as unknown as CardSummary)).toBe('Land');
  });
});

describe('sets', () => {
  const setsReply = () => json(list([
    { code: 'FDN', name: 'Foundations', released_at: '2024-11-15', set_type: 'core', digital: false },
    { code: 'ymid', name: 'Alchemy: Innistrad', released_at: '2021-09-23', set_type: 'alchemy', digital: true },
    { code: 'xxx', name: 'No Date', set_type: 'promo' },
  ]));
  const NOW = new Date('2026-10-17T00:00:00Z');

  it('maps sets with lowercase codes, dates and the digital flag', async () => {
    const { connector } = setup(setsReply);
    expect(await connector.sets(NOW)).toEqual([
      { code: 'fdn', name: 'Foundations', releasedAt: '2024-11-15', setType: 'core', digital: false },
      { code: 'ymid', name: 'Alchemy: Innistrad', releasedAt: '2021-09-23', setType: 'alchemy', digital: true },
      { code: 'xxx', name: 'No Date', releasedAt: null, setType: 'promo', digital: false },
    ]);
  });

  it('fetches once and then uses the cache for 7 days', async () => {
    const { connector, calls } = setup(setsReply, true);
    await connector.sets(NOW);
    await connector.sets(new Date(NOW.getTime() + SETS_TTL_MS - 1000));
    expect(calls).toHaveLength(1);
  });

  it('fetches again after 7 days', async () => {
    const { connector, calls } = setup(setsReply, true);
    await connector.sets(NOW);
    await connector.sets(new Date(NOW.getTime() + SETS_TTL_MS + 1000));
    expect(calls).toHaveLength(2);
  });

  it('stores the fetch time with the sets', async () => {
    const { connector, cache } = setup(setsReply, true);
    await connector.sets(NOW);
    expect(await cache!.get('cache', SETS_CACHE_KEY)).toMatchObject({ fetchedAt: NOW.toISOString() });
  });

  it('uses an expired copy when Scryfall cannot be reached', async () => {
    let fail = false;
    const { connector } = setup(() => (fail ? json({}, 500) : setsReply()), true);
    await connector.sets(NOW);
    fail = true;
    const sets = await connector.sets(new Date(NOW.getTime() + SETS_TTL_MS * 2));
    expect(sets.map(s => s.code)).toEqual(['fdn', 'ymid', 'xxx']);
  });

  it('throws when there is nothing cached and Scryfall cannot be reached', async () => {
    const { connector } = setup(() => json({}, 500), true);
    await expect(connector.sets(NOW)).rejects.toBeInstanceOf(ScryfallError);
  });

  it('works without a cache', async () => {
    const { connector, calls } = setup(setsReply);
    await connector.sets(NOW);
    await connector.sets(NOW);
    expect(calls).toHaveLength(2);
  });
});
