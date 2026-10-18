import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createStorage } from '../../storage';
import type { AppStorage } from '../../storage';
import { SkeletonRow } from '../components';

const StorageContext = createContext<AppStorage | null>(null);

interface StorageProviderProps {
  // Tests pass their own storage; the app leaves this out and gets IndexedDB (or memory if the browser blocks it).
  storage?: AppStorage;
  children: ReactNode;
}

// Opens the device storage once and shares it. Shows a loading placeholder for the moment that takes.
export function StorageProvider({ storage: given, children }: StorageProviderProps) {
  const [opened, setOpened] = useState<AppStorage | null>(null);

  useEffect(() => {
    if (given) return;
    let cancelled = false;
    createStorage().then(s => { if (!cancelled) setOpened(s); });
    return () => { cancelled = true; };
  }, [given]);

  const storage = given ?? opened;
  if (!storage) return <SkeletonRow />;
  return <StorageContext.Provider value={storage}>{children}</StorageContext.Provider>;
}

export function useStorage(): AppStorage {
  const storage = useContext(StorageContext);
  if (!storage) throw new Error('useStorage needs a StorageProvider above it.');
  return storage;
}
