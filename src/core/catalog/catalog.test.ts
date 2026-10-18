// @vitest-environment node
import { describe, expect, it } from 'vitest';
import fixture from './fixtures/default-cards.sample.jsonl?raw';
import { toPrinting } from '../../connectors/scryfall/mappers';
import { classify, V1_STORE } from '../engine/engine';
import { nameKey } from '../parse/parseDecklist';
import {
  CatalogFormatError, FINISH_ETCHED, FINISH_FOIL, FINISH_NONFOIL, FORMAT_VERSION, MANIFEST_FILE, applyPrices, buildManifest,
  cardImageUrl, dataFileName, decodeCatalog, encodeCatalog, encodeScryfallCards, priceToCents, slimCard,
} from './index';
import type { CardsFile, PricesFile } from './index';

type Raw = Record<string, unknown>;
const raws: Raw[] = fixture.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l) as Raw);
const byName = (name: string) => raws.filter((r) => r.name === name);

// Files as they travel: through JSON text, exactly as the build script writes and the browser reads them.
const wire = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const encoded = encodeScryfallCards(raws);
const cardsFile = wire(encoded.cards);
const pricesFile = wire(encoded.prices);
const catalog = decodeCatalog(cardsFile, pricesFile);

describe('fixture', () => {
  it('has the 40 lines the tests rely on', () => {
    expect(raws).toHaveLength(40);
  });
});

describe('encoder filters', () => {
  it('drops digital, not-in-paper and memorabilia printings', () => {
    expect(slimCard(byName('A-Llanowar Elves')[0])).toBeNull();
    expect(slimCard(byName('Llanowar Elves MTGO Test')[0])).toBeNull();
    expect(slimCard(byName('Llanowar Elves No Paper Test')[0])).toBeNull();
    expect(slimCard(raws.find((r) => r.set === '30a'))).toBeNull();
    expect(encoded.counts.printings).toBe(36);
  });

  it('groups printings by oracle id', () => {
    expect(encoded.counts.cards).toBe(15);
    expect(catalog.find('Lightning Bolt')?.printings).toHaveLength(8);
    expect(catalog.find('Forest')?.printings).toHaveLength(4);
    expect(catalog.find('Black Lotus')?.printings).toHaveLength(1);
    expect(catalog.cards.every((c) => c.printings.length > 0)).toBe(true);
  });

  it('keeps every set once, sorted by code', () => {
    const codes = catalog.sets.map((s) => s.code);
    expect(codes).toEqual([...codes].sort());
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).not.toContain('30a');
    expect(codes).not.toContain('y22');
    expect(catalog.sets.find((s) => s.code === 'm10')).toEqual({ code: 'm10', name: 'Magic 2010', releasedAt: '2009-07-17', setType: 'core', digital: false });
  });
});

describe('round trip', () => {
  it('gives back the same printings the app already maps from Scryfall', () => {
    let checked = 0;
    for (const raw of raws) {
      const expected = toPrinting(raw);
      if (!expected) continue;
      const card = catalog.cards.find((c) => c.oracleId === (raw.oracle_id ?? (raw.card_faces as Raw[])[0].oracle_id));
      expect(card, String(raw.name)).toBeDefined();
      const got = card?.printings.find((p) => p.setCode === expected.setCode && p.collectorNumber === expected.collectorNumber);
      expect(got, `${String(raw.name)} ${expected.setCode}`).toEqual(expected);
      checked++;
    }
    expect(checked).toBe(36);
  });

  it('keeps every printing and nothing else', () => {
    const total = catalog.cards.reduce((n, c) => n + c.printings.length, 0);
    expect(total).toBe(encoded.counts.printings);
    expect(JSON.stringify(decodeCatalog(cardsFile).cards.map((c) => c.printings.map((p) => ({ ...p, prices: 0 })))))
      .toBe(JSON.stringify(catalog.cards.map((c) => c.printings.map((p) => ({ ...p, prices: 0 })))));
  });

  it('is the same no matter the input order', () => {
    const shuffled = encodeScryfallCards([...raws].reverse());
    expect(JSON.stringify(shuffled.cards)).toBe(JSON.stringify(encoded.cards));
    expect(JSON.stringify(shuffled.prices)).toBe(JSON.stringify(encoded.prices));
  });

  it('orders printings newest first and cards by name', () => {
    const bolt = catalog.find('Lightning Bolt')!;
    expect(bolt.printings.map((p) => p.setCode)).toEqual(['plst', 'mh2', 'm10', 'p10', 'sld', 'lea', 'leb', '2ed'].sort((a, b) => {
      const da = bolt.printings.find((p) => p.setCode === a)!.releasedAt, db = bolt.printings.find((p) => p.setCode === b)!.releasedAt;
      return da < db ? 1 : da > db ? -1 : a < b ? -1 : 1;
    }));
    expect(bolt.printings[0].setCode).toBe('plst');
    const names = catalog.cards.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  });
});

