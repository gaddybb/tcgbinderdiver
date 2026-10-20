// The browser's card data source: answers from the local catalog and falls back to the live API for what it does not
// know (cards newer than the last build, typos) or when the catalog is not available at all.
import type { Catalog, CatalogCard, Manifest } from '../../core/catalog';
import type { CardSummary, FoundName, FuzzyResult, GameConnector, LookupOptions, NameLookup, SetInfo } from '../../core/connector';
import type { Printing } from '../../core/engine/engine';
import { nameKey } from '../../core/parse/parseDecklist';
import { MAGIC_SORT_ORDER, sortCategory } from '../scryfall';
import type { LoadedCatalog } from './catalogLoader';

const MIN_AUTOCOMPLETE_CHARS = 2;   // as the live API needs, so both sources behave alike
const front = (name: string): string => name.split(' // ')[0];

export interface BulkConnectorOptions {
  load: () => Promise<LoadedCatalog>;
  fallback: GameConnector;
}

export interface CatalogInfo {
  builtAt: string;
  scryfallUpdatedAt: string;   // when the prices (and the rest) were collected by Scryfall
  offline: boolean;
}

import { fingerprint } from '../../core/handoff';

interface Ready { catalog: Catalog; manifest: Manifest; offline: boolean; byOracle: Map<string, CatalogCard> }

export class BulkConnector implements GameConnector {
  readonly game = 'magic';
  readonly sortOrder: readonly string[] = MAGIC_SORT_ORDER;
  private ready?: Promise<Ready | null>;

  constructor(private readonly options: BulkConnectorOptions) {}

  sortCategory(card: CardSummary): string {
    return sortCategory(card);
  }

  // Loaded once, on first use. If it can't be, every call goes to the live API for the rest of the visit.
  private state(): Promise<Ready | null> {
    this.ready ??= this.options.load().then(
      ({ catalog, manifest, offline }): Ready => ({ catalog, manifest, offline, byOracle: new Map(catalog.cards.map(c => [c.oracleId, c])) }),
      () => null,
    );
    return this.ready;
  }

  private fingerprints?: Promise<ReadonlyMap<number, string> | null>;

  // Every card name in the catalog by fingerprint, or null when the live API is in use.
  fingerprintIndex(): Promise<ReadonlyMap<number, string> | null> {
    this.fingerprints ??= this.state().then(s => s && new Map(s.catalog.cards.map(c => [fingerprint(c.name), c.name])));
    return this.fingerprints;
  }

  // Which catalog is in use, or null when the live API is. Used to show "prices updated".
  async catalogInfo(): Promise<CatalogInfo | null> {
    const s = await this.state();
    return s && { builtAt: s.manifest.builtAt, scryfallUpdatedAt: s.manifest.scryfallUpdatedAt, offline: s.offline };
  }

  private summaryOf(s: Ready, card: CatalogCard): CardSummary {
    return { ...s.catalog.summary(card), dataTime: s.manifest.scryfallUpdatedAt };
  }

  // Exact names from the catalog; the rest (if any) from the live API. Each source reports its batch as it finishes.
  async lookupNames(names: string[], options: LookupOptions = {}): Promise<NameLookup> {
    const s = await this.state();
    if (!s) return this.options.fallback.lookupNames(names, options);

    const found: FoundName[] = [];
    const missing: string[] = [];
    const seen = new Set<string>();
    for (const requested of names) {
      const key = nameKey(front(requested));
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const card = s.catalog.find(requested);
      if (card) found.push({ requested, card: this.summaryOf(s, card) });
      else missing.push(requested);
    }

    const local: NameLookup = { found, notFound: [] };
    if (found.length > 0) await options.onBatch?.(local);
    if (missing.length === 0) return local;

    const live = await this.options.fallback.lookupNames(missing, options);
    return { found: [...found, ...live.found], notFound: live.notFound };
  }

  async fuzzy(name: string, signal?: AbortSignal): Promise<FuzzyResult> {
    const s = await this.state();
    const card = s?.catalog.find(name);
    if (s && card) return { status: 'match', card: this.summaryOf(s, card) };
    return this.options.fallback.fuzzy(name, signal);
  }

  async autocomplete(query: string, signal?: AbortSignal): Promise<string[]> {
    const s = await this.state();
    if (!s) return this.options.fallback.autocomplete(query, signal);
    return query.trim().length < MIN_AUTOCOMPLETE_CHARS ? [] : s.catalog.autocomplete(query);
  }

  // Every paper printing, basics included. A card the catalog doesn't have (it came from the live API) is asked for live.
  async printings(card: CardSummary, signal?: AbortSignal): Promise<Printing[]> {
    const s = await this.state();
    const local = s?.byOracle.get(card.oracleId);
    return local ? local.printings : this.options.fallback.printings(card, signal);
  }

  async sets(now: Date): Promise<SetInfo[]> {
    const s = await this.state();
    return s ? s.catalog.sets : this.options.fallback.sets(now);
  }
}

export function createBulkConnector(options: BulkConnectorOptions): BulkConnector {
  return new BulkConnector(options);
}
