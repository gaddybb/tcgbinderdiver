import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { MAX_LISTS, WISHLIST_ID } from '../../core/lists';
import { ListsRepository, MemoryStorage } from '../../storage';
import { copy } from '../copy/en';
import { T0, daysAgo, makeList } from '../testkit';
import type { Spec } from '../testkit';

function setup(specs: Spec[] = [], options: { persistent?: boolean; path?: string } = {}) {
  const storage = new MemoryStorage();
  (storage as { persistent: boolean }).persistent = options.persistent ?? true;
  const ready = Promise.all(specs.map(spec => { const list = makeList(spec); return storage.put('lists', list.id, list); }));
  window.history.replaceState(null, '', options.path ?? '/lists');
  const view = render(<App storage={storage} clock={() => T0} />);
  const repo = new ListsRepository(storage);
  return { storage, repo, ready, ...view };
}

const setWidth = (width: number) => act(() => { window.innerWidth = width; window.dispatchEvent(new Event('resize')); });
const card = (title: string) => screen.getByRole('link', { name: title, hidden: false }).closest('li') as HTMLElement;
const openMenu = async (listName: string, item: string) => {
  fireEvent.click(await screen.findByRole('button', { name: copy.common.moreFor(listName) }));
  fireEvent.click(within(screen.getByRole('menu', { name: copy.common.moreFor(listName) })).getByRole('menuitem', { name: item }));
};
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

const TWO_DECKS_AND_WISHLIST: Spec[] = [
  { id: 'a', name: 'Lifegain Commander', created: daysAgo(10), updated: T0, cards: [['Sol Ring'], ['Soul Warden', 2], ['Ajani', 1, 'proxy']] },
  { id: 'b', name: 'Zombie Tribal', created: daysAgo(20), updated: daysAgo(3), cards: [['Sol Ring'], ['Diregraf Ghoul']], on: false },
  { id: WISHLIST_ID, kind: 'wishlist', name: 'Wishlist', created: daysAgo(40), updated: daysAgo(8), cards: [['Misty Rainforest'], ['Sol Ring']] },
];

beforeEach(() => window.history.replaceState(null, '', '/lists'));
afterEach(() => {
  setWidth(1024);
  window.history.replaceState(null, '', '/');
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
});

describe('My lists: first visit', () => {
  it('shows the empty state with a way to paste a list', async () => {
    setup();
    expect(await screen.findByRole('heading', { name: copy.myLists.empty.title })).toBeTruthy();
    expect(screen.getByText(copy.myLists.empty.text)).toBeTruthy();
    expect(screen.getByRole('button', { name: copy.myLists.empty.action })).toBeTruthy();
    expect(screen.queryByRole('region', { name: copy.summaryBar.label })).toBeNull();
  });

  it('has the page title and help line', async () => {
    setup();
    expect(await screen.findByRole('heading', { level: 1, name: copy.myLists.title })).toBeTruthy();
    expect(screen.getByText(copy.myLists.subtitle)).toBeTruthy();
  });

  it('quietly creates the one wishlist, but does not show it yet', async () => {
    const { repo } = setup();
    await screen.findByRole('heading', { name: copy.myLists.empty.title });
    await waitFor(async () => expect((await repo.all()).map(l => l.id)).toEqual([WISHLIST_ID]));
    expect(screen.queryByText('Wishlist')).toBeNull();
  });

  it('does not create a second wishlist when the page is opened again', async () => {
    const { repo, unmount, storage } = setup();
    await screen.findByRole('heading', { name: copy.myLists.empty.title });
    unmount();
    render(<App storage={storage} clock={() => T0} />);
    await screen.findByRole('heading', { name: copy.myLists.empty.title });
    expect(await repo.all()).toHaveLength(1);
  });

  it('shows a loading placeholder before the lists are in', () => {
    setup();
    expect(screen.getByRole('status', { name: copy.loading })).toBeTruthy();
  });
});