describe('prices', () => {
  it('line up with the printing order, in cents', () => {
    expect(pricesFile.prices).toHaveLength(cardsFile.cards.length);
    cardsFile.cards.forEach((card, i) => expect(pricesFile.prices[i]).toHaveLength(card[5].length));
    const bolt = catalog.find('Lightning Bolt')!;
    const lea = bolt.printings.find((p) => p.setCode === 'lea')!;
    expect(lea.prices).toEqual({ usd: '1500.00', usd_foil: null, usd_etched: null });
    const sld = bolt.printings.find((p) => p.setCode === 'sld')!;
    expect(sld.prices).toEqual({ usd: '25.00', usd_foil: '45.00', usd_etched: null });
    const idx = cardsFile.cards.findIndex((c) => c[1] === 'Lightning Bolt');
    expect(pricesFile.prices[idx][bolt.printings.indexOf(lea)]).toEqual([150000, null, null]);
  });

  it('are null when unknown, a whole printing as null', () => {
    const lotus = catalog.find('Black Lotus')!;
    expect(lotus.printings[0].prices).toEqual({ usd: null, usd_foil: null, usd_etched: null });
    expect(pricesFile.prices[cardsFile.cards.findIndex((c) => c[1] === 'Black Lotus')]).toEqual([null]);
  });

  it('keep the etched price', () => {
    const ring = catalog.find('Sol Ring')!;
    expect(ring.printings.find((p) => p.setCode === 'clb')!.prices).toEqual({ usd: '2.00', usd_foil: '3.50', usd_etched: '5.00' });
  });

  it('are optional, and can be applied later in place', () => {
    const bare = decodeCatalog(cardsFile);
    const printing = bare.find('Sol Ring')!.printings[0];
    expect(printing.prices).toEqual({ usd: null, usd_foil: null, usd_etched: null });
    applyPrices(bare, pricesFile);
    expect(bare.find('Sol Ring')!.printings[0]).toBe(printing);
    expect(printing.prices.usd).not.toBeNull();
  });

  it('refuse a prices file from another build', () => {
    expect(() => decodeCatalog(cardsFile, { ...pricesFile, prices: pricesFile.prices.slice(1) })).toThrow(CatalogFormatError);
    const wrongLength = wire(pricesFile);
    wrongLength.prices[0] = [];
    expect(() => decodeCatalog(cardsFile, wrongLength)).toThrow(/do not match/);
  });

  it('parse Scryfall price text', () => {
    expect(priceToCents('0.25')).toBe(25);
    expect(priceToCents('1500.00')).toBe(150000);
    expect(priceToCents('0.1')).toBe(10);
    expect(priceToCents('19.99')).toBe(1999);
    expect(priceToCents(null)).toBeNull();
    expect(priceToCents('')).toBeNull();
    expect(priceToCents('n/a')).toBeNull();
    expect(priceToCents('-1.00')).toBeNull();
    expect(priceToCents(12)).toBeNull();
  });

  it('feed the engine the same way the live data does', () => {
    const bolt = catalog.find('Lightning Bolt')!;
    const m10 = bolt.printings.find((p) => p.setCode === 'm10')!;
    expect(classify(m10, 1.5, V1_STORE, new Date('2026-10-18T00:00:00Z'))).toEqual(classify(toPrinting(byName('Lightning Bolt').find((r) => r.set === 'm10'))!, 1.5, V1_STORE, new Date('2026-10-18T00:00:00Z')));
  });
});

