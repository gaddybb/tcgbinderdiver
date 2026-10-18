import { useCallback, useEffect, useState } from 'react';
import { useStorage } from './StorageProvider';

// A small choice the player made (a view, a sort) kept on this device through the storage seam, so it comes back next time
// and can move to the account with everything else when accounts exist. It renders with the default until the saved
// choice is read, then switches to it.
export function usePreference<T extends string>(name: string, fallback: T): [T, (value: T) => void] {
  const storage = useStorage();
  const key = `pref:${name}`;
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    let current = true;
    void storage.get<T>('settings', key).then(saved => { if (current && saved !== undefined) setValue(saved); });
    return () => { current = false; };
  }, [storage, key]);

  const set = useCallback((next: T) => {
    setValue(next);
    void storage.put('settings', key, next);
  }, [storage, key]);

  return [value, set];
}
