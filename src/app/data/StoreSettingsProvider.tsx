import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { StoreProfile } from '../../core/engine/engine';
import { DEFAULT_STORE_SETTINGS, storeProfile } from '../../core/store';
import type { StoreSettings } from '../../core/store';
import { DEFAULT_GAME } from '../../core/games';
import { useGame } from './useGame';
import { useStorage } from './StorageProvider';

// Settings are kept per game (a binder group of one game means nothing in another). Magic keeps the key it always had.
const keyFor = (game: string) => (game === DEFAULT_GAME ? 'store-settings' : `store-settings:${game}`);

interface StoreSettingsApi {
  settings: StoreSettings;
  ready: boolean;
  profile: StoreProfile;        // what the routing engine runs with
  update: (change: (settings: StoreSettings) => StoreSettings) => void;
}

const Context = createContext<StoreSettingsApi | null>(null);

// Binder groups, not-carried sets, basic lands and the worth-a-pull rule: saved on the device, shared by every screen
// that plans, so the list review, the dive plan and the store all agree.
export function StoreSettingsProvider({ children }: { children: ReactNode }) {
  const storage = useStorage();
  const [game] = useGame();
  const KEY = keyFor(game);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [ready, setReady] = useState(false);
  const latest = useRef(settings);

  useEffect(() => {
    let cancelled = false;
    storage.get<StoreSettings>('settings', KEY).then(saved => {
      if (cancelled) return;
      latest.current = saved ? { ...DEFAULT_STORE_SETTINGS, ...saved } : DEFAULT_STORE_SETTINGS;
      setSettings(latest.current);
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [storage, KEY]);

  const update = useCallback((change: (settings: StoreSettings) => StoreSettings) => {
    const next = change(latest.current);
    latest.current = next;
    setSettings(next);
    void storage.put('settings', KEY, next);
  }, [storage, KEY]);

  const value = useMemo<StoreSettingsApi>(() => ({ settings, ready, profile: storeProfile(settings), update }), [settings, ready, update]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useStoreSettings(): StoreSettingsApi {
  const api = useContext(Context);
  if (!api) throw new Error('useStoreSettings needs a StoreSettingsProvider above it.');
  return api;
}