describe('double-faced cards', () => {
  it('uses the first face for colors and the picture when the top level has none', () => {
    const delver = catalog.find('Delver of Secrets // Insectile Aberration')!;
    expect(delver.colors).toEqual(['U']);
    expect(delver.typeLine).toBe('Creature — Human Wizard // Creature — Human Wizard Insect');
    const raw = byName('Delver of Secrets // Insectile Aberration').find((r) => r.set === 'mid')!;
    expect(raw.image_uris).toBeUndefined();
    expect(raw.colors).toBeUndefined();
    expect(delver.imageId).toBe(raws.find((r) => r.set === 'mid' && r.name === delver.name)!.id);
  });

  it('answers to the front face name and the full name', () => {
    const full = catalog.find('Fire // Ice');
    expect(full).toBeDefined();
    expect(catalog.find('fire')).toBe(full);
    expect(catalog.find('Delver of Secrets')).toBe(catalog.find('Delver of Secrets // Insectile Aberration'));
    expect(catalog.find('Insectile Aberration')).toBeUndefined();
  });

  it('keeps top-level colors and oracle ids that only the faces carry', () => {
    const split = catalog.find('Fire // Ice')!;
    expect(split.colors).toEqual(['R', 'U']);
    const reversible = catalog.find('Goblin Reversible')!;
    expect(reversible.oracleId).toBe(((byName('Goblin Reversible // Goblin Reversible')[0].card_faces as Raw[])[0]).oracle_id);
    expect(reversible.colors).toEqual(['R']);
    expect(reversible.imageId).toBe(byName('Goblin Reversible // Goblin Reversible')[0].id);
  });
});

describe('promo, frame and finish data', () => {
  it('keeps promo flags, promo types, frame effects, border and full art', () => {
    const bolt = catalog.find('Lightning Bolt')!;
    const sld = bolt.printings.find((p) => p.setCode === 'sld')!;
    expect(sld).toMatchObject({ promo: true, promoTypes: ['boosterfun'], frameEffects: ['showcase'], borderColor: 'borderless', fullArt: true, rarity: 'rare' });
    const plain = bolt.printings.find((p) => p.setCode === 'm10')!;
    expect(plain).toMatchObject({ promo: false, promoTypes: [], frameEffects: [], borderColor: 'black', fullArt: false, games: ['paper', 'mtgo'] });
    const prerelease = catalog.find('Llanowar Elves')!.printings.find((p) => p.setCode === 'pw21')!;
    expect(prerelease.promoTypes).toEqual(['prerelease', 'datestamped']);
    expect(prerelease.frameEffects).toEqual(['legendary']);
  });

  it('keeps finishes as foil only, nonfoil only, all three, and from old foil flags', () => {
    const finishes = (card: string, set: string) => catalog.find(card)!.printings.find((p) => p.setCode === set)!.finishes;
    expect(finishes('Lightning Bolt', 'p10')).toEqual(['foil']);
    expect(finishes('Lightning Bolt', 'lea')).toEqual(['nonfoil']);
    expect(finishes('Sol Ring', 'c21')).toEqual(['nonfoil', 'foil', 'etched']);
    expect(finishes('Lightning Bolt', 'mh2')).toEqual(['nonfoil', 'foil']);
    expect(byName('Lightning Bolt').find((r) => r.set === 'mh2')!.finishes).toBeUndefined();
  });

  it('keeps a printing date that differs from its set', () => {
    const judge = catalog.find('Lightning Bolt')!.printings.find((p) => p.setCode === 'p10')!;
    expect(judge.releasedAt).toBe('2010-12-01');
    expect(catalog.sets.find((s) => s.code === 'p10')!.releasedAt).toBe('2010-12-01');
    const elves = catalog.find('Llanowar Elves')!.printings.find((p) => p.setCode === 'pw21')!;
    expect(elves.releasedAt).toBe('2021-02-14');
    // A set with two dates stores the common one and only the odd printing carries its own.
    const rows = encodeCatalog([
      { ...slim('a', 'x', '1'), releasedAt: '2020-01-01' }, { ...slim('b', 'x', '2'), releasedAt: '2020-01-01' }, { ...slim('c', 'x', '3'), releasedAt: '2020-05-05' },
    ]);
    expect(rows.cards.sets[0][3]).toBe('2020-01-01');
    expect(rows.cards.cards.flatMap((c) => c[5]).filter((r) => r.length === 7)).toHaveLength(1);
  });

  it('stores the default extras once at index 0 and shares repeated ones', () => {
    expect(cardsFile.extras[0]).toEqual(['black', [], [], ['paper']]);
    const unique = new Set(cardsFile.extras.map((e) => JSON.stringify(e)));
    expect(unique.size).toBe(cardsFile.extras.length);
    const rows = cardsFile.cards.flatMap((c) => c[5]);
    expect(cardsFile.extras.length).toBeLessThan(rows.length);
  });

  it('writes finish masks as bits', () => {
    const rows = cardsFile.cards.find((c) => c[1] === 'Sol Ring')![5];
    expect(rows.map((r) => r[3])).toContain(FINISH_NONFOIL | FINISH_FOIL | FINISH_ETCHED);
    expect(rows.map((r) => r[3])).toContain(FINISH_NONFOIL);
  });
});

