import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { fakeConnector, fakeSummary } from '../../connectors/fakeConnector';
import type { FakeCard } from '../../connectors/fakeConnector';
import { pr } from '../../core/engine/fixtures';
import { MemoryStorage } from '../../storage';
import { CardsRepository, ListsRepository } from '../../storage';
import { copy } from '../copy/en';
import { T0, makeList } from '../testkit';
import type { Spec } from '../testkit';

// ---- a few cards and where the routing engine should send them ----
const fdn = (n: string, usd: string) => pr({ setCode: 'fdn', setName: 'Foundations', setType: 'core', releasedAt: '2026-06-01', collectorNumber: n, usd });
const CARDS: Record<string, FakeCard> = {
  ajani: { name: "Ajani's Pridemate", colors: ['W'], typeLine: 'Creature', printings: [fdn('135', '0.25')] },
  warden: { name: 'Soul Warden', colors: ['W'], typeLine: 'Creature', printings: [fdn('24', '0.30')] },
  tower: { name: 'Command Tower', typeLine: 'Land', printings: [pr({ setCode: 'fdc', setName: 'Foundations Commander', setType: 'commander', collectorNumber: '352', usd: '0.35' })] },
  greaves: { name: 'Lightning Greaves', printings: [pr({ setCode: 'rna', setName: 'Ravnica Allegiance', releasedAt: '2019-01-25', rarity: 'rare', collectorNumber: '9', usd: '18.50' })] },
  forest: { name: 'Forest', typeLine: 'Basic Land — Forest', printings: [fdn('280', '0.10')] },
  online: { name: 'Online Only', printings: [pr({ setCode: 'ymid', digital: true, games: ['arena'], usd: '1.00' })] },
  elves: { name: 'Llanowar Elves', colors: ['G'], typeLine: 'Creature', printings: [fdn('227', '0.30')] },
};

const spec = (cards: Spec['cards'], over: Partial<Spec> = {}): Spec => ({ id: 'a', name: 'Lifegain Commander', created: T0, cards, ...over });

interface Options { saved?: (keyof typeof CARDS)[]; fetchedAt?: Date; hold?: boolean; failLookup?: boolean; path?: string; lists?: Spec[] }

async function setup(cards: Spec['cards'], options: Options = {}) {
  const storage = new MemoryStorage();
  (storage as { persistent: boolean }).persistent = true;
  const lists = options.lists ?? [spec(cards)];
  for (const s of lists) { const list = makeList(s); await storage.put('lists', list.id, list); }
  const repo = new CardsRepository(storage);
  for (const key of options.saved ?? []) {
    const card = CARDS[key];
    await repo.put({ key: card.name.toLowerCase(), summary: fakeSummary(card), printings: card.printings ?? [], fetchedAt: (options.fetchedAt ?? T0).toISOString() });
  }
  const fake = fakeConnector(Object.values(CARDS), { failLookup: options.failLookup });
  if (options.hold) fake.hold();
  window.history.replaceState(null, '', options.path ?? '/lists/a');
  const view = render(<App storage={storage} clock={() => T0} connector={fake.connector} />);
  return { storage, lists: new ListsRepository(storage), repo, fake, ...view };
}

const setWidth = (width: number) => act(() => { window.innerWidth = width; window.dispatchEvent(new Event('resize')); });
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const tableRow = (name: string) => screen.getByRole('rowheader', { name: new RegExp('^' + escapeRe(name)) }).closest('tr') as HTMLElement;
const text = (el: HTMLElement) => el.textContent ?? '';
// Rows appear before their card data does, so wait for a value that only data can put there.
const dataArrived = (card: string, expected: string) => waitFor(() => expect(text(tableRow(card))).toContain(expected));
const names = () => screen.getAllByRole('rowheader').map(h => (h.textContent ?? '').replace(/×\d+$/, ''));

const THREE: Spec['cards'] = [["Ajani's Pridemate"], ['Command Tower'], ['Lightning Greaves']];

