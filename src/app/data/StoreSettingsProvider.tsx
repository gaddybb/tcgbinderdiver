import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { StoreProfile } from '../../core/engine/engine';
import { DEFAULT_STORE_SETTINGS, storeProfile } from '../../core/store';
import type { StoreSettings } from '../../core/store';
import { useStorage } from './StorageProvider';

const KEY = 'store-settings';

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
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [ready, setReady] = useState(false);
  const latest = useRef(settings);

  useEffect(() => {
    let cancelled = false;
    storage.get<StoreSettings>('settings', KEY).then(saved => {
      if (cancelled) return;
      if (saved) { latest.current = { ...DEFAULT_STORE_SETTINGS, ...saved }; setSettings(latest.current); }
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [storage]);

  const update = useCallback((change: (settings: StoreSettings) => StoreSettings) => {
    const next = change(latest.current);
    latest.current = next;
    setSettings(next);
    void storage.put('settings', KEY, next);
  }, [storage]);

  const value = useMemo<StoreSettingsApi>(() => ({ settings, ready, profile: storeProfile(settings), update }), [settings, ready, update]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useStoreSettings(): StoreSettingsApi {
  const api = useContext(Context);
  if (!api) throw new Error('useStoreSettings needs a StoreSettingsProvider above it.');
  return api;
}
