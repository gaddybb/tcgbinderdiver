import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  WISHLIST_ID, addEntries, clearEntries, renameList, setEntryStatus, setInNextDive as withInNextDive,
} from '../../core/lists';
import type { CardList, IncomingEntry } from '../../core/lists';
import type { CardStatus } from '../../core/status';
import { ListLimitError, ListsRepository } from '../../storage';
import { useStorage } from './StorageProvider';

export type CreateResult =
  | { status: 'ok'; list: CardList; kept: number; total: number }   // kept < total when the 250 limit cut some off
  | { status: 'limit' };                                            // already 25 lists

export interface ListsApi {
  lists: CardList[];
  ready: boolean;
  persistent: boolean;
  now: () => Date;                // the app's clock, so screens and tests agree on "today"
  createDeck: (name: string, entries: readonly IncomingEntry[]) => Promise<CreateResult>;
  addToWishlist: (entries: readonly IncomingEntry[]) => Promise<{ added: number; skipped: number; kept: number; total: number }>;
  rename: (id: string, name: string) => Promise<void>;
  duplicate: (id: string) => Promise<CreateResult | undefined>;
  remove: (id: string) => Promise<void>;
  clearWishlist: () => Promise<void>;
  setInNextDive: (id: string, on: boolean) => Promise<void>;
  setStatus: (listId: string, cardKey: string, status: CardStatus) => Promise<void>;
}

const ListsContext = createContext<ListsApi | null>(null);

interface ListsProviderProps {
  children: ReactNode;
  clock?: () => Date;             // tests pass a fixed clock
  makeId?: () => string;
}

// The player's lists, loaded from storage and kept in step with it. The wishlist is created if it is missing.
// This is where the clock is read, because src/core never does.
export function ListsProvider({ children, clock = () => new Date(), makeId }: ListsProviderProps) {
  const storage = useStorage();
  const repo = useMemo(() => new ListsRepository(storage, makeId), [storage, makeId]);
  const clockRef = useRef(clock);
  useEffect(() => { clockRef.current = clock; });
  const now = useCallback(() => clockRef.current(), []);
  const [lists, setLists] = useState<CardList[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => setLists(await repo.all()), [repo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await repo.ensureWishlist(now());
      const all = await repo.all();
      if (!cancelled) { setLists(all); setReady(true); }
    })();
    return () => { cancelled = true; };
  }, [repo, now]);

  const api = useMemo<ListsApi>(() => {
    const edit = async (id: string, change: (list: CardList) => CardList) => {
      const list = await repo.get(id);
      if (list) { await repo.save(change(list)); await refresh(); }
    };
    return {
      lists,
      ready,
      persistent: storage.persistent,
      now,

      async createDeck(name, entries) {
        const at = now();
        try {
          const deck = await repo.createDeck(name, at);
          const { list, overflow } = addEntries(deck, entries, at);
          await repo.save(list);
          await refresh();
          return { status: 'ok', list, kept: list.entries.length, total: list.entries.length + overflow.length };
        } catch (error) {
          if (error instanceof ListLimitError) return { status: 'limit' };
          throw error;
        }
      },

      async addToWishlist(entries) {
        const at = now();
        const wishlist = await repo.ensureWishlist(at);
        const result = addEntries(wishlist, entries, at, { skipExisting: true });
        await repo.save(result.list);
        await refresh();
        return { added: result.added, skipped: result.skipped, kept: result.added, total: result.added + result.overflow.length };
      },

      rename: (id, name) => edit(id, list => renameList(list, name, now())),

      async duplicate(id) {
        try {
          const copy = await repo.duplicate(id, now());
          await refresh();
          return copy && { status: 'ok', list: copy, kept: copy.entries.length, total: copy.entries.length };
        } catch (error) {
          if (error instanceof ListLimitError) return { status: 'limit' };
          throw error;
        }
      },

      async remove(id) {
        if (id === WISHLIST_ID) return;
        await repo.remove(id);
        await refresh();
      },

      clearWishlist: () => edit(WISHLIST_ID, list => clearEntries(list, now())),
      setInNextDive: (id, on) => edit(id, list => withInNextDive(list, on)),
      setStatus: (listId, cardKey, status) => edit(listId, list => setEntryStatus(list, cardKey, status, now())),
    };
  }, [lists, ready, storage.persistent, repo, refresh, now]);

  return <ListsContext.Provider value={api}>{children}</ListsContext.Provider>;
}

export function useLists(): ListsApi {
  const api = useContext(ListsContext);
  if (!api) throw new Error('useLists needs a ListsProvider above it.');
  return api;
}