describe('names', () => {
  it('finds names the way the decklist parser compares them', () => {
    const vault = catalog.find("Lim-Dûl's Vault");
    expect(vault).toBeDefined();
    expect(catalog.find('lim-dul’s vault')).toBe(vault);
    expect(catalog.find('Ajani’s Pridemate')).toBe(catalog.find("ajani's  pridemate"));
    expect(catalog.find('Aether Vial')).toBeUndefined();
    expect(catalog.find('Æther Vial')).toBeDefined();
    expect(catalog.find('   ')).toBeUndefined();
    for (const card of catalog.cards) expect(catalog.find(nameKey(card.name))).toBeDefined();
  });

  it('autocompletes full names by prefix, leaving out tokens', () => {
    expect(catalog.autocomplete('li')).toEqual(["Lightning Bolt", "Lim-Dûl's Vault"]);
    expect(catalog.autocomplete('FIRE')).toEqual(['Fire // Ice']);
    expect(catalog.autocomplete('tre')).toEqual([]);
    expect(catalog.autocomplete('')).toEqual([]);
    expect(catalog.autocomplete('zzz')).toEqual([]);
    expect(catalog.autocomplete('l', 1)).toHaveLength(1);
    expect(catalog.find('Treasure')).toBeDefined();
  });

  it('prefers a real card over a token with the same name', () => {
    const cards = encodeCatalog([
      { ...slim('t', 'tok', '1'), name: 'Bat', typeLine: 'Token Creature — Bat', oracleId: 'token-bat' },
      { ...slim('r', 'set', '1'), name: 'Bat', typeLine: 'Creature — Bat', oracleId: 'real-bat' },
    ]);
    expect(decodeCatalog(cards.cards).find('bat')?.oracleId).toBe('real-bat');
  });

  it('prefers a full name over another card’s front face', () => {
    const cards = encodeCatalog([
      { ...slim('a', 's', '1'), name: 'Fire // Ice', oracleId: 'split' },
      { ...slim('b', 's', '2'), name: 'Fire', oracleId: 'plain' },
    ]);
    expect(decodeCatalog(cards.cards).find('fire')?.oracleId).toBe('plain');
  });
});

describe('summaries and images', () => {
  it('rebuilds a picture address from a printing id', () => {
    expect(cardImageUrl('d1e2f3a4-0000-4000-a000-000000000001')).toBe('https://cards.scryfall.io/normal/front/d/1/d1e2f3a4-0000-4000-a000-000000000001.jpg');
    expect(cardImageUrl('abcdef', 'small')).toBe('https://cards.scryfall.io/small/front/a/b/abcdef.jpg');
    expect(cardImageUrl('abcdef', 'large')).toBe('https://cards.scryfall.io/large/front/a/b/abcdef.jpg');
  });

  it('rebuilds the same address Scryfall gave, for every card with a picture', () => {
    for (const raw of raws) {
      const url = ((raw.image_uris ?? (raw.card_faces as Raw[])[0].image_uris) as Raw | undefined)?.normal as string | undefined;
      if (!url) continue;
      expect(cardImageUrl(raw.id as string, 'normal')).toBe(url.split('?')[0]);
    }
  });

  it('makes a CardSummary', () => {
    const bolt = catalog.find('Lightning Bolt')!;
    const s = catalog.summary(bolt);
    expect(s).toMatchObject({ oracleId: bolt.oracleId, name: 'Lightning Bolt', typeLine: 'Instant', colors: ['R'], id: bolt.imageId });
    expect(s.imageSmall).toBe(cardImageUrl(bolt.imageId!, 'small'));
    expect(s.imageNormal).toBe(cardImageUrl(bolt.imageId!, 'normal'));
    expect(s.printingsUri).toBe(byName('Lightning Bolt')[0].prints_search_uri);
    expect(s.sourceUri).toBe('https://scryfall.com/card/plst/55');
    expect(catalog.summary(catalog.find('Delver of Secrets')!).colors).toEqual(['U']);
  });

  it('has no picture for a card whose printings have none', () => {
    const noImage = { ...slim('x', 'set', '1'), hasImage: false };
    const out = decodeCatalog(encodeCatalog([noImage]).cards);
    const s = out.summary(out.cards[0]);
    expect(out.cards[0].imageId).toBeNull();
    expect(s).toMatchObject({ id: 'oracle-x', imageSmall: null, imageNormal: null });
  });
});

