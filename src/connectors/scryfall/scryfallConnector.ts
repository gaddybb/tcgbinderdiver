import type { Printing } from '../../core/engine/engine';
import type {
  CardSummary, FoundName, FuzzyResult, GameConnector, LookupOptions, NameLookup, SetInfo,
} from '../../core/connector';
import { nameKey } from '../../core/parse/parseDecklist';
import type { AppStorage } from '../../storage';
import { ScryfallClient, ScryfallError } from './client';
import { MAGIC_SORT_ORDER, frontFaceName, isRecord, sortCategory, toCardSummary, toPrinting, toSetInfo } from './mappers';

export const COLLECTION_BATCH_SIZE = 75;       // Scryfall's limit for POST /cards/collection
export const MAX_FUZZY_CANDIDATES = 20;
export const SETS_CACHE_KEY = 'scryfall:sets';
export const SETS_TTL_MS = 7 * 24 * 3600 * 1000;
const MAX_PRINTING_PAGES = 20;                 // 175 printings per page; no card comes close

interface SetsCache { fetchedAt: string; sets: SetInfo[] }

export interface ScryfallConnectorOptions {
  client?: ScryfallClient;
  cache?: AppStorage;                          // where the sets list is kept between visits
}

const encode = encodeURIComponent;

function listData(body: unknown): unknown[] {
  if (!isRecord(body) || !Array.isArray(body.data)) throw new ScryfallError('bad_response', 'Scryfall sent a list we could not read.');
  return body.data;
}

export class ScryfallConnector implements GameConnector {
  readonly game = 'magic';
  readonly sortOrder: readonly string[] = MAGIC_SORT_ORDER;
  private readonly client: ScryfallClient;
  private readonly cache?: AppStorage;

  constructor(options: ScryfallConnectorOptions = {}) {
    this.client = options.client ?? new ScryfallClient();
    this.cache = options.cache;
  }

  sortCategory(card: CardSummary): string {
    return sortCategory(card);
  }

  // Exact names, 75 per request, by the front-face name for "A // B" cards. Each batch is reported as it finishes.
  async lookupNames(names: string[], options: LookupOptions = {}): Promise<NameLookup> {
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const name of names) {
      const key = nameKey(frontFaceName(name));
      if (key && !seen.has(key)) { seen.add(key); unique.push(name); }
    }

    const all: NameLookup = { found: [], notFound: [] };
    for (let i = 0; i < unique.length; i += COLLECTION_BATCH_SIZE) {
      const batchNames = unique.slice(i, i + COLLECTION_BATCH_SIZE);
      const { status, body } = await this.client.post(
        '/cards/collection', { identifiers: batchNames.map(name => ({ name: frontFaceName(name) })) }, options.signal);
      if (status !== 200) throw new ScryfallError('bad_response', `Scryfall answered ${status} to a name lookup.`, status);

      const byKey = new Map<string, CardSummary>();
      for (const raw of listData(body)) {
        const card = toCardSummary(raw);
        const key = nameKey(frontFaceName(card.name));
        if (!byKey.has(key)) byKey.set(key, card);
      }
      const batch: NameLookup = { found: [], notFound: [] };
      for (const requested of batchNames) {
        const card = byKey.get(nameKey(frontFaceName(requested)));
        if (card) batch.found.push({ requested, card } satisfies FoundName);
        else batch.notFound.push(requested);
      }
      all.found.push(...batch.found);
      all.notFound.push(...batch.notFound);
      await options.onBatch?.(batch);
    }
    return all;
  }

  // Typo-tolerant. When the name is too vague for one card, the search gives the candidates to pick from.
  async fuzzy(name: string, signal?: AbortSignal): Promise<FuzzyResult> {
    const named = await this.client.get(`/cards/named?fuzzy=${encode(name)}`, signal);
    if (named.status === 200) return { status: 'match', card: toCardSummary(named.body) };
    if (!(isRecord(named.body) && named.body.type === 'ambiguous')) return { status: 'none' };

    const search = await this.client.get(`/cards/search?q=${encode(name)}&unique=cards&order=name`, signal);
    if (search.status !== 200) return { status: 'none' };
    const candidates = listData(search.body).slice(0, MAX_FUZZY_CANDIDATES).map(toCardSummary);
    if (candidates.length === 0) return { status: 'none' };
    if (candidates.length === 1) return { status: 'match', card: candidates[0] };
    return { status: 'ambiguous', candidates };
  }

  async autocomplete(query: string, signal?: AbortSignal): Promise<string[]> {
    const q = query.trim();
    if (q.length < 2) return [];   // Scryfall needs at least two characters
    const { status, body } = await this.client.get(`/cards/autocomplete?q=${encode(q)}`, signal);
    if (status !== 200) return [];
    return listData(body).filter((x): x is string => typeof x === 'string');
  }

  // Follows prints_search_uri and next_page. Digital, non-paper and memorabilia printings are dropped.
  async printings(card: CardSummary, signal?: AbortSignal): Promise<Printing[]> {
    const out: Printing[] = [];
    let url: string | undefined = card.printingsUri;
    for (let page = 0; url && page < MAX_PRINTING_PAGES; page++) {
      const { status, body } = await this.client.get(url, signal);
      if (status === 404) break;
      if (status !== 200) throw new ScryfallError('bad_response', `Scryfall answered ${status} to a printings request.`, status);
      for (const raw of listData(body)) {
        const printing = toPrinting(raw);
        if (printing) out.push(printing);
      }
      const hasMore = isRecord(body) && body.has_more === true;
      url = hasMore && isRecord(body) && typeof body.next_page === 'string' ? body.next_page : undefined;
    }
    return out;
  }

  // Cached for 7 days. If Scryfall can't be reached, an expired copy is better than nothing.
  async sets(now: Date): Promise<SetInfo[]> {
    const cached = await this.cache?.get<SetsCache>('cache', SETS_CACHE_KEY);
    const age = cached ? now.getTime() - Date.parse(cached.fetchedAt) : Number.POSITIVE_INFINITY;
    if (cached && age >= 0 && age < SETS_TTL_MS) return cached.sets;

    try {
      const { status, body } = await this.client.get('/sets');
      if (status !== 200) throw new ScryfallError('bad_response', `Scryfall answered ${status} to a sets request.`, status);
      const sets = listData(body).map(toSetInfo);
      await this.cache?.put<SetsCache>('cache', SETS_CACHE_KEY, { fetchedAt: now.toISOString(), sets });
      return sets;
    } catch (error) {
      if (cached && error instanceof ScryfallError) return cached.sets;
      throw error;
    }
  }
}
