import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_STORE_SETTINGS } from '../../core/store';
import { MemoryStorage } from '../../storage';
import { StorageProvider } from './StorageProvider';
import { StoreSettingsProvider, useStoreSettings } from './StoreSettingsProvider';
import { useGame } from './useGame';

const wrap = (storage: MemoryStorage) => ({ children }: { children: ReactNode }) => (
  <StorageProvider storage={storage}><StoreSettingsProvider>{children}</StoreSettingsProvider></StorageProvider>
);

describe('the chosen game', () => {
  it('is Magic until something else is chosen', async () => {
    const { result } = renderHook(() => useGame(), { wrapper: wrap(new MemoryStorage()) });
    expect(result.current[0]).toBe('magic');
  });

  it('reads a saved game that is not live, or not known, as Magic', async () => {
    for (const saved of ['pokemon', 'chess']) {
      const storage = new MemoryStorage();
      await storage.put('settings', 'pref:game', saved);
      const { result } = renderHook(() => useGame(), { wrapper: wrap(storage) });
      await waitFor(() => expect(storage.get('settings', 'pref:game')).resolves.toBe(saved));
      expect(result.current[0]).toBe('magic');
    }
  });

  it('keeps the choice on the device', async () => {
    const storage = new MemoryStorage();
    const { result } = renderHook(() => useGame(), { wrapper: wrap(storage) });
    act(() => result.current[1]('magic'));
    await waitFor(() => expect(storage.get('settings', 'pref:game')).resolves.toBe('magic'));
  });
});

describe('store settings for a game', () => {
  it('keep Magic under the key they always had', async () => {
    const storage = new MemoryStorage();
    const { result } = renderHook(() => useStoreSettings(), { wrapper: wrap(storage) });
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.update(s => ({ ...s, includeBasicLands: !DEFAULT_STORE_SETTINGS.includeBasicLands })));
    await waitFor(() => expect(storage.get('settings', 'store-settings')).resolves.toMatchObject({ includeBasicLands: !DEFAULT_STORE_SETTINGS.includeBasicLands }));
  });
});
