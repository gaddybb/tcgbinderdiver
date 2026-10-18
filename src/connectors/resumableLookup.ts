// A name lookup that survives leaving the page: progress is saved after every batch, so running the same
// job again only asks for the names that are still missing. Works with any GameConnector and any AppStorage.
import type { CardSummary, GameConnector, LookupOptions, NameLookup } from '../core/connector';
import { nameKey } from '../core/parse/parseDecklist';
import type { AppStorage } from '../storage';

// Scryfall's front-face rule means "Fire" and "Fire // Ice" are one request; keys follow the same rule.
const keyOf = (name: string): string => nameKey(name.split(' // ')[0]);

interface LookupJobState {
  jobId: string;
  found: Record<string, { requested: string; card: CardSummary }>;
  notFound: Record<string, string>;
}

export const lookupJobKey = (jobId: string): string => `lookup:${jobId}`;

export async function resumableLookup(
  connector: GameConnector,
  storage: AppStorage,
  jobId: string,
  names: string[],
  options: Pick<LookupOptions, 'signal' | 'onBatch'> = {},
): Promise<NameLookup> {
  const state = (await storage.get<LookupJobState>('cache', lookupJobKey(jobId))) ?? { jobId, found: {}, notFound: {} };

  const remaining = names.filter(n => !state.found[keyOf(n)] && !state.notFound[keyOf(n)]);
  if (remaining.length > 0) {
    await connector.lookupNames(remaining, {
      signal: options.signal,
      onBatch: async (batch) => {
        for (const f of batch.found) state.found[keyOf(f.requested)] = f;
        for (const n of batch.notFound) state.notFound[keyOf(n)] = n;
        await storage.put('cache', lookupJobKey(jobId), state);   // saved before the next batch, so a stop loses nothing
        await options.onBatch?.(batch);
      },
    });
  }

  // Report in the order the names were given.
  const result: NameLookup = { found: [], notFound: [] };
  const done = new Set<string>();
  for (const name of names) {
    const key = keyOf(name);
    if (done.has(key)) continue;
    done.add(key);
    if (state.found[key]) result.found.push({ requested: name, card: state.found[key].card });
    else if (state.notFound[key]) result.notFound.push(name);
  }
  return result;
}

// Forget a finished (or abandoned) job.
export async function clearLookupJob(storage: AppStorage, jobId: string): Promise<void> {
  await storage.delete('cache', lookupJobKey(jobId));
}

// Names still to look up for a saved job, or null when there is no saved job. Lets My lists show a resume banner.
export async function pendingLookupNames(storage: AppStorage, jobId: string, names: string[]): Promise<string[] | null> {
  const state = await storage.get<LookupJobState>('cache', lookupJobKey(jobId));
  if (!state) return null;
  return names.filter(n => !state.found[keyOf(n)] && !state.notFound[keyOf(n)]);
}
