import { createContext, useCallback, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { combineEntries, parseDecklist, nameKey } from '../../core/parse/parseDecklist';
import { pickSample } from '../../core/lists';
import type { IncomingEntry, SampleDeck } from '../../core/lists';
import { navigate } from '../router';
import { SAMPLE_DECKS } from './sampleDecks';
import { useLists } from './ListsProvider';

interface SamplesApi {
  decks: readonly SampleDeck[];
  available: boolean;                       // there are decks, and the player has no lists of their own yet
  start: (avoid?: string) => Promise<void>; // opens a random sample deck in the dive plan
}

const Context = createContext<SamplesApi | null>(null);

interface SampleDecksProviderProps {
  decks?: readonly SampleDeck[];
  random?: () => number;                    // tests pass a fixed number
  children: ReactNode;
}

export function SampleDecksProvider({ decks = SAMPLE_DECKS, random = Math.random, children }: SampleDecksProviderProps) {
  const lists = useLists();
  const hasOwn = lists.lists.some(l => !l.sample && l.entries.length > 0);

  const start = useCallback(async (avoid?: string) => {
    const deck = pickSample(decks, random(), avoid);
    if (!deck) return;
    const entries: IncomingEntry[] = combineEntries(parseDecklist(deck.text).entries, { sideboard: false, maybeboard: false })
      .map(c => ({ cardKey: nameKey(c.name), name: c.name, quantity: c.quantity, tags: c.tags }));
    await lists.startSample(deck.name, entries);
    navigate('/plan');
  }, [decks, random, lists]);

  const value = useMemo<SamplesApi>(() => ({ decks, available: decks.length > 0 && !hasOwn, start }), [decks, hasOwn, start]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSamples(): SamplesApi {
  const api = useContext(Context);
  if (!api) throw new Error('useSamples needs a SampleDecksProvider above it.');
  return api;
}