describe('manifest', () => {
  it('names the hashed files and carries the counts', () => {
    const manifest = buildManifest({ builtAt: '2026-10-18T10:00:00.000Z', scryfallUpdatedAt: '2026-10-18T09:06:08.225+00:00', counts: encoded.counts, cardsHash: 'aaaa', pricesHash: 'bbbb' });
    expect(manifest).toEqual({
      format: FORMAT_VERSION, builtAt: '2026-10-18T10:00:00.000Z', scryfallUpdatedAt: '2026-10-18T09:06:08.225+00:00',
      counts: { cards: 15, printings: 36, sets: encoded.counts.sets }, files: { cards: 'cards.aaaa.json', prices: 'prices.bbbb.json' },
    });
    expect(dataFileName('prices', '12')).toBe('prices.12.json');
    expect(MANIFEST_FILE).toBe('manifest.json');
  });
});

describe('empty and odd input', () => {
  it('encodes nothing into empty, decodable files', () => {
    const empty = encodeScryfallCards([]);
    expect(empty.counts).toEqual({ cards: 0, printings: 0, sets: 0 });
    const c = decodeCatalog(wire(empty.cards), wire(empty.prices));
    expect(c.cards).toEqual([]);
    expect(c.find('anything')).toBeUndefined();
    expect(c.autocomplete('a')).toEqual([]);
  });

  it('skips lines that are not cards', () => {
    const odd: unknown[] = [null, undefined, 5, 'text', [], {}, { object: 'card' }, { id: 'x', name: 'No set' }, { id: 'y', name: 'No games', set: 's', collector_number: '1' }];
    expect(encodeScryfallCards(odd).counts.printings).toBe(0);
    expect(slimCard({ id: 'y', name: 'Games not paper', set: 's', collector_number: '1', games: ['arena'] })).toBeNull();
  });

  it('fills in what a sparse card leaves out', () => {
    const slimmed = slimCard({ id: 'abc', name: 'Sparse', set: 'SET', collector_number: '7', games: ['paper'] })!;
    expect(slimmed).toMatchObject({ oracleId: 'abc', typeLine: '', colors: '', hasImage: false, setCode: 'set', rarity: '', releasedAt: '', borderColor: 'black', finishMask: FINISH_NONFOIL, flags: 0 });
    const out = decodeCatalog(wire(encodeCatalog([slimmed]).cards));
    expect(out.cards[0].printings[0]).toMatchObject({ setCode: 'set', setName: 'SET', finishes: ['nonfoil'], promo: false, releasedAt: '' });
    expect(out.sets[0].releasedAt).toBeNull();
  });

  it('keeps odd collector numbers and sorts them sensibly', () => {
    const list = ['100', '12a', '12', '2★', 'A-3'].map((cn) => ({ ...slim('c' + cn, 's', cn), oracleId: 'one' }));
    const out = decodeCatalog(wire(encodeCatalog(list).cards));
    expect(out.cards[0].printings.map((p) => p.collectorNumber)).toEqual(['2★', '12', '12a', '100', 'A-3']);
  });

  it('refuses files it does not understand', () => {
    expect(() => decodeCatalog({ ...cardsFile, format: 99 })).toThrow(CatalogFormatError);
    expect(() => decodeCatalog(null as unknown as CardsFile)).toThrow(CatalogFormatError);
    expect(() => decodeCatalog({ format: FORMAT_VERSION } as unknown as CardsFile)).toThrow(/missing/);
    expect(() => decodeCatalog(cardsFile, { ...pricesFile, format: 2 } as PricesFile)).toThrow(CatalogFormatError);
    const broken = wire(cardsFile);
    broken.cards[0][5][0][0] = 9999;
    expect(() => decodeCatalog(broken)).toThrow(/does not exist/);
  });

  it('treats a card with the same oracle id and several spellings as one card', () => {
    const out = encodeCatalog([{ ...slim('a', 's', '1'), oracleId: 'same' }, { ...slim('b', 't', '2'), oracleId: 'same' }]);
    expect(out.counts).toMatchObject({ cards: 1, printings: 2 });
  });

  it('keeps file sizes small: a printing is an array, not an object', () => {
    const row = cardsFile.cards[0][5][0];
    expect(Array.isArray(row)).toBe(true);
    expect(row.length === 6 || row.length === 7).toBe(true);
  });
});

function slim(id: string, setCode: string, collectorNumber: string) {
  return {
    id, oracleId: `oracle-${id}`, name: `Card ${id}`, typeLine: 'Instant', colors: 'R', hasImage: true, setCode, setName: setCode.toUpperCase(),
    setType: 'expansion', releasedAt: '2020-01-01', rarity: 'common', collectorNumber, finishMask: FINISH_NONFOIL, flags: 0,
    borderColor: 'black', promoTypes: [] as string[], frameEffects: [] as string[], games: ['paper'], prices: [null, null, null] as [null, null, null],
  };
}