beforeEach(() => window.history.replaceState(null, '', '/lists/a'));
afterEach(() => {
  setWidth(1024);
  window.history.replaceState(null, '', '/');
});

describe('List review: card data', () => {
  it('shows cards from saved data straight away, without asking Scryfall again', async () => {
    const { fake } = await setup(THREE, { saved: ['ajani', 'tower', 'greaves'] });
    expect(await screen.findByRole('rowheader', { name: "Ajani's Pridemate" })).toBeTruthy();
    await waitFor(() => expect(text(tableRow("Ajani's Pridemate"))).toContain('FDN 135'));
    expect(screen.queryByText(/looked up/)).toBeNull();
    expect(fake.calls.lookups).toEqual([]);
  });

  it('while fetching, says how far it has got, and shows the names already', async () => {
    const { fake } = await setup(THREE, { hold: true });
    expect(await screen.findByText(copy.review.loading.title('Lifegain Commander'))).toBeTruthy();
    expect(screen.getByText(copy.review.loading.detail(0, 3))).toBeTruthy();
    expect(screen.getByRole('rowheader', { name: "Ajani's Pridemate" })).toBeTruthy();
    expect(text(tableRow("Ajani's Pridemate"))).toContain(copy.review.target.none);
    act(() => fake.release());
    await waitFor(() => expect(screen.queryByText(copy.review.loading.title('Lifegain Commander'))).toBeNull());
    expect(text(tableRow("Ajani's Pridemate"))).toContain('Foundations');
  });

  it('fetches only the cards that are missing', async () => {
    const { fake } = await setup(THREE, { saved: ['ajani'] });
    await waitFor(() => expect(fake.calls.lookups).toHaveLength(1));
    expect(fake.calls.lookups[0]).toEqual(['Command Tower', 'Lightning Greaves']);
  });

  it('saves what it fetched, so the next visit needs nothing', async () => {
    const { repo } = await setup(THREE);
    await waitFor(async () => expect((await repo.getMany(['ajani\'s pridemate', 'command tower', 'lightning greaves'])).size).toBe(3));
  });

  it('fetches again when the saved data is a week old', async () => {
    const { fake } = await setup(THREE, { saved: ['ajani'], fetchedAt: new Date(T0.getTime() - 8 * 24 * 3600 * 1000) });
    await waitFor(() => expect(fake.calls.lookups).toHaveLength(1));
    expect(fake.calls.lookups[0]).toContain("Ajani's Pridemate");
  });
});

