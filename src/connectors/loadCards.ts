// Gets the card data a list needs: looks up names, fetches every printing, and saves each card as it arrives.
// Cards already saved and still fresh are not fetched again, so reopening a list costs nothing, and a trip that is
// interrupted resumes with only the cards still missing. Works with any GameConnector.
import { isStale } from '../core/cards';
import type { CardRecord } from '../core/cards';
import type { GameConnector } from '../core/connector';
import { nameKey } from '../core/parse/parseDecklist';
import type { CardsRepository } from '../storage/cardsRepository';

export interface WantedCard { cardKey: string; name: string }
export interface LoadProgress { total: number; done: number }

export interface LoadCardsOptions {
  connector: GameConnector;
  repo: CardsRepository;
  cards: readonly WantedCard[];
  now: Date;
  signal?: AbortSignal;
  onCached?: (records: ReadonlyMap<string, CardRecord>) => void;   // what was already saved, before any fetching
  onRecord?: (record: CardRecord) => void;                         // each card as it is saved
  onProgress?: (progress: LoadProgress) => void;
}

export interface LoadCardsResult {
  records: Map<string, CardRecord>;   // everything known, including saved data that is out of date
  notFound: string[];                 // card keys the data source does not know
  failed: boolean;                    // the data source could not be reached (or answered badly)
  aborted: boolean;
}

const front = (name: string): string => name.split(' // ')[0];
const sameCard = (name: string): string => nameKey(front(name));

export async function loadCards(options: LoadCardsOptions): Promise<LoadCardsResult> {
  const { connector, repo, now, signal } = options;

  const wanted = new Map<string, WantedCard>();
  for (const card of options.cards) if (!wanted.has(card.cardKey)) wanted.set(card.cardKey, card);

  const records = await repo.getMany([...wanted.keys()]);
  options.onCached?.(records);

  const missing = [...wanted.values()].filter(card => { const saved = records.get(card.cardKey); return !saved || isStale(saved, now); });
  const progress: LoadProgress = { total: missing.length, done: 0 };
  options.onProgress?.({ ...progress });
  const result: LoadCardsResult = { records, notFound: [], failed: false, aborted: false };
  if (missing.length === 0) return result;

  // Entries that share a card (for example "Fire" and "Fire // Ice") are fetched once and saved under each key.
  const keysByCard = new Map<string, string[]>();
  for (const card of missing) {
    const id = sameCard(card.name);
    keysByCard.set(id, [...(keysByCard.get(id) ?? []), card.cardKey]);
  }
  const advance = (by: number) => { progress.done += by; options.onProgress?.({ ...progress }); };

  try {
    const lookup = await connector.lookupNames(missing.map(c => c.name), { signal });

    for (const name of lookup.notFound) {
      const keys = keysByCard.get(sameCard(name)) ?? [];
      result.notFound.push(...keys);
      advance(keys.length);
    }

    for (const { requested, card } of lookup.found) {
      const printings = await connector.printings(card, signal);
      for (const key of keysByCard.get(sameCard(requested)) ?? []) {
        const record: CardRecord = { key, summary: card, printings, fetchedAt: now.toISOString() };
        await repo.put(record);
        records.set(key, record);
        options.onRecord?.(record);
        advance(1);
      }
    }
  } catch (error) {
    if ((error as { kind?: string }).kind === 'aborted' || signal?.aborted) result.aborted = true;
    else result.failed = true;
  }
  return result;
}
