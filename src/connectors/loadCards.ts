// Gets the card data a list needs: looks up names, fetches every printing, and saves each card as it arrives.
// Cards already saved and still fresh are not fetched again, so reopening a list costs nothing, and a trip that is
// interrupted resumes with only the cards still missing. Works with any GameConnector.
// Printings are fetched a few cards at a time (the connector's client still spaces request starts about 100 ms apart),
// and basic lands get no printings fetch at all, since the engine skips them.
import { isStale } from '../core/cards';
import type { CardRecord } from '../core/cards';
import type { CardSummary, FoundName, GameConnector, NameLookup } from '../core/connector';
import { isBasicLand } from '../core/engine/engine';
import type { Printing } from '../core/engine/engine';
import { nameKey } from '../core/parse/parseDecklist';
import type { CardsRepository } from '../storage/cardsRepository';

// Cards whose printings are fetched at the same time. Request starts stay paced by the client, so this only hides the
// wait for each answer; it does not raise the request rate.
export const PRINTINGS_CONCURRENCY = 4;

export interface WantedCard { cardKey: string; name: string }
export interface LoadProgress { total: number; done: number }

export interface LoadCardsOptions {
  connector: GameConnector;
  repo: CardsRepository;
  cards: readonly WantedCard[];
  now: Date;
  signal?: AbortSignal;
  // Fetch printings for basic lands too. Off by default: the engine skips basics unless the include-basics switch is on.
  // Basics saved while this was off have an empty printings list and count as fresh, so turning it on later must
  // refetch them (for example by dropping their saved records) or they stay without printings for a week.
  includeBasics?: boolean;
  concurrency?: number;                                            // cards fetched at once; PRINTINGS_CONCURRENCY if not given
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

  // With basics on the hunt, a basic land saved with no printings (saved while they were off) is fetched again so it can be planned.
  const needsFetch = (saved: CardRecord | undefined) =>
    !saved || isStale(saved, now) || (options.includeBasics === true && saved.printings.length === 0 && isBasicLand(saved.summary.typeLine));
  const missing = [...wanted.values()].filter(card => needsFetch(records.get(card.cardKey)));
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

  // A card that came from the local catalog carries the time of that data (`dataTime`). It is not saved per card:
  // reading it again from the catalog is instant, and that way its prices are always as fresh as the catalog.
  const save = async (requested: string, card: CardSummary, printings: Printing[]) => {
    for (const key of keysByCard.get(sameCard(requested)) ?? []) {
      const record: CardRecord = { key, summary: card, printings, fetchedAt: card.dataTime ?? now.toISOString() };
      if (card.dataTime === undefined) await repo.put(record);
      records.set(key, record);
      options.onRecord?.(record);
      advance(1);
    }
  };

  try {
    // Lookups are collected batch by batch, so when a later batch fails the earlier ones are still used.
    const lookup: NameLookup = { found: [], notFound: [] };
    let lookupFailure: unknown;
    try {
      const returned = await connector.lookupNames(missing.map(c => c.name), {
        signal,
        onBatch: batch => { lookup.found.push(...batch.found); lookup.notFound.push(...batch.notFound); },
      });
      if (lookup.found.length + lookup.notFound.length === 0) { lookup.found.push(...returned.found); lookup.notFound.push(...returned.notFound); }
    } catch (error) {
      lookupFailure = error;
    }

    for (const name of lookup.notFound) {
      const keys = keysByCard.get(sameCard(name)) ?? [];
      result.notFound.push(...keys);
      advance(keys.length);
    }

    // Basics fetched from the live API keep their picture and type but get no printings (the engine skips them, and
    // they have hundreds). From the local catalog their printings cost nothing, so they keep them: a later
    // "include basic lands" switch then needs no refetch.
    const queue: FoundName[] = [];
    for (const found of lookup.found) {
      if (!options.includeBasics && found.card.dataTime === undefined && isBasicLand(found.card.typeLine)) await save(found.requested, found.card, []);
      else queue.push(found);
    }

    // A few workers take cards off the queue. The first real failure stops new cards from starting; cards already in
    // flight finish and are saved, so the next try fetches only what is still missing.
    let next = 0;
    let stopped = false;
    let failure: unknown;
    const worker = async () => {
      while (!stopped && next < queue.length) {
        const { requested, card } = queue[next++];
        try {
          await save(requested, card, await connector.printings(card, signal));
        } catch (error) {
          if (!stopped) { stopped = true; failure = error; }
        }
      }
    };
    const workers = Math.max(1, Math.min(options.concurrency ?? PRINTINGS_CONCURRENCY, queue.length));
    await Promise.all(Array.from({ length: workers }, worker));
    if (lookupFailure) throw lookupFailure;   // after everything that did arrive has been used and saved
    if (stopped) throw failure;
  } catch (error) {
    if ((error as { kind?: string }).kind === 'aborted' || signal?.aborted) result.aborted = true;
    else result.failed = true;
  }
  return result;
}