describe('List review: the table', () => {
  it('has a column for each thing the design lists', async () => {
    await setup(THREE, { saved: ['ajani', 'tower', 'greaves'] });
    await screen.findByRole('table', { name: copy.review.tableLabel('Lifegain Commander') });
    const heads = screen.getAllByRole('columnheader').map(h => h.textContent);
    expect(heads).toEqual(Object.values(copy.review.columns));
  });

  it('sends each card to the binder the engine picks, with the printing found there and a price', async () => {
    await setup([...THREE!, ['Lightning Greaves']], { saved: ['ajani', 'tower', 'greaves'] });
    await screen.findByRole('table');
    await waitFor(() => expect(text(tableRow('Lightning Greaves'))).toContain('Display case'));
    const ajani = text(tableRow("Ajani's Pridemate"));
    expect(ajani).toContain('Foundations');
    expect(ajani).toContain('FDN 135');
    expect(ajani).toContain('$0.25');
    const tower = text(tableRow('Command Tower'));
    expect(tower).toContain('Commander box');
    expect(tower).toContain('FDC 352');
    expect(tower).toContain('$0.35');
    const greaves = text(tableRow('Lightning Greaves'));
    expect(greaves).toContain('RNA 9');
    expect(greaves).toContain('$18.50');
  });

  it('says "No binder" for a card with no paper printing, and "Basic land" for a basic', async () => {
    await setup([['Online Only'], ['Forest']], { saved: ['online', 'forest'] });
    await screen.findByRole('table');
    await dataArrived('Online Only', copy.review.target.noBinder);
    expect(text(tableRow('Online Only'))).toContain(copy.review.target.noBinder);
    expect(text(tableRow('Forest'))).toContain(copy.review.target.basicLand);
  });

  it('shows a dash for a price it does not have', async () => {
    await setup([['Online Only']], { saved: ['online'] });
    await screen.findByRole('table');
    expect(text(tableRow('Online Only'))).toContain('—');
  });

  it('shows the quantity beside the name', async () => {
    await setup([["Ajani's Pridemate", 3], ['Soul Warden']], { saved: ['ajani', 'warden'] });
    await screen.findByRole('table');
    expect(text(tableRow("Ajani's Pridemate"))).toContain('×3');
    expect(text(tableRow('Soul Warden'))).not.toContain('×');
  });

  it('shows the card picture as given, as decoration, when there is one', async () => {
    const { container } = await setup([["Ajani's Pridemate"]], { saved: ['ajani'] });
    await screen.findByRole('table');
    await waitFor(() => expect(container.querySelector('table img')).not.toBeNull());
    const img = container.querySelector('table img')!;
    expect(img.getAttribute('src')).toBe(fakeSummary(CARDS.ajani).imageSmall);
    expect(img.getAttribute('alt')).toBe('');
  });

  it('leaves out the picture when the card has none', async () => {
    const { container } = await setup([['Greaves']], { lists: [spec([['Greaves']])], saved: [] });
    await screen.findByRole('table');
    expect(container.querySelector('table img')).toBeNull();
  });

  it('a card that is not needed has no binder to look in', async () => {
    await setup([["Ajani's Pridemate", 1, 'in_collection'], ['Soul Warden']], { saved: ['ajani', 'warden'] });
    await screen.findByRole('table');
    await dataArrived('Soul Warden', 'FDN 24');
    const owned = text(tableRow("Ajani's Pridemate"));
    expect(owned).not.toContain('FDN');
    expect(owned).toContain(copy.status.in_collection);
    expect(text(tableRow('Soul Warden'))).toContain('FDN 24');
  });
});

describe('List review: the header', () => {
  it('says how many cards, how many are still needed, and about what they cost online', async () => {
    // Needed: Ajani x2 ($0.25) and Soul Warden ($0.30) = $0.80; not needed: Command Tower
    await setup([["Ajani's Pridemate", 2], ['Soul Warden'], ['Command Tower', 1, 'proxy']], { saved: ['ajani', 'warden', 'tower'] });
    expect(await screen.findByText(copy.review.summary(3, 2, '$1'))).toBeTruthy();
  });

  it('rounds the online total to whole dollars', async () => {
    await setup([['Lightning Greaves'], ["Ajani's Pridemate", 2]], { saved: ['greaves', 'ajani'] });
    expect(await screen.findByText(copy.review.summary(2, 2, '$19'))).toBeTruthy();   // 18.50 + 2 x 0.25 = 19.00
  });

  it('leaves out the price part until it knows a price', async () => {
    await setup([['Online Only']], { saved: ['online'] });
    expect(await screen.findByText(copy.review.summary(1, 1, null))).toBeTruthy();
  });

  it('is the short form on a phone', async () => {
    setWidth(375);
    await setup([["Ajani's Pridemate", 2], ['Soul Warden']], { saved: ['ajani', 'warden'] });
    expect(await screen.findByText(copy.review.summaryPhone(2, '$1'))).toBeTruthy();
  });

  it('names the list and links back to My lists', async () => {
    await setup(THREE, { saved: ['ajani', 'tower', 'greaves'] });
    expect(await screen.findByRole('heading', { level: 1, name: 'Lifegain Commander' })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: copy.listView.back }));
    expect(await screen.findByRole('heading', { level: 1, name: copy.myLists.title })).toBeTruthy();
  });
});

