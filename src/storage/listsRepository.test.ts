import { describe, expect, it } from 'vitest';
import { MAX_LISTS, WISHLIST_ID, addEntries, clearEntries } from '../core/lists';
import { ListLimitError, ListsRepository, WishlistProtectedError } from './listsRepository';
import { MemoryStorage } from './memoryStorage';

const T0 = new Date('2026-10-17T12:00:00Z');
const later = (days: number) => new Date(T0.getTime() + days * 24 * 3600 * 1000);

function setup() {
  const storage = new MemoryStorage();
  let n = 0;
  const repo = new ListsRepository(storage, () => `id-${++n}`);
  return { storage, repo };
}

describe('ListsRepository', () => {
  it('starts with no lists', async () => {
    expect(await setup().repo.all()).toEqual([]);
  });

  describe('the wishlist', () => {
    it('is created when missing, under its fixed id, switched on', async () => {
      const { repo } = setup();
      const wish = await repo.ensureWishlist(T0);
      expect(wish).toMatchObject({ id: WISHLIST_ID, kind: 'wishlist', name: 'Wishlist', entries: [], inNextDive: true });
      expect((await repo.all()).map(l => l.id)).toEqual([WISHLIST_ID]);
    });

    it('is created once, and keeps what is on it', async () => {
      const { repo } = setup();
      const wish = await repo.ensureWishlist(T0);
      await repo.save(addEntries(wish, [{ cardKey: 'a', name: 'Sol Ring', quantity: 1 }], later(1)).list);
      const again = await repo.ensureWishlist(later(2));
      expect(again.entries).toHaveLength(1);
      expect(again.createdAt).toBe(T0.toISOString());
    });

    it('cannot be deleted', async () => {
      const { repo } = setup();
      await repo.ensureWishlist(T0);
      await expect(repo.remove(WISHLIST_ID)).rejects.toBeInstanceOf(WishlistProtectedError);
      expect(await repo.get(WISHLIST_ID)).toBeDefined();
    });

    it('can be cleared by saving it empty', async () => {
      const { repo } = setup();
      const wish = await repo.ensureWishlist(T0);
      const full = addEntries(wish, [{ cardKey: 'a', name: 'A', quantity: 1 }], T0).list;
      await repo.save(full);
      await repo.save(clearEntries(full, later(1)));
      expect((await repo.get(WISHLIST_ID))!.entries).toEqual([]);
    });
  });

  describe('decks', () => {
    it('creates a deck with its own id and saves it', async () => {
      const { repo } = setup();
      const deck = await repo.createDeck('  Zombie  Tribal ', T0);
      expect(deck).toMatchObject({ id: 'id-1', kind: 'deck', name: 'Zombie Tribal' });
      expect(await repo.get('id-1')).toEqual(deck);
    });

    it('lists decks newest first with the wishlist last', async () => {
      const { repo } = setup();
      await repo.ensureWishlist(new Date('2026-01-01T00:00:00Z'));
      await repo.createDeck('Old', new Date('2026-05-01T00:00:00Z'));
      await repo.createDeck('New', new Date('2026-09-01T00:00:00Z'));
      expect((await repo.all()).map(l => l.name)).toEqual(['New', 'Old', 'Wishlist']);
    });

    it('stops at 25 lists, counting the wishlist', async () => {
      const { repo } = setup();
      await repo.ensureWishlist(T0);
      for (let i = 0; i < MAX_LISTS - 1; i++) await repo.createDeck(`Deck ${i}`, T0);
      expect(await repo.all()).toHaveLength(MAX_LISTS);
      await expect(repo.createDeck('One too many', T0)).rejects.toBeInstanceOf(ListLimitError);
      expect(await repo.all()).toHaveLength(MAX_LISTS);
    });

    it('deletes a deck', async () => {
      const { repo } = setup();
      const deck = await repo.createDeck('Gone', T0);
      await repo.remove(deck.id);
      expect(await repo.get(deck.id)).toBeUndefined();
    });

    it('deleting a list that is not there is fine', async () => {
      await expect(setup().repo.remove('nope')).resolves.toBeUndefined();
    });

    it('frees a place when a deck is deleted', async () => {
      const { repo } = setup();
      await repo.ensureWishlist(T0);
      const decks = [];
      for (let i = 0; i < MAX_LISTS - 1; i++) decks.push(await repo.createDeck(`Deck ${i}`, T0));
      await repo.remove(decks[0].id);
      await expect(repo.createDeck('Fits again', T0)).resolves.toBeDefined();
    });
  });

  describe('duplicate', () => {
    it('saves a copy with its own id, off, with the same cards', async () => {
      const { repo } = setup();
      const deck = await repo.createDeck('Zombie Tribal', T0);
      await repo.save(addEntries(deck, [{ cardKey: 'a', name: 'Sol Ring', quantity: 2 }], T0).list);
      const copy = await repo.duplicate(deck.id, later(1));
      expect(copy).toMatchObject({ name: 'Zombie Tribal copy', inNextDive: false, kind: 'deck' });
      expect(copy!.id).not.toBe(deck.id);
      expect(copy!.entries).toHaveLength(1);
      expect(await repo.all()).toHaveLength(2);
    });

    it('does nothing for a list that is not there', async () => {
      expect(await setup().repo.duplicate('nope', T0)).toBeUndefined();
    });

    it('respects the 25 list limit', async () => {
      const { repo } = setup();
      await repo.ensureWishlist(T0);
      let last = await repo.createDeck('Deck 0', T0);
      for (let i = 1; i < MAX_LISTS - 1; i++) last = await repo.createDeck(`Deck ${i}`, T0);
      await expect(repo.duplicate(last.id, T0)).rejects.toBeInstanceOf(ListLimitError);
    });
  });

  describe('saving', () => {
    it('keeps changes across a fresh repository on the same storage, like closing and reopening the page', async () => {
      const { repo, storage } = setup();
      const deck = await repo.createDeck('Persistent', T0);
      await repo.save({ ...deck, name: 'Renamed', inNextDive: false });
      const reopened = new ListsRepository(storage);
      expect(await reopened.get(deck.id)).toMatchObject({ name: 'Renamed', inNextDive: false });
    });
  });

  describe('damaged data', () => {
    it('skips a record that is not a list instead of failing', async () => {
      const { repo, storage } = setup();
      await repo.createDeck('Good', T0);
      await storage.put('lists', 'junk', { hello: 'world' });
      await storage.put('lists', 'text', 'not even an object');
      await storage.put('lists', 'nothing', null);
      await storage.put('lists', 'bad-kind', { id: 'x', name: 'x', entries: [], kind: 'folder', createdAt: 'a', updatedAt: 'b' });
      expect((await repo.all()).map(l => l.name)).toEqual(['Good']);
      expect(await repo.get('junk')).toBeUndefined();
    });
  });
});
