import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { endTrip, startTrip } from '../../core/trip';
import type { Trip } from '../../core/trip';
import { useLists } from './ListsProvider';
import { useGame } from './useGame';
import { useStorage } from './StorageProvider';

const KEY = 'current';

interface TripApi {
  trip: Trip | null;            // the trip in progress, or the one just ended, until a new one starts
  ready: boolean;
  start: (listIds: readonly string[]) => Trip;
  update: (change: (trip: Trip) => Trip) => void;
  end: () => void;
  clear: () => void;
}

const Context = createContext<TripApi | null>(null);

// The current store trip, saved on the device so it survives a refresh or a closed tab, and reads back as it was left.
export function TripProvider({ children }: { children: ReactNode }) {
  const storage = useStorage();
  const lists = useLists();
  const [game] = useGame();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [ready, setReady] = useState(false);
  const latest = useRef<Trip | null>(null);

  useEffect(() => {
    let cancelled = false;
    storage.get<Trip>('trips', KEY).then(saved => {
      if (cancelled) return;
      latest.current = saved ?? null;
      setTrip(latest.current);
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [storage]);

  const save = useCallback((next: Trip | null) => {
    latest.current = next;
    setTrip(next);
    void (next ? storage.put('trips', KEY, next) : storage.delete('trips', KEY));
  }, [storage]);

  const api = useMemo<TripApi>(() => ({
    trip,
    ready,
    start(listIds) {
      const now = lists.now();
      const next = startTrip(`trip-${now.getTime()}`, now, listIds, game);
      save(next);
      return next;
    },
    update(change) { if (latest.current) save(change(latest.current)); },
    end() { if (latest.current) save(endTrip(latest.current, lists.now())); },
    clear() { save(null); },
  }), [trip, ready, lists, save, game]);

  return <Context.Provider value={api}>{children}</Context.Provider>;
}

export function useTrip(): TripApi {
  const api = useContext(Context);
  if (!api) throw new Error('useTrip needs a TripProvider above it.');
  return api;
}