describe('List review: trouble reaching Scryfall', () => {
  it('says so, offers Try again, and fills in once it works', async () => {
    const { fake } = await setup(THREE, { failLookup: true });
    expect(await screen.findByText(copy.review.error.title)).toBeTruthy();
    expect(screen.getByText(copy.review.error.detail)).toBeTruthy();
    expect(text(tableRow("Ajani's Pridemate"))).toContain(copy.review.target.none);

    fake.state.failLookup = false;
    fireEvent.click(screen.getByRole('button', { name: copy.review.error.retry }));
    await waitFor(() => expect(screen.queryByText(copy.review.error.title)).toBeNull());
    expect(text(tableRow("Ajani's Pridemate"))).toContain('FDN 135');
  });

  it('still shows what was saved before', async () => {
    await setup(THREE, { saved: ['ajani'], fetchedAt: new Date(T0.getTime() - 30 * 24 * 3600 * 1000), failLookup: true });
    expect(await screen.findByText(copy.review.error.title)).toBeTruthy();
    await dataArrived("Ajani's Pridemate", 'FDN 135');
  });

  it('lists the names Scryfall does not know, and marks their rows', async () => {
    await setup([["Ajani's Pridemate"], ['Sol Rnig']], { saved: ['ajani'] });
    expect(await screen.findByText(copy.review.notFoundBanner.title(1))).toBeTruthy();
    expect(screen.getByText(copy.review.notFoundBanner.detail('Sol Rnig'))).toBeTruthy();
    expect(text(tableRow('Sol Rnig'))).toContain(copy.review.target.notFound);
    await dataArrived("Ajani's Pridemate", 'FDN 135');
  });
});

