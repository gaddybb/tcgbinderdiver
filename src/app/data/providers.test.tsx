import { render, renderHook, screen, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { WISHLIST_ID } from '../../core/lists';
import { MemoryStorage } from '../../storage';
import { copy } from '../copy/en';
import { ListsProvider, useLists } from './ListsProvider';
import { StorageProvider, useStorage } from './StorageProvider';

const T0 = new Date('2026-10-17T12:00:00Z');

const wrap = (storage: MemoryStorage, makeId?: () => string) =>
  ({ children }: { children: ReactNode }) => (
    <StorageProvider storage={storage}>
      <ListsProvider clock={() => T0} makeId={makeId}>{children}</ListsProvider>
    </StorageProvider>
  );

describe('StorageProvider', () => {
  it('gives its children the storage it was given, straight away', () => {
    const storage = new MemoryStorage();
    const { result } = renderHook(() => useStorage(), { wrapper: ({ children }) => <StorageProvider storage={storage}>{children}</StorageProvider> });
    expect(result.current).toBe(storage);
  });

  it('opens storage itself when none is given: a loading placeholder, then the children', async () => {
    render(<StorageProvider><p>inside</p></StorageProvider>);
    expect(screen.getByRole('status', { name: copy.loading })).toBeTruthy();
    expect(await screen.findByText('inside')).toBeTruthy();
  });

  it('falls back to memory storage when the browser has no IndexedDB, and says so', async () => {
    function Probe() { return <output>{String(useStorage().persistent)}</output>; }
    render(<StorageProvider><Probe /></StorageProvider>);
    expect(await screen.findByText('false')).toBeTruthy();
  });

  it('useStorage outside a provider says what is missing', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useStorage())).toThrow(/StorageProvider/);
    error.mockRestore();
  });
});

describe('ListsProvider', () => {
  it('is not ready until the lists are loaded, then has the wishlist', async () => {
    const { result } = renderHook(() => useLists(), { wrapper: wrap(new MemoryStorage()) });
    expect(result.current.ready).toBe(false);
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.lists.map(l => l.id)).toEqual([WISHLIST_ID]);
  });

  it('reports whether the browser keeps lists', async () => {
    const storage = new MemoryStorage();
    (storage as { persistent: boolean }).persistent = true;
    const { result } = renderHook(() => useLists(), { wrapper: wrap(storage) });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.persistent).toBe(true);
  });

  it('uses the clock it was given, for the lists it makes and for "now"', async () => {
    const { result } = renderHook(() => useLists(), { wrapper: wrap(new MemoryStorage()) });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.now()).toEqual(T0);
    expect(result.current.lists[0].createdAt).toBe(T0.toISOString());
  });

  it('creates a deck with the ids it is given, newest first', async () => {
    let n = 0;
    const { result } = renderHook(() => useLists(), { wrapper: wrap(new MemoryStorage(), () => `id-${++n}`) });
    await waitFor(() => expect(result.current.ready).toBe(true));
    let created: Awaited<ReturnType<typeof result.current.createDeck>> | undefined;
    await act(async () => { created = await result.current.createDeck('First', [{ cardKey: 'a', name: 'Sol Ring', quantity: 2 }]); });
    expect(created).toMatchObject({ status: 'ok', kept: 1, total: 1 });
    expect(result.current.lists.map(l => l.id)).toEqual(['id-1', WISHLIST_ID]);
    expect(result.current.lists[0].entries[0]).toMatchObject({ name: 'Sol Ring', quantity: 2 });
  });

  it('reports when a paste is cut at 250 cards', async () => {
    const { result } = renderHook(() => useLists(), { wrapper: wrap(new MemoryStorage()) });
    await waitFor(() => expect(result.current.ready).toBe(true));
    const entries = Array.from({ length: 260 }, (_, i) => ({ cardKey: `c${i}`, name: `Card ${i}`, quantity: 1 }));
    let created: Awaited<ReturnType<typeof result.current.createDeck>> | undefined;
    await act(async () => { created = await result.current.createDeck('Big', entries); });
    expect(created).toMatchObject({ status: 'ok', kept: 250, total: 260 });
  });

  it('never deletes the wishlist', async () => {
    const { result } = renderHook(() => useLists(), { wrapper: wrap(new MemoryStorage()) });
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { await result.current.remove(WISHLIST_ID); });
    expect(result.current.lists.map(l => l.id)).toEqual([WISHLIST_ID]);
  });

  it('ignores an edit to a list that is gone', async () => {
    const { result } = renderHook(() => useLists(), { wrapper: wrap(new MemoryStorage()) });
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { await result.current.rename('nope', 'Anything'); await result.current.setInNextDive('nope', false); });
    expect(result.current.lists).toHaveLength(1);
  });

  it('duplicating a list that is gone does nothing', async () => {
    const { result } = renderHook(() => useLists(), { wrapper: wrap(new MemoryStorage()) });
    await waitFor(() => expect(result.current.ready).toBe(true));
    let outcome: unknown = 'unset';
    await act(async () => { outcome = await result.current.duplicate('nope'); });
    expect(outcome).toBeUndefined();
  });

  it('useLists outside a provider says what is missing', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useLists())).toThrow(/ListsProvider/);
    error.mockRestore();
  });
});
