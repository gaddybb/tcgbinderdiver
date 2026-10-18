// A GameConnector that knows a few cards and never touches the network, for tests. Not imported by app code.
import type { CardSummary, GameConnector, LookupOptions, NameLookup } from '../core/connector';
import { pr } from '../core/engine/fixtures';
import type { Printing } from '../core/engine/engine';
import { MAGIC_SORT_ORDER, ScryfallError, sortCategory } from './scryfall';

export interface FakeCard {
  name: string;
  typeLine?: string;
  colors?: string[];
  image?: string | null;
  printings?: Printing[];
}

export interface FakeOptions {
  failPrintingsFor?: string[];
  failLookup?: boolean;
  abortOnLookup?: boolean;
}

export function fakeSummary(card: FakeCard): CardSummary {
  return {
    id: `id-${card.name}`,
    oracleId: `o-${card.name}`,
    name: card.name,
    typeLine: card.typeLine ?? 'Artifact',
    colors: card.colors ?? [],
    imageSmall: card.image === undefined ? `https://img.example/${encodeURIComponent(card.name)}.jpg` : card.image,
    imageNormal: null,
    sourceUri: 'u',
    printingsUri: `p-${card.name}`,
  };
}

// `known` are the cards the "data source" has. `state` can be changed during a test: make lookups fail, or hold them
// until `release()` is called, to look at the loading state.
export function fakeConnector(known: readonly (string | FakeCard)[], options: FakeOptions = {}) {
  const cards = known.map(k => (typeof k === 'string' ? { name: k } : k));
  const calls = { lookups: [] as string[][], printings: [] as string[] };
  const state = { failLookup: options.failLookup ?? false, failPrintingsFor: options.failPrintingsFor ?? [] };
  let release: () => void = () => {};
  let held: Promise<void> | undefined;
  const hold = () => { held = new Promise<void>(resolve => { release = resolve; }); };

  const connector: GameConnector = {
    game: 'fake',
    sortOrder: MAGIC_SORT_ORDER,
    sortCategory,
    async lookupNames(names: string[], opts?: LookupOptions): Promise<NameLookup> {
      calls.lookups.push(names);
      if (held) await held;
      if (state.failLookup) throw new ScryfallError('network', 'down');
      if (options.abortOnLookup || opts?.signal?.aborted) throw new ScryfallError('aborted', 'stopped');
      const result: NameLookup = { found: [], notFound: [] };
      const seen = new Set<string>();
      for (const requested of names) {
        const front = requested.split(' // ')[0].toLowerCase();
        if (seen.has(front)) continue;
        seen.add(front);
        const match = cards.find(c => c.name.split(' // ')[0].toLowerCase() === front);
        if (match) result.found.push({ requested, card: fakeSummary(match) });
        else result.notFound.push(requested);
      }
      return result;
    },
    async fuzzy() { return { status: 'none' }; },
    async autocomplete() { return []; },
    async printings(card: CardSummary): Promise<Printing[]> {
      calls.printings.push(card.name);
      if (state.failPrintingsFor.includes(card.name)) throw new ScryfallError('server', 'oops', 503);
      return cards.find(c => c.name === card.name)?.printings ?? [pr({ setCode: 'cmm', usd: '1.00' })];
    },
    async sets() { return []; },
  };
  return { connector, calls, state, hold, release: () => release() };
}