describe('List review: changing a status', () => {
  const openPicker = async (card: string) => fireEvent.click(await screen.findByRole('button', { name: new RegExp('^Status of ' + escapeRe(card) + ':') }));
  const choose = (status: string) => fireEvent.click(screen.getByRole('menuitemradio', { name: new RegExp('^' + status) }));

  it('shows each card\'s status on a button that says whose it is', async () => {
    await setup([["Ajani's Pridemate"], ['Soul Warden', 1, 'proxy']], { saved: ['ajani', 'warden'] });
    expect(await screen.findByRole('button', { name: "Status of Ajani's Pridemate: Needed" })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Status of Soul Warden: Proxy' })).toBeTruthy();
  });

  it('offers the five statuses with a line about each, and marks the current one', async () => {
    await setup([["Ajani's Pridemate"]], { saved: ['ajani'] });
    await openPicker("Ajani's Pridemate");
    const menu = screen.getByRole('menu');
    const options = within(menu).getAllByRole('menuitemradio');
    expect(options.map(o => o.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false', 'false', 'false']);
    for (const hint of Object.values(copy.statusHint)) expect(within(menu).getByText(hint)).toBeTruthy();
  });

  it('changes the status, updates the counts and the saved list, and says so with an Undo', async () => {
    const { lists } = await setup([["Ajani's Pridemate"], ['Soul Warden']], { saved: ['ajani', 'warden'] });
    await screen.findByText(copy.review.summary(2, 2, '$1'));
    await openPicker("Ajani's Pridemate");
    choose('In collection');
    expect(await screen.findByText(copy.statusPicker.changed("Ajani's Pridemate", 'In collection'))).toBeTruthy();
    expect(await screen.findByText(copy.review.summary(2, 1, '$0'.replace('$0', '$0')))).toBeTruthy();
    await waitFor(async () => expect((await lists.get('a'))!.entries[0].status).toBe('in_collection'));
    await waitFor(() => expect(text(tableRow("Ajani's Pridemate"))).not.toContain('FDN 135'));
  });

  it('Undo puts it back', async () => {
    const { lists } = await setup([["Ajani's Pridemate"]], { saved: ['ajani'] });
    await openPicker("Ajani's Pridemate");
    choose('Ordered');
    await screen.findByText(copy.statusPicker.changed("Ajani's Pridemate", 'Ordered'));
    fireEvent.click(screen.getByRole('button', { name: copy.common.undo }));
    await waitFor(async () => expect((await lists.get('a'))!.entries[0].status).toBe('needed'));
    expect(screen.getByRole('button', { name: "Status of Ajani's Pridemate: Needed" })).toBeTruthy();
  });

  it('choosing the status it already has changes nothing', async () => {
    const { lists } = await setup([["Ajani's Pridemate"]], { saved: ['ajani'] });
    await openPicker("Ajani's Pridemate");
    choose('Needed');
    expect(screen.queryByText(copy.statusPicker.changed("Ajani's Pridemate", 'Needed'))).toBeNull();
    expect((await lists.get('a'))!.updatedAt).toBe(T0.toISOString());
  });

  it('marks the list as updated', async () => {
    const { lists } = await setup([["Ajani's Pridemate"]], { saved: ['ajani'], lists: [spec([["Ajani's Pridemate"]], { updated: new Date(T0.getTime() - 5 * 24 * 3600 * 1000) })] });
    await openPicker("Ajani's Pridemate");
    choose('Proxy');
    await waitFor(async () => expect((await lists.get('a'))!.updatedAt).toBe(T0.toISOString()));
  });
});

describe('List review: sort and search', () => {
  const FOUR: Spec['cards'] = [['Soul Warden'], ["Ajani's Pridemate"], ['Command Tower'], ['Lightning Greaves']];
  const saved: Options['saved'] = ['ajani', 'warden', 'tower', 'greaves'];

  it('starts alphabetical', async () => {
    await setup(FOUR, { saved });
    await screen.findByRole('table');
    expect(names()).toEqual(["Ajani's Pridemate", 'Command Tower', 'Lightning Greaves', 'Soul Warden']);
  });

  it('offers the four sorts from the design', async () => {
    await setup(FOUR, { saved });
    const select = await screen.findByLabelText(copy.review.sort.label);
    expect([...select.querySelectorAll('option')].map(o => o.textContent)).toEqual(['Alphabetical', 'Price, high to low', 'Collector number', 'Color']);
  });

  it('sorts by price, dearest first', async () => {
    await setup(FOUR, { saved });
    await screen.findByRole('table');
    await dataArrived('Lightning Greaves', '$18.50');
    await dataArrived('Soul Warden', '$0.30');
    fireEvent.change(await screen.findByLabelText(copy.review.sort.label), { target: { value: 'price_desc' } });
    expect(names()).toEqual(['Lightning Greaves', 'Command Tower', 'Soul Warden', "Ajani's Pridemate"]);
  });

  it('sorts by collector number, as numbers', async () => {
    await setup(FOUR, { saved });
    await screen.findByRole('table');
    await dataArrived('Command Tower', 'FDC 352');
    await dataArrived('Lightning Greaves', 'RNA 9');
    await dataArrived('Soul Warden', 'FDN 24');
    await dataArrived("Ajani's Pridemate", 'FDN 135');
    fireEvent.change(await screen.findByLabelText(copy.review.sort.label), { target: { value: 'collector_number' } });
    // FDN 24, FDN 135, FDC 352, RNA 9 as plain numbers: 9, 24, 135, 352
    expect(names()).toEqual(['Lightning Greaves', 'Soul Warden', "Ajani's Pridemate", 'Command Tower']);
  });

  it('sorts by color in store order: white, then colorless, then land', async () => {
    await setup(FOUR, { saved });
    await screen.findByRole('table');
    await dataArrived('Command Tower', 'FDC 352');
    await dataArrived('Lightning Greaves', 'RNA 9');
    await dataArrived('Soul Warden', 'FDN 24');
    await dataArrived("Ajani's Pridemate", 'FDN 135');
    fireEvent.change(await screen.findByLabelText(copy.review.sort.label), { target: { value: 'color' } });
    expect(names()).toEqual(['Soul Warden', "Ajani's Pridemate", 'Lightning Greaves', 'Command Tower']);
  });

  it('searches by name, ignoring case and accents', async () => {
    await setup(FOUR, { saved });
    fireEvent.change(await screen.findByLabelText(copy.review.search.label), { target: { value: 'tOWER' } });
    expect(names()).toEqual(['Command Tower']);
    fireEvent.change(screen.getByLabelText(copy.review.search.label), { target: { value: 'ajání' } });
    expect(names()).toEqual(["Ajani's Pridemate"]);
  });

  it('says so when nothing matches, and shows everything again when the search is cleared', async () => {
    await setup(FOUR, { saved });
    const search = await screen.findByLabelText(copy.review.search.label);
    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(screen.getByText(copy.review.noMatches)).toBeTruthy();
    fireEvent.change(search, { target: { value: '' } });
    expect(names()).toHaveLength(4);
  });
});

describe('List review: a phone', () => {
  it('shows rows instead of a table, with the binder and printing under the name and the price beside it', async () => {
    setWidth(375);
    await setup([["Ajani's Pridemate", 2]], { saved: ['ajani'] });
    await screen.findByRole('button', { name: "Status of Ajani's Pridemate: Needed" });
    expect(screen.queryByRole('table')).toBeNull();
    const row = screen.getByText("Ajani's Pridemate").closest('li') as HTMLElement;
    expect(text(row)).toContain('×2');
    await waitFor(() => expect(text(row)).toContain('Foundations · FDN 135'));
    expect(text(row)).toContain('$0.25');
  });

  it('opens the statuses as a bottom sheet titled with the card', async () => {
    setWidth(375);
    await setup([["Ajani's Pridemate"]], { saved: ['ajani'] });
    fireEvent.click(await screen.findByRole('button', { name: "Status of Ajani's Pridemate: Needed" }));
    const sheet = screen.getByRole('dialog', { name: "Ajani's Pridemate" });
    expect(within(sheet).getByText(copy.statusHint.in_collection)).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('menuitemradio', { name: /^Proxy/ }));
    expect(await screen.findByText(copy.statusPicker.changed("Ajani's Pridemate", 'Proxy'))).toBeTruthy();
  });
});

describe('List review: other cases', () => {
  it('says so for a list that is not there', async () => {
    await setup(THREE, { path: '/lists/nope' });
    expect(await screen.findByRole('heading', { name: copy.listView.notFoundTitle })).toBeTruthy();
    expect(screen.getByRole('link', { name: copy.listView.back })).toBeTruthy();
  });

  it('says so for a list with no cards, and does not ask Scryfall for anything', async () => {
    const { fake } = await setup([], { lists: [spec([])] });
    expect(await screen.findByText(copy.listView.emptyList)).toBeTruthy();
    expect(fake.calls.lookups).toEqual([]);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows a loading placeholder first', async () => {
    await setup(THREE);
    expect(screen.getByRole('status', { name: copy.loading })).toBeTruthy();
  });

  it('is reached from Open on My lists', async () => {
    await setup(THREE, { path: '/lists', saved: ['ajani', 'tower', 'greaves'] });
    const card = (await screen.findByRole('link', { name: 'Lifegain Commander' })).closest('li') as HTMLElement;
    fireEvent.click(within(card).getByRole('link', { name: copy.listCard.open }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Lifegain Commander' })).toBeTruthy();
    expect(await screen.findByRole('table')).toBeTruthy();
  });

  it('shows the wishlist the same way', async () => {
    await setup([['Soul Warden']], { lists: [{ id: 'wishlist', kind: 'wishlist', name: 'Wishlist', cards: [['Soul Warden']] }], saved: ['warden'], path: '/lists/wishlist' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Wishlist' })).toBeTruthy();
    await dataArrived('Soul Warden', 'FDN 24');
  });

  it('plans this list on its own, whether or not it is switched on for the next dive', async () => {
    await setup(THREE, { lists: [spec(THREE, { on: false })], saved: ['ajani', 'tower', 'greaves'] });
    await screen.findByRole('table');
    await waitFor(() => expect(text(tableRow("Ajani's Pridemate"))).toContain('FDN 135'));
  });
});