describe('My lists: pasting a list', () => {
  const open = async () => fireEvent.click(await screen.findByRole('button', { name: copy.myLists.pasteNew }));
  const add = () => fireEvent.click(screen.getByRole('button', { name: copy.pasteDialog.add }));

  it('opens a dialog from the page button and from the empty state', async () => {
    setup();
    fireEvent.click(await screen.findByRole('button', { name: copy.myLists.empty.action }));
    expect(screen.getByRole('dialog', { name: copy.pasteDialog.title })).toBeTruthy();
  });

  it('makes a deck from the pasted text, combining repeats and ignoring set codes and foil tags', async () => {
    const { repo } = setup();
    await open();
    type(copy.pasteDialog.nameLabel, 'Lifegain Commander');
    type(copy.pasteDialog.textLabel, '1 Sol Ring\n2x Arcane Signet (ELD) 331 *F*\n1 sol ring #ramp');
    add();

    const deckCard = await screen.findByRole('link', { name: 'Lifegain Commander' });
    expect(within(deckCard.closest('li') as HTMLElement).getByText('2 needed of 2 · Updated today')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();

    const [deck] = (await repo.all()).filter(l => l.kind === 'deck');
    expect(deck.entries.map(e => [e.name, e.quantity, e.status])).toEqual([['Sol Ring', 2, 'needed'], ['Arcane Signet', 2, 'needed']]);
    expect(deck.entries[0].tags).toEqual(['ramp']);
    expect(deck.inNextDive).toBe(true);
  });

  it('leaves out sideboard and maybeboard cards', async () => {
    const { repo } = setup();
    await open();
    type(copy.pasteDialog.nameLabel, 'Deck');
    type(copy.pasteDialog.textLabel, '1 Sol Ring\nSideboard\n1 Negate\nMaybeboard\n1 Mana Drain');
    add();
    await screen.findByRole('link', { name: 'Deck' });
    expect((await repo.all()).find(l => l.kind === 'deck')!.entries.map(e => e.name)).toEqual(['Sol Ring']);
  });

  it('asks for a name', async () => {
    const { repo } = setup();
    await open();
    type(copy.pasteDialog.textLabel, '1 Sol Ring');
    add();
    expect(screen.getByText(copy.pasteDialog.nameMissing)).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((await repo.all()).filter(l => l.kind === 'deck')).toEqual([]);
  });

  it('says when the box is empty', async () => {
    setup();
    await open();
    type(copy.pasteDialog.nameLabel, 'Deck');
    add();
    expect(screen.getByText(copy.pasteDialog.empty)).toBeTruthy();
  });

  it('says when it can not find a card name', async () => {
    const { repo } = setup();
    await open();
    type(copy.pasteDialog.nameLabel, 'Deck');
    type(copy.pasteDialog.textLabel, 'Commander\nDeck\nSideboard');
    add();
    expect(screen.getByText(copy.pasteDialog.noNames)).toBeTruthy();
    expect((await repo.all()).filter(l => l.kind === 'deck')).toEqual([]);
  });

  it('keeps the first 250 cards and says so', async () => {
    const { repo } = setup();
    await open();
    type(copy.pasteDialog.nameLabel, 'Big');
    type(copy.pasteDialog.textLabel, Array.from({ length: 300 }, (_, i) => `1 Card ${i}`).join('\n'));
    add();
    expect(await screen.findByText(copy.myLists.toast.keptFirst(250, 300))).toBeTruthy();
    expect((await repo.all()).find(l => l.kind === 'deck')!.entries).toHaveLength(250);
  });

  it('cancel closes it without adding anything, and the box is empty next time', async () => {
    const { repo } = setup();
    await open();
    type(copy.pasteDialog.nameLabel, 'Draft');
    type(copy.pasteDialog.textLabel, '1 Sol Ring');
    fireEvent.click(screen.getByRole('button', { name: copy.common.cancel }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((await repo.all()).filter(l => l.kind === 'deck')).toEqual([]);
    await open();
    expect((screen.getByLabelText(copy.pasteDialog.textLabel) as HTMLTextAreaElement).value).toBe('');
    expect((screen.getByLabelText(copy.pasteDialog.nameLabel) as HTMLInputElement).value).toBe('');
  });

  it('can add to the wishlist instead, which needs no name, and skips cards already on it', async () => {
    const { repo } = setup();
    await open();
    fireEvent.click(screen.getByLabelText(copy.pasteDialog.wishlist));
    expect(screen.queryByLabelText(copy.pasteDialog.nameLabel)).toBeNull();
    type(copy.pasteDialog.textLabel, '1 Sol Ring\n1 Mana Crypt');
    fireEvent.click(screen.getByRole('button', { name: copy.pasteDialog.addToWishlist }));
    const wishlistCard = (await screen.findByRole('link', { name: 'Wishlist' })).closest('li') as HTMLElement;
    expect(within(wishlistCard).getByText('2 cards · Updated today')).toBeTruthy();

    await open();
    fireEvent.click(screen.getByLabelText(copy.pasteDialog.wishlist));
    type(copy.pasteDialog.textLabel, '3 Sol Ring\n1 Mana Drain');
    fireEvent.click(screen.getByRole('button', { name: copy.pasteDialog.addToWishlist }));
    await waitFor(async () => expect((await repo.get(WISHLIST_ID))!.entries.map(e => [e.name, e.quantity])).toEqual([['Sol Ring', 1], ['Mana Crypt', 1], ['Mana Drain', 1]]));
  });
});

describe('My lists: the cards', () => {
  it('shows decks newest first and the wishlist last, with kind, summary and age', async () => {
    setup(TWO_DECKS_AND_WISHLIST);
    await screen.findByRole('link', { name: 'Lifegain Commander' });
    const titles = screen.getAllByRole('link').filter(a => /Lifegain|Zombie|^Wishlist$/.test(a.textContent ?? '') && !/^Open$/.test(a.textContent ?? '')).map(a => a.textContent);
    expect(titles).toEqual(['Lifegain Commander', 'Zombie Tribal', 'Wishlist']);

    expect(within(card('Lifegain Commander')).getByText('2 needed of 3 · Updated today')).toBeTruthy();
    expect(within(card('Zombie Tribal')).getByText('2 needed of 2 · Updated 3 days ago')).toBeTruthy();
    expect(within(card('Wishlist')).getByText('2 cards · Updated last week')).toBeTruthy();
    expect(within(card('Lifegain Commander')).getByText(copy.myLists.kind.deck)).toBeTruthy();
    expect(within(card('Wishlist')).getAllByText(copy.myLists.kind.wishlist)).toHaveLength(2);   // the kind label and the name
  });

  it('has an Open link for each list', async () => {
    setup(TWO_DECKS_AND_WISHLIST);
    await screen.findByRole('link', { name: 'Zombie Tribal' });
    expect(within(card('Zombie Tribal')).getByRole('link', { name: copy.listCard.open }).getAttribute('href')).toBe('/lists/b');
    expect(within(card('Wishlist')).getByRole('link', { name: copy.listCard.open }).getAttribute('href')).toBe(`/lists/${WISHLIST_ID}`);
  });

  it('shows the wishlist when it has cards, even with no decks', async () => {
    setup([{ id: WISHLIST_ID, kind: 'wishlist', name: 'Wishlist', cards: [['Sol Ring']] }]);
    expect(await screen.findByRole('link', { name: 'Wishlist' })).toBeTruthy();
    expect(screen.queryByText(copy.myLists.empty.title)).toBeNull();
  });
});

describe('My lists: the next dive', () => {
  it('counts the lists that are on and the different cards they still need', async () => {
    setup(TWO_DECKS_AND_WISHLIST);
    // Lifegain (Sol Ring, Soul Warden) + Wishlist (Misty Rainforest, Sol Ring): 3 different cards. Zombie Tribal is off.
    expect(await screen.findByText(copy.myLists.next(2, 3))).toBeTruthy();
    expect(screen.getByText('Lifegain Commander and Wishlist')).toBeTruthy();
  });

  it('follows the switches, and saves them', async () => {
    const { repo } = setup(TWO_DECKS_AND_WISHLIST);
    await screen.findByText(copy.myLists.next(2, 3));
    fireEvent.click(screen.getByRole('switch', { name: copy.listCard.includeInNext('Zombie Tribal') }));
    expect(await screen.findByText(copy.myLists.next(3, 4))).toBeTruthy();
    await waitFor(async () => expect((await repo.get('b'))!.inNextDive).toBe(true));
    fireEvent.click(screen.getByRole('switch', { name: copy.listCard.includeInNext('Lifegain Commander') }));
    await waitFor(() => expect(screen.queryByText(copy.myLists.next(3, 4))).toBeNull());
    expect(screen.getByText(copy.myLists.next(2, 3))).toBeTruthy();   // Zombie Tribal and Wishlist: Sol Ring, Diregraf Ghoul, Misty Rainforest
  });

  it('does not count a switch as an edit', async () => {
    const { repo } = setup(TWO_DECKS_AND_WISHLIST);
    await screen.findByText(copy.myLists.next(2, 3));
    const before = (await repo.get('b'))!.updatedAt;
    fireEvent.click(screen.getByRole('switch', { name: copy.listCard.includeInNext('Zombie Tribal') }));
    await waitFor(async () => expect((await repo.get('b'))!.inNextDive).toBe(true));
    expect((await repo.get('b'))!.updatedAt).toBe(before);
  });

  it('says so when nothing is turned on', async () => {
    setup(TWO_DECKS_AND_WISHLIST.map(s => ({ ...s, on: false })));
    expect(await screen.findByText(copy.myLists.nextNone)).toBeTruthy();
  });

  it('keeps Start store dive off until the store dive exists', async () => {
    setup(TWO_DECKS_AND_WISHLIST);
    expect((await screen.findByRole('button', { name: copy.myLists.startDive }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('My lists: renaming on the card', () => {
  it('turns the title into a field, and Enter keeps the new name', async () => {
    const { repo } = setup(TWO_DECKS_AND_WISHLIST);
    await openMenu('Zombie Tribal', copy.myLists.menu.rename);
    const field = screen.getByLabelText(copy.listCard.nameLabel) as HTMLInputElement;
    expect(field.value).toBe('Zombie Tribal');
    fireEvent.change(field, { target: { value: '  Undead   Army ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(await screen.findByRole('link', { name: 'Undead Army' })).toBeTruthy();
    expect(screen.queryByLabelText(copy.listCard.nameLabel)).toBeNull();
    expect((await repo.get('b'))!.name).toBe('Undead Army');
    expect((await repo.get('b'))!.updatedAt).toBe(T0.toISOString());
  });

  it('Save works too', async () => {
    setup(TWO_DECKS_AND_WISHLIST);
    await openMenu('Zombie Tribal', copy.myLists.menu.rename);
    type(copy.listCard.nameLabel, 'Zombies');
    fireEvent.click(screen.getByRole('button', { name: copy.common.save }));
    expect(await screen.findByRole('link', { name: 'Zombies' })).toBeTruthy();
  });

  it('Escape and Cancel leave the name alone', async () => {
    const { repo } = setup(TWO_DECKS_AND_WISHLIST);
    await openMenu('Zombie Tribal', copy.myLists.menu.rename);
    type(copy.listCard.nameLabel, 'Changed my mind');
    fireEvent.keyDown(screen.getByLabelText(copy.listCard.nameLabel), { key: 'Escape' });
    expect(await screen.findByRole('link', { name: 'Zombie Tribal' })).toBeTruthy();
    await openMenu('Zombie Tribal', copy.myLists.menu.rename);
    fireEvent.click(screen.getByRole('button', { name: copy.common.cancel }));
    expect(screen.getByRole('link', { name: 'Zombie Tribal' })).toBeTruthy();
    expect((await repo.get('b'))!.name).toBe('Zombie Tribal');
  });

  it('will not save an empty name, and says why', async () => {
    const { repo } = setup(TWO_DECKS_AND_WISHLIST);
    await openMenu('Zombie Tribal', copy.myLists.menu.rename);
    type(copy.listCard.nameLabel, '   ');
    fireEvent.keyDown(screen.getByLabelText(copy.listCard.nameLabel), { key: 'Enter' });
    expect(screen.getByText(copy.pasteDialog.nameMissing)).toBeTruthy();
    expect(screen.getByLabelText(copy.listCard.nameLabel)).toBeTruthy();
    expect((await repo.get('b'))!.name).toBe('Zombie Tribal');
  });

  it('only the list being renamed changes', async () => {
    setup(TWO_DECKS_AND_WISHLIST);
    await openMenu('Zombie Tribal', copy.myLists.menu.rename);
    expect(screen.getAllByLabelText(copy.listCard.nameLabel)).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Lifegain Commander' })).toBeTruthy();
  });

  it('the wishlist can be renamed too', async () => {
    setup(TWO_DECKS_AND_WISHLIST);
    await openMenu('Wishlist', copy.myLists.menu.rename);
    type(copy.listCard.nameLabel, 'Someday');
    fireEvent.keyDown(screen.getByLabelText(copy.listCard.nameLabel), { key: 'Enter' });
    expect(await screen.findByRole('link', { name: 'Someday' })).toBeTruthy();
  });
});

describe('My lists: duplicate', () => {
  it('makes "<name> copy", switched off, and says so', async () => {
    const { repo } = setup(TWO_DECKS_AND_WISHLIST);
    await openMenu('Zombie Tribal', copy.myLists.menu.duplicate);
    expect(await screen.findByText(copy.myLists.toast.duplicated('Zombie Tribal copy'))).toBeTruthy();
    expect(await screen.findByRole('link', { name: 'Zombie Tribal copy' })).toBeTruthy();
    const copyList = (await repo.all()).find(l => l.name === 'Zombie Tribal copy')!;
    expect(copyList.inNextDive).toBe(false);
    expect(copyList.entries.map(e => e.name)).toEqual(['Sol Ring', 'Diregraf Ghoul']);
    expect(copyList.id).not.toBe('b');
  });

  it('is blocked at 25 lists, with a message on the page', async () => {
    const specs: Spec[] = [{ id: WISHLIST_ID, kind: 'wishlist', name: 'Wishlist', created: daysAgo(100), cards: [['Sol Ring']] }];
    for (let i = 0; i < MAX_LISTS - 1; i++) specs.push({ id: `d${i}`, name: `Deck ${i}`, created: daysAgo(i + 1), cards: [['Sol Ring']] });
    const { repo } = setup(specs);
    await openMenu('Deck 0', copy.myLists.menu.duplicate);
    expect(await screen.findByText(copy.myLists.limitReached.title)).toBeTruthy();
    expect(await repo.all()).toHaveLength(MAX_LISTS);
  });
});

describe('My lists: copy as text', () => {
  it('puts the whole list on the clipboard and says so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setup(TWO_DECKS_AND_WISHLIST);
    await openMenu('Lifegain Commander', copy.myLists.menu.copyAsText);
    expect(await screen.findByText(copy.myLists.toast.copied)).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith('1 Sol Ring\n2 Soul Warden\n1 Ajani');
  });

  it('says so when the browser will not let it', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true });
    setup(TWO_DECKS_AND_WISHLIST);
    await openMenu('Lifegain Commander', copy.myLists.menu.copyAsText);
    expect(await screen.findByText(copy.myLists.toast.copyFailed)).toBeTruthy();
  });

  it('says so when there is no clipboard at all', async () => {
    setup(TWO_DECKS_AND_WISHLIST);
    await openMenu('Lifegain Commander', copy.myLists.menu.copyAsText);
    expect(await screen.findByText(copy.myLists.toast.copyFailed)).toBeTruthy();
  });
});

describe('My lists: delete and clear', () => {
  it('asks first, in words that say it can not be undone, and Keep it keeps the list', async () => {
    const { repo } = setup(TWO_DECKS_AND_WISHLIST);
    await openMenu('Zombie Tribal', copy.myLists.menu.delete);
    const dialog = screen.getByRole('dialog', { name: copy.myLists.deleteDialog.title('Zombie Tribal') });
    expect(dialog.textContent).toContain(copy.myLists.deleteDialog.body(2));
    expect(dialog.textContent).toContain(copy.myLists.deleteDialog.tip);
    fireEvent.click(within(dialog).getByRole('button', { name: copy.myLists.deleteDialog.keep }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('link', { name: 'Zombie Tribal' })).toBeTruthy();
    expect(await repo.get('b')).toBeDefined();
  });

  it('Delete list removes it from the page and from storage', async () => {
    const { repo } = setup(TWO_DECKS_AND_WISHLIST);
    await openMenu('Zombie Tribal', copy.myLists.menu.delete);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: copy.myLists.deleteDialog.confirm }));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Zombie Tribal' })).toBeNull());
    expect(await repo.get('b')).toBeUndefined();
    expect(screen.getByRole('link', { name: 'Lifegain Commander' })).toBeTruthy();
  });

  it('the wishlist offers Clear wishlist, never Delete', async () => {
    setup(TWO_DECKS_AND_WISHLIST);
    fireEvent.click(await screen.findByRole('button', { name: copy.common.moreFor('Wishlist') }));
    const menu = screen.getByRole('menu', { name: copy.common.moreFor('Wishlist') });
    expect(within(menu).getByRole('menuitem', { name: copy.myLists.menu.clearWishlist })).toBeTruthy();
    expect(within(menu).queryByRole('menuitem', { name: copy.myLists.menu.delete })).toBeNull();
  });

  it('Clear wishlist asks first, then empties it and keeps the list', async () => {
    const { repo } = setup(TWO_DECKS_AND_WISHLIST);
    await openMenu('Wishlist', copy.myLists.menu.clearWishlist);
    const dialog = screen.getByRole('dialog', { name: copy.myLists.clearDialog.title });
    expect(dialog.textContent).toContain(copy.myLists.clearDialog.body(2));
    fireEvent.click(within(dialog).getByRole('button', { name: copy.myLists.clearDialog.confirm }));
    await waitFor(async () => expect((await repo.get(WISHLIST_ID))!.entries).toEqual([]));
    expect(within(card('Wishlist')).getByText('0 cards · Updated today')).toBeTruthy();
  });

  it('Keep it leaves the wishlist as it was', async () => {
    const { repo } = setup(TWO_DECKS_AND_WISHLIST);
    await openMenu('Wishlist', copy.myLists.menu.clearWishlist);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: copy.myLists.clearDialog.keep }));
    expect((await repo.get(WISHLIST_ID))!.entries).toHaveLength(2);
  });

  it('deleting a list makes room again after the 25 list message', async () => {
    const specs: Spec[] = [{ id: WISHLIST_ID, kind: 'wishlist', name: 'Wishlist', created: daysAgo(100), cards: [['Sol Ring']] }];
    for (let i = 0; i < MAX_LISTS - 1; i++) specs.push({ id: `d${i}`, name: `Deck ${i}`, created: daysAgo(i + 1), cards: [['Sol Ring']] });
    setup(specs);
    await openMenu('Deck 0', copy.myLists.menu.duplicate);
    await screen.findByText(copy.myLists.limitReached.title);
    await openMenu('Deck 1', copy.myLists.menu.delete);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: copy.myLists.deleteDialog.confirm }));
    await waitFor(() => expect(screen.queryByText(copy.myLists.limitReached.title)).toBeNull());
  });
});

describe('My lists: a phone', () => {
  it('says + New, has the short help line and puts the next dive bar below the cards', async () => {
    setWidth(375);
    setup(TWO_DECKS_AND_WISHLIST);
    const add = await screen.findByRole('button', { name: copy.myLists.pasteNewPhone });
    expect(add).toBeTruthy();
    expect(screen.getByText(copy.myLists.subtitlePhone)).toBeTruthy();
    expect(screen.queryByText(copy.myLists.subtitle)).toBeNull();
    const bar = screen.getByRole('region', { name: copy.summaryBar.label });
    const list = screen.getAllByRole('list').find(l => l.querySelector('li [role="switch"]'))!;
    expect(list.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('Lifegain Commander and Wishlist')).toBeNull();   // the names are left to the cards
  });

  it('a desktop puts the bar above the cards, with the list names', async () => {
    setup(TWO_DECKS_AND_WISHLIST);
    const bar = await screen.findByRole('region', { name: copy.summaryBar.label });
    const list = screen.getAllByRole('list').find(l => l.querySelector('li [role="switch"]'))!;
    expect(bar.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(bar).getByText('Lifegain Commander and Wishlist')).toBeTruthy();
  });

  it('opens the list menu as a bottom sheet with a line about each choice', async () => {
    setWidth(375);
    setup(TWO_DECKS_AND_WISHLIST);
    fireEvent.click(await screen.findByRole('button', { name: copy.common.moreFor('Zombie Tribal') }));
    const sheet = screen.getByRole('dialog', { name: 'Zombie Tribal' });
    expect(within(sheet).getByText(copy.myLists.menu.duplicateHint('Zombie Tribal'))).toBeTruthy();
    expect(within(sheet).getByText(copy.myLists.menu.copyAsTextHint)).toBeTruthy();
    expect(within(sheet).getByText(copy.myLists.menu.confirmHint)).toBeTruthy();
    expect(within(sheet).getByRole('button', { name: copy.common.cancel })).toBeTruthy();
  });

  it('choosing Rename from the sheet starts renaming on the card', async () => {
    setWidth(375);
    setup(TWO_DECKS_AND_WISHLIST);
    fireEvent.click(await screen.findByRole('button', { name: copy.common.moreFor('Zombie Tribal') }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('menuitem', { name: new RegExp(copy.myLists.menu.rename) }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((screen.getByLabelText(copy.listCard.nameLabel) as HTMLInputElement).value).toBe('Zombie Tribal');
  });
});

describe('My lists: saving on this device', () => {
  it('warns when the browser will not keep the lists', async () => {
    setup(TWO_DECKS_AND_WISHLIST, { persistent: false });
    expect(await screen.findByText(copy.storage.notSavedTitle)).toBeTruthy();
    expect(screen.getByText(copy.storage.notSavedDetail)).toBeTruthy();
  });

  it('says nothing when it will', async () => {
    setup(TWO_DECKS_AND_WISHLIST, { persistent: true });
    await screen.findByRole('link', { name: 'Zombie Tribal' });
    expect(screen.queryByText(copy.storage.notSavedTitle)).toBeNull();
  });

  it('still shows the lists that were already saved, as if the page had been reopened', async () => {
    const first = setup([{ id: 'a', name: 'Kept', cards: [['Sol Ring']] }]);
    await screen.findByRole('link', { name: 'Kept' });
    first.unmount();
    render(<App storage={first.storage} clock={() => T0} />);
    expect(await screen.findByRole('link', { name: 'Kept' })).toBeTruthy();
  });
});
