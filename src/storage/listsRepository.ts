import { MAX_LISTS, WISHLIST_ID, canCreateList, createList, duplicateList, sortLists } from '../core/lists';
import type { GameId } from '../core/games';
import type { CardList } from '../core/lists';
import type { AppStorage } from './types';

export class ListLimitError extends Error {
  constructor() {
    super(`A player can have at most ${MAX_LISTS} lists.`);
    this.name = 'ListLimitError';
  }
}

export class WishlistProtectedError extends Error {
  constructor() {
    super('There is always one wishlist, so it cannot be deleted. Clear it instead.');
    this.name = 'WishlistProtectedError';
  }
}

// A saved list that is missing its basics (from an older version, or damaged) is skipped rather than crashing the page.
function isCardList(value: unknown): value is CardList {
  const v = value as Partial<CardList> | null;
  return typeof v === 'object' && v !== null
    && typeof v.id === 'string' && typeof v.name === 'string' && Array.isArray(v.entries)
    && (v.kind === 'deck' || v.kind === 'wishlist') && typeof v.createdAt === 'string' && typeof v.updatedAt === 'string';
}

// Lists on the device, kept in the 'lists' collection by id. Every method takes `now` where time matters.
export class ListsRepository {
  constructor(
    private readonly storage: AppStorage,
    private readonly makeId: () => string = () => crypto.randomUUID(),
  ) {}

  async all(): Promise<CardList[]> {
    return sortLists((await this.storage.list<unknown>('lists')).filter(isCardList));
  }

  async get(id: string): Promise<CardList | undefined> {
    const found = await this.storage.get<unknown>('lists', id);
    return isCardList(found) ? found : undefined;
  }

  async save(list: CardList): Promise<void> {
    await this.storage.put('lists', list.id, list);
  }

  // There is always exactly one wishlist. Call this when the app opens.
  async ensureWishlist(now: Date): Promise<CardList> {
    const existing = await this.get(WISHLIST_ID);
    if (existing) return existing;
    const wishlist = createList({ id: WISHLIST_ID, kind: 'wishlist', name: 'Wishlist' }, now);
    await this.save(wishlist);
    return wishlist;
  }

  async createDeck(name: string, now: Date, options: { sample?: boolean; banner?: string; game?: GameId } = {}): Promise<CardList> {
    if (!canCreateList((await this.all()).length)) throw new ListLimitError();
    const deck = { ...createList({ id: this.makeId(), kind: 'deck', name, game: options.game }, now), ...(options.sample ? { sample: true } : {}), ...(options.banner ? { banner: options.banner } : {}) };
    await this.save(deck);
    return deck;
  }

  async duplicate(id: string, now: Date): Promise<CardList | undefined> {
    const original = await this.get(id);
    if (!original) return undefined;
    if (!canCreateList((await this.all()).length)) throw new ListLimitError();
    const copy = duplicateList(original, this.makeId(), now);
    await this.save(copy);
    return copy;
  }

  async remove(id: string): Promise<void> {
    if (id === WISHLIST_ID) throw new WishlistProtectedError();
    await this.storage.delete('lists', id);
  }
}
