// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { FINISH_ETCHED, FINISH_FOIL, FINISH_NONFOIL, FORMAT_VERSION, MANIFEST_FILE, buildManifest, encodeScryfallCards } from '../catalog';
import fixture from '../catalog/fixtures/default-cards.sample.jsonl?raw';
import { DEFAULT_GAME, GAMES, MAGIC } from './index';

const built = encodeScryfallCards(fixture.split('\n').filter(l => l.trim()).map(l => JSON.parse(l) as unknown));
const hashOf = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 10);

describe('the game registry', () => {
  it('has Magic, live, as the default game', () => {
    expect(DEFAULT_GAME).toBe('magic');
    expect(GAMES.magic).toBe(MAGIC);
    expect(MAGIC).toMatchObject({ id: 'magic', live: true });
  });

  it('names the variants in the order of the finish bits the data already uses', () => {
    expect(MAGIC.variants).toEqual(['nonfoil', 'foil', 'etched']);
    expect(MAGIC.variants.map((_, i) => 1 << i)).toEqual([FINISH_NONFOIL, FINISH_FOIL, FINISH_ETCHED]);
  });
});

// Magic must not change as the app learns about more games (docs/MULTI-GAME.md, section 8). These are the hashes of the files the build
// writes for the committed fixture, taken before the game definition existed. If one changes, Magic's data changed: that needs a reason.
describe('Magic card data is unchanged', () => {
  it('writes the same cards file, prices file and counts for the fixture as before the games existed', () => {
    expect(hashOf(JSON.stringify(built.cards))).toBe('3a1a6faee2');
    expect(hashOf(JSON.stringify(built.prices))).toBe('908ab7d87f');
    expect(built.counts).toEqual({ cards: 15, printings: 36, sets: 21 });
    expect(built.cards.format).toBe(FORMAT_VERSION);
    expect(FORMAT_VERSION).toBe(1);
  });

  it('only adds to the manifest: the game, its variants and its details; everything else is as it was', () => {
    const manifest = buildManifest({ builtAt: '2026-10-18T10:00:00.000Z', scryfallUpdatedAt: '2026-10-18T09:06:08.225+00:00', counts: built.counts, cardsHash: 'aaaa', pricesHash: 'bbbb' });
    expect(manifest).toMatchObject({ game: 'magic', variants: ['nonfoil', 'foil', 'etched'], details: ['borderColor', 'promoTypes', 'frameEffects', 'games'] });
    const old: Partial<typeof manifest> = { ...manifest };
    for (const added of ['game', 'variants', 'details'] as const) delete old[added];
    expect(old).toEqual({
      format: 1,
      builtAt: '2026-10-18T10:00:00.000Z',
      scryfallUpdatedAt: '2026-10-18T09:06:08.225+00:00',
      counts: { cards: 15, printings: 36, sets: 21 },
      files: { cards: 'cards.aaaa.json', prices: 'prices.bbbb.json' },
    });
    expect(MANIFEST_FILE).toBe('manifest.json');
  });

  it('takes the game from the build when it names one', () => {
    const other = { ...MAGIC, id: 'pokemon' as const, variants: ['normal', 'holo'] as const, details: [] as const };
    const manifest = buildManifest({ builtAt: 'x', scryfallUpdatedAt: 'y', counts: built.counts, cardsHash: 'a', pricesHash: 'b', game: other });
    expect(manifest).toMatchObject({ game: 'pokemon', variants: ['normal', 'holo'], details: [] });
  });
});
