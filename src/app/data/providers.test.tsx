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

  it('sets the status of a card, saves it and marks the list updated', async () => {
    const { result } = renderHook(() => useLists(), { wrapper: wrap(new MemoryStorage(), () => 'deck-1') });
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { await result.current.createDeck('Deck', [{ cardKey: 'sol', name: 'Sol Ring', quantity: 1 }]); });
    await act(async () => { await result.current.setStatus('deck-1', 'sol', 'proxy'); });
    const deck = result.current.lists.find(l => l.id === 'deck-1')!;
    expect(deck.entries[0].status).toBe('proxy');
    expect(deck.updatedAt).toBe(T0.toISOString());
  });

  it('ignores a status change for a list or card that is not there', async () => {
    const { result } = renderHook(() => useLists(), { wrapper: wrap(new MemoryStorage(), () => 'deck-1') });
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { await result.current.createDeck('Deck', [{ cardKey: 'sol', name: 'Sol Ring', quantity: 1 }]); });
    await act(async () => { await result.current.setStatus('nope', 'sol', 'proxy'); await result.current.setStatus('deck-1', 'nope', 'proxy'); });
    expect(result.current.lists.find(l => l.id === 'deck-1')!.entries[0].status).toBe('needed');
  });

  describe('bulk actions', () => {
    const line = (key: string, quantity = 1) => ({ cardKey: key, name: key.toUpperCase(), quantity });
    let n = 0;
    async function twoDecks() {
      n = 0;
      const hook = renderHook(() => useLists(), { wrapper: wrap(new MemoryStorage(), () => `deck-${++n}`) });
      await waitFor(() => expect(hook.result.current.ready).toBe(true));
      await act(async () => { await hook.result.current.createDeck('One', [line('a', 2), line('b'), line('c')]); });
      await act(async () => { await hook.result.current.createDeck('Two', [line('a'), line('z')]); });
      return hook;
    }
    const deck = (hook: Awaited<ReturnType<typeof twoDecks>>, id: string) => hook.result.current.lists.find(l => l.id === id)!;

    it('sets the status of several cards at once, counts the ones that changed and keeps the list as it was for Undo', async () => {
      const hook = await twoDecks();
      await act(async () => { await hook.result.current.setStatus('deck-1', 'c', 'proxy'); });
      let outcome: Awaited<ReturnType<typeof hook.result.current.setStatuses>>;
      await act(async () => { outcome = await hook.result.current.setStatuses('deck-1', ['a', 'b', 'c'], 'proxy'); });
      expect(deck(hook, 'deck-1').entries.map(e => e.status)).toEqual(['proxy', 'proxy', 'proxy']);
      expect(outcome!.changed).toBe(2);
      expect(outcome!.previous.entries.map(e => e.status)).toEqual(['needed', 'needed', 'proxy']);
    });

    it('changing nothing leaves the list and "Updated" alone', async () => {
      const hook = await twoDecks();
      const before = deck(hook, 'deck-1');
      let outcome: Awaited<ReturnType<typeof hook.result.current.setStatuses>>;
      await act(async () => { outcome = await hook.result.current.setStatuses('deck-1', ['a'], 'needed'); });
      expect(outcome!.changed).toBe(0);
      expect(deck(hook, 'deck-1')).toEqual(before);
    });

    it('restoreList puts a list back exactly as it was, including Updated', async () => {
      const hook = await twoDecks();
      const before = deck(hook, 'deck-1');
      let outcome: Awaited<ReturnType<typeof hook.result.current.setStatuses>>;
      await act(async () => { outcome = await hook.result.current.setStatuses('deck-1', ['a', 'b'], 'in_collection'); });
      await act(async () => { await hook.result.current.restoreList(outcome!.previous); });
      expect(deck(hook, 'deck-1')).toEqual(before);
    });

    it('removes several cards, and Undo brings them back in their places', async () => {
      const hook = await twoDecks();
      const before = deck(hook, 'deck-1');
      let outcome: Awaited<ReturnType<typeof hook.result.current.removeCards>>;
      await act(async () => { outcome = await hook.result.current.removeCards('deck-1', ['a', 'c', 'nope']); });
      expect(outcome!.removed).toBe(2);
      expect(deck(hook, 'deck-1').entries.map(e => e.cardKey)).toEqual(['b']);
      await act(async () => { await hook.result.current.restoreList(outcome!.previous); });
      expect(deck(hook, 'deck-1')).toEqual(before);
    });

    it('copies cards to another list: a card it has gains the copies, a new one is added, the source stays', async () => {
      const hook = await twoDecks();
      let outcome: Awaited<ReturnType<typeof hook.result.current.copyCards>>;
      await act(async () => { outcome = await hook.result.current.copyCards('deck-1', ['a', 'b'], 'deck-2'); });
      expect(outcome).toMatchObject({ added: 1, merged: 1, notFit: 0 });
      expect(deck(hook, 'deck-2').entries.map(e => [e.cardKey, e.quantity])).toEqual([['a', 3], ['z', 1], ['b', 1]]);
      expect(deck(hook, 'deck-1').entries).toHaveLength(3);
    });

    it('Undo of a copy restores the target list only', async () => {
      const hook = await twoDecks();
      const sourceBefore = deck(hook, 'deck-1');
      const targetBefore = deck(hook, 'deck-2');
      let outcome: Awaited<ReturnType<typeof hook.result.current.copyCards>>;
      await act(async () => { outcome = await hook.result.current.copyCards('deck-1', ['a', 'b', 'c'], 'deck-2'); });
      await act(async () => { await hook.result.current.restoreList(outcome!.previous); });
      expect(deck(hook, 'deck-2')).toEqual(targetBefore);
      expect(deck(hook, 'deck-1')).toEqual(sourceBefore);
    });

    it('reports the cards that did not fit under 250, and still copies the ones that did', async () => {
      const hook = await twoDecks();
      const many = Array.from({ length: 249 }, (_, i) => line(`m${i}`));
      await act(async () => { await hook.result.current.createDeck('Big', many); });
      let outcome: Awaited<ReturnType<typeof hook.result.current.copyCards>>;
      await act(async () => { outcome = await hook.result.current.copyCards('deck-1', ['a', 'b', 'c'], 'deck-3'); });
      expect(outcome).toMatchObject({ added: 1, merged: 0, notFit: 2 });
      expect(deck(hook, 'deck-3').entries).toHaveLength(250);
    });

    it('copying nothing changes nothing', async () => {
      const hook = await twoDecks();
      const before = deck(hook, 'deck-2');
      await act(async () => { await hook.result.current.copyCards('deck-1', [], 'deck-2'); });
      expect(deck(hook, 'deck-2')).toEqual(before);
    });

    it('does nothing, and says so, when a list is gone', async () => {
      const hook = await twoDecks();
      const outcomes: unknown[] = [];
      await act(async () => {
        outcomes.push(await hook.result.current.setStatuses('nope', ['a'], 'proxy'));
        outcomes.push(await hook.result.current.removeCards('nope', ['a']));
        outcomes.push(await hook.result.current.copyCards('nope', ['a'], 'deck-1'));
        outcomes.push(await hook.result.current.copyCards('deck-1', ['a'], 'nope'));
      });
      expect(outcomes).toEqual([undefined, undefined, undefined, undefined]);
    });
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
