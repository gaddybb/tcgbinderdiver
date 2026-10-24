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
  signet: { name: 'Arcane Signet', printings: [pr({ setCode: 'fdc', setName: 'Foundations Commander', setType: 'commander', collectorNumber: '334', usd: '2.00' })] },
  giada: { name: 'Giada, Font of Hope', colors: ['W'], typeLine: 'Legendary Creature', printings: [fdn('141', '0.56'), pr({ setCode: 'rna', setName: 'Ravnica Allegiance', releasedAt: '2019-01-25', collectorNumber: '14', usd: '3.00' }), pr({ setCode: 'war', setName: 'War of the Spark', releasedAt: '2019-05-03', collectorNumber: '14', usd: '7.00' })] },
  elves: { name: 'Llanowar Elves', colors: ['G'], typeLine: 'Creature', printings: [fdn('227', '0.30')] },
};

const spec = (cards: Spec['cards'], over: Partial<Spec> = {}): Spec => ({ id: 'a', name: 'Lifegain Commander', created: T0, cards, ...over });

interface Options { settings?: unknown; emptyPrintings?: (keyof typeof CARDS)[]; saved?: (keyof typeof CARDS)[]; fetchedAt?: Date; hold?: boolean; failLookup?: boolean; path?: string; lists?: Spec[]; catalog?: { builtAt: string; scryfallUpdatedAt: string; offline: boolean } }

async function setup(cards: Spec['cards'], options: Options = {}) {
  const storage = new MemoryStorage();
  (storage as { persistent: boolean }).persistent = true;
  const lists = options.lists ?? [spec(cards)];
  for (const s of lists) { const list = makeList(s); await storage.put('lists', list.id, list); }
  // These fixtures have a combined Commander library; the setting is off unless a test says otherwise.
  await storage.put('settings', 'store-settings', { combinedCommander: true, ...(options.settings as object | undefined) });
  const repo = new CardsRepository(storage);
  for (const key of options.saved ?? []) {
    const card = CARDS[key];
    await repo.put({ key: card.name.toLowerCase(), summary: fakeSummary(card), printings: card.printings ?? [], fetchedAt: (options.fetchedAt ?? T0).toISOString() });
  }
  for (const key of options.emptyPrintings ?? []) {
    const card = CARDS[key];
    await repo.put({ key: card.name.toLowerCase(), summary: fakeSummary(card), printings: [], fetchedAt: (options.fetchedAt ?? T0).toISOString() });
  }
  const fake = fakeConnector(Object.values(CARDS), { failLookup: options.failLookup });
  if (options.hold) fake.hold();
  const info = options.catalog;
  if (info) Object.assign(fake.connector, { catalogInfo: () => Promise.resolve(info) });   // as the bulk connector has
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
    const heads = screen.getAllByRole('columnheader').map(h => h.textContent).filter(Boolean);
    expect(heads).toEqual(Object.values(copy.review.columns));
  });

  it('shows the price of the print it names, not the typical price across all prints', async () => {
    await setup([['Giada, Font of Hope']], { saved: ['giada'] });
    await screen.findByRole('table');
    await waitFor(() => expect(text(tableRow('Giada, Font of Hope'))).toContain('FDN 141'));
    const giada = text(tableRow('Giada, Font of Hope'));
    expect(giada).toContain('$0.56');
    expect(giada).not.toContain('$3.00');   // the median of the three prints
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

  it('shows the picture of the print the target binder is predicted to hold, as decoration', async () => {
    const { container } = await setup([["Ajani's Pridemate"]], { saved: ['ajani'] });
    await screen.findByRole('table');
    await waitFor(() => expect(container.querySelector('table img')).not.toBeNull());
    const img = container.querySelector('table img')!;
    expect(img.getAttribute('src')).toMatch(/^https:\/\/api\.scryfall\.com\/cards\/[a-z0-9]+\/[^/]+\?format=image&version=small$/);
    expect(img.getAttribute('alt')).toBe('');
  });

  it('falls back to the usual picture of the card when its own print cannot load', async () => {
    const { container } = await setup([["Ajani's Pridemate"]], { saved: ['ajani'] });
    await screen.findByRole('table');
    await waitFor(() => expect(container.querySelector('table img')).not.toBeNull());
    fireEvent.error(container.querySelector('table img')!);
    await waitFor(() => expect(container.querySelector('table img')!.getAttribute('src')).toBe(fakeSummary(CARDS.ajani).imageSmall));
  });

  it('heads the page with the art of the first card of the list', async () => {
    const { container } = await setup([["Ajani's Pridemate"]], { saved: ['ajani'] });
    await screen.findByRole('table');
    expect(container.querySelector('img[src*="art_crop"]')!.getAttribute('src')).toContain('exact=Ajani');
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

describe('List review: when prices were updated', () => {
  const CATALOG = { builtAt: '2026-10-17T22:00:00.000Z', scryfallUpdatedAt: '2026-10-17T09:30:00.000Z', offline: false };

  it('says the prices are Scryfall estimates and when they were updated, when the catalog is in use', async () => {
    await setup(THREE, { saved: ['ajani', 'tower', 'greaves'], catalog: CATALOG });
    expect(await screen.findByText(/^Prices from Scryfall, updated .*2026\. They are estimates\.$/)).toBeTruthy();
    expect(screen.queryByText(new RegExp(escapeRe(copy.review.pricesOffline)))).toBeNull();
  });

  it('adds that these are saved prices when the device is offline', async () => {
    await setup(THREE, { saved: ['ajani', 'tower', 'greaves'], catalog: { ...CATALOG, offline: true } });
    expect(await screen.findByText(new RegExp(escapeRe(copy.review.pricesOffline)))).toBeTruthy();
  });

  it('says nothing when the live API is in use', async () => {
    await setup(THREE, { saved: ['ajani', 'tower', 'greaves'] });
    await screen.findByRole('rowheader', { name: "Ajani's Pridemate" });
    expect(screen.queryByText(/Prices from Scryfall/)).toBeNull();
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

describe('List review: choosing the header art', () => {
  const t = copy.review.bannerPicker;
  const open = async () => fireEvent.click(await screen.findByRole('button', { name: t.open }));

  it('lets the player pick any card in the deck from the list page, and undo it', async () => {
    const { lists } = await setup(THREE, { saved: ['ajani', 'tower', 'greaves'] });
    await open();
    const sheet = await screen.findByRole('dialog', { name: t.title });
    expect(within(sheet).queryByRole('button', { name: t.reset })).toBeNull();   // nothing chosen yet
    fireEvent.click(within(sheet).getByRole('button', { name: /Lightning Greaves/ }));
    await waitFor(async () => expect((await lists.get('a'))?.banner).toBe('Lightning Greaves'));
    expect(screen.queryByRole('dialog', { name: t.title })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: copy.common.undo }));
    await waitFor(async () => expect((await lists.get('a'))?.banner).toBeUndefined());
  });

  it('finds a card by name, marks the current one, and can go back to the first card', async () => {
    const { lists } = await setup(THREE, { saved: ['ajani', 'tower', 'greaves'] });
    await open();
    let sheet = await screen.findByRole('dialog', { name: t.title });
    expect(within(sheet).getByRole('button', { name: new RegExp("Ajani's Pridemate.*" + t.current) }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(within(sheet).getByLabelText(t.search), { target: { value: 'tower' } });
    expect(within(sheet).getAllByRole('button', { name: /./ }).filter(b => b.getAttribute('aria-pressed') !== null)).toHaveLength(1);
    fireEvent.change(within(sheet).getByLabelText(t.search), { target: { value: 'zzz' } });
    expect(within(sheet).getByText(t.none)).toBeTruthy();
    fireEvent.change(within(sheet).getByLabelText(t.search), { target: { value: 'tower' } });
    fireEvent.click(within(sheet).getByRole('button', { name: /Command Tower/ }));
    await waitFor(async () => expect((await lists.get('a'))?.banner).toBe('Command Tower'));
    await open();
    sheet = await screen.findByRole('dialog', { name: t.title });
    fireEvent.click(within(sheet).getByRole('button', { name: t.reset }));
    await waitFor(async () => expect((await lists.get('a'))?.banner).toBeUndefined());
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

  it('offers Needed first and the five sorts from the design', async () => {
    await setup(FOUR, { saved });
    const select = await screen.findByLabelText(copy.review.sort.label);
    expect([...select.querySelectorAll('option')].map(o => o.textContent)).toEqual(['Needed first', 'Alphabetical', 'Price, high to low', 'Collector number', 'Color', 'Set']);
  });

  it('starts on Needed first: cards still needed come before owned and ordered ones, each group A to Z', async () => {
    await setup([['Soul Warden', 1, 'in_collection'], ["Ajani's Pridemate"], ['Command Tower', 1, 'ordered'], ['Lightning Greaves']], { saved: ['ajani', 'warden', 'tower', 'greaves'] });
    await dataArrived("Ajani's Pridemate", 'FDN 135');
    expect((screen.getByLabelText(copy.review.sort.label) as HTMLSelectElement).value).toBe('status');
    expect(names()).toEqual(["Ajani's Pridemate", 'Lightning Greaves', 'Soul Warden', 'Command Tower']);
  });

  it('goes back to plain A to Z when Alphabetical is chosen', async () => {
    await setup([['Soul Warden', 1, 'in_collection'], ["Ajani's Pridemate"], ['Command Tower', 1, 'ordered']], { saved: ['ajani', 'warden', 'tower'] });
    await dataArrived("Ajani's Pridemate", 'FDN 135');
    fireEvent.change(screen.getByLabelText(copy.review.sort.label), { target: { value: 'alphabetical' } });
    expect(names()).toEqual(["Ajani's Pridemate", 'Command Tower', 'Soul Warden']);
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
    expect(screen.getByText(copy.filters.noMatches)).toBeTruthy();
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

// ---- filters ----
describe('List review: price and color filters', () => {
  const CARDS5: Spec['cards'] = [["Ajani's Pridemate"], ['Command Tower'], ['Lightning Greaves'], ['Arcane Signet'], ['Llanowar Elves']];
  const saved: Options['saved'] = ['ajani', 'tower', 'greaves', 'signet', 'elves'];
  const priced = async () => {
    await screen.findByRole('table');
    await dataArrived('Lightning Greaves', '$18.50');
    await dataArrived('Arcane Signet', '$2.00');
    await dataArrived('Llanowar Elves', '$0.30');
    await dataArrived("Ajani's Pridemate", '$0.25');
    await dataArrived('Command Tower', '$0.35');
  };
  const price = (value: string) => fireEvent.change(screen.getByLabelText(copy.filters.price.label), { target: { value } });
  const colorButton = (name: string) => screen.getByRole('button', { name });

  it('offers the four price bands from the design', async () => {
    await setup(CARDS5, { saved });
    const select = await screen.findByLabelText(copy.filters.price.label);
    expect([...select.querySelectorAll('option')].map(o => o.textContent)).toEqual(['Any price', 'Under $1', '$1 to $5', '$5 and up']);
    expect((select as HTMLSelectElement).value).toBe('any');
  });

  it('shows only the cards in the price band', async () => {
    await setup(CARDS5, { saved });
    await priced();
    price('under_1');
    expect(names()).toEqual(["Ajani's Pridemate", 'Command Tower', 'Llanowar Elves']);
    price('1_to_5');
    expect(names()).toEqual(['Arcane Signet']);
    price('5_up');
    expect(names()).toEqual(['Lightning Greaves']);
    price('any');
    expect(names()).toHaveLength(5);
  });

  it('a card with no price is only shown under Any price', async () => {
    await setup([['Online Only'], ["Ajani's Pridemate"]], { saved: ['online', 'ajani'] });
    await screen.findByRole('table');
    await dataArrived("Ajani's Pridemate", '$0.25');
    price('under_1');
    expect(names()).toEqual(["Ajani's Pridemate"]);
  });

  it('shows only the cards of the colors picked, and says which are on', async () => {
    await setup(CARDS5, { saved });
    await priced();
    fireEvent.click(colorButton('White'));
    expect(colorButton('White').getAttribute('aria-pressed')).toBe('true');
    expect(names()).toEqual(["Ajani's Pridemate"]);
    fireEvent.click(colorButton('Green'));
    expect(names()).toEqual(["Ajani's Pridemate", 'Llanowar Elves']);
    fireEvent.click(colorButton('White'));
    expect(names()).toEqual(['Llanowar Elves']);
    fireEvent.click(colorButton('Green'));
    expect(names()).toHaveLength(5);
  });

  it('combines with search and sort', async () => {
    await setup(CARDS5, { saved });
    await priced();
    price('under_1');
    fireEvent.click(colorButton('Land'));
    expect(names()).toEqual(['Command Tower']);
    fireEvent.click(colorButton('Land'));
    fireEvent.change(screen.getByLabelText(copy.review.search.label), { target: { value: 'an' } });
    expect(names()).toEqual(["Ajani's Pridemate", 'Command Tower', 'Llanowar Elves']);
    fireEvent.change(screen.getByLabelText(copy.review.sort.label), { target: { value: 'price_desc' } });
    expect(names()).toEqual(['Command Tower', 'Llanowar Elves', "Ajani's Pridemate"]);
  });

  it('says so when nothing matches', async () => {
    await setup(CARDS5, { saved });
    await priced();
    price('5_up');
    fireEvent.click(colorButton('Green'));
    expect(screen.getByText(copy.filters.noMatches)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('is on a phone too', async () => {
    setWidth(375);
    await setup(CARDS5, { saved });
    await screen.findByRole('button', { name: "Status of Ajani's Pridemate: Needed" });
    await waitFor(() => expect(screen.getAllByText('$18.50')).toHaveLength(1));
    price('5_up');
    expect(screen.queryByText("Ajani's Pridemate")).toBeNull();
    expect(screen.getByText('Lightning Greaves')).toBeTruthy();
    fireEvent.click(colorButton('Green'));
    expect(screen.getByText(copy.filters.noMatches)).toBeTruthy();
  });
});

// ---- bulk actions ----
const FIVE: Spec['cards'] = [["Ajani's Pridemate"], ['Soul Warden'], ['Command Tower'], ['Lightning Greaves'], ['Arcane Signet']];
const FIVE_SAVED: Options['saved'] = ['ajani', 'warden', 'tower', 'greaves', 'signet'];
const ZOMBIES: Spec = { id: 'b', name: 'Zombie Tribal', created: T0, cards: [['Command Tower']] };
const checkbox = (name: string) => screen.getByRole('checkbox', { name: `Select ${name}` }) as HTMLInputElement;
const pick = (...cardNames: string[]) => cardNames.forEach(n => fireEvent.click(checkbox(n)));
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const choose = (name: RegExp | string) => fireEvent.click(screen.getByRole('menuitem', { name }));
const statusesOf = async (lists: ListsRepository, id = 'a') => (await lists.get(id))!.entries.map(e => `${e.name}:${e.status}`);
const keysOf = async (lists: ListsRepository, id: string) => (await lists.get(id))!.entries.map(e => e.cardKey);
const bar = (n: number) => screen.queryByRole('region', { name: copy.bulk.selectedCards(n) });

describe('List review: selecting cards (table)', () => {
  it('has a checkbox for every card and one to select all', async () => {
    await setup(FIVE, { saved: FIVE_SAVED });
    await screen.findByRole('table');
    expect(screen.getAllByRole('checkbox')).toHaveLength(6);
    expect(screen.getByRole('checkbox', { name: copy.bulk.selectAllCards })).toBeTruthy();
  });

  it('shows the quick actions, and no selection bar until something is selected', async () => {
    await setup(FIVE, { saved: FIVE_SAVED });
    await screen.findByRole('table');
    expect(screen.getByText(copy.bulk.quickActions)).toBeTruthy();
    for (const label of [copy.bulk.markOwned, copy.bulk.markNeeded, copy.bulk.selectByBinder]) expect(screen.getByRole('button', { name: label })).toBeTruthy();
    expect(screen.queryByRole('region', { name: /selected/i })).toBeNull();
  });

  it('says how many cards are selected, with the four actions, and Clear selection empties it', async () => {
    await setup(FIVE, { saved: FIVE_SAVED });
    await screen.findByRole('table');
    pick("Ajani's Pridemate", 'Soul Warden', 'Command Tower');
    const region = screen.getByRole('region', { name: copy.bulk.selectedCards(3) });
    expect(within(region).getByText(copy.bulk.selectedCards(3))).toBeTruthy();
    for (const label of [copy.bulk.setStatus, copy.bulk.copyToAnotherList]) expect(within(region).getByRole('button', { name: label })).toBeTruthy();
    expect(within(region).getByRole('button', { name: copy.bulk.removeFromList })).toBeTruthy();
    fireEvent.click(within(region).getByRole('button', { name: copy.bulk.clearSelection }));
    expect(bar(3)).toBeNull();
    expect(checkbox('Soul Warden').checked).toBe(false);
  });

  it('says "1 card selected" for one', async () => {
    await setup(FIVE, { saved: FIVE_SAVED });
    await screen.findByRole('table');
    pick('Soul Warden');
    expect(bar(1)).toBeTruthy();
    expect(copy.bulk.selectedCards(1)).toBe('1 card selected');
  });

  it('the box in the header selects every card, then none', async () => {
    await setup(FIVE, { saved: FIVE_SAVED });
    await screen.findByRole('table');
    const all = screen.getByRole('checkbox', { name: copy.bulk.selectAllCards });
    fireEvent.click(all);
    expect(bar(5)).toBeTruthy();
    fireEvent.click(all);
    expect(bar(5)).toBeNull();
  });

  it('select all selects what is shown, and actions leave the hidden cards alone', async () => {
    const { lists } = await setup(FIVE, { saved: FIVE_SAVED });
    await screen.findByRole('table');
    await dataArrived("Ajani's Pridemate", '$0.25');
    await dataArrived('Lightning Greaves', '$18.50');
    await dataArrived('Arcane Signet', '$2.00');
    await dataArrived('Command Tower', '$0.35');
    await dataArrived('Soul Warden', '$0.30');
    fireEvent.change(screen.getByLabelText(copy.filters.price.label), { target: { value: 'under_1' } });
    fireEvent.click(screen.getByRole('checkbox', { name: copy.bulk.selectAllCards }));
    expect(bar(3)).toBeTruthy();
    press(copy.bulk.setStatus);
    choose(/^Proxy/);
    expect(await screen.findByText(copy.bulk.statusSet(3, 'Proxy'))).toBeTruthy();
    expect(await statusesOf(lists)).toEqual(["Ajani's Pridemate:proxy", 'Soul Warden:proxy', 'Command Tower:proxy', 'Lightning Greaves:needed', 'Arcane Signet:needed']);
  });

  it('a card selected and then hidden by a filter is not counted or acted on', async () => {
    await setup(FIVE, { saved: FIVE_SAVED });
    await screen.findByRole('table');
    pick("Ajani's Pridemate");
    expect(bar(1)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(copy.review.search.label), { target: { value: 'tower' } });
    expect(bar(1)).toBeNull();
    fireEvent.change(screen.getByLabelText(copy.review.search.label), { target: { value: '' } });
    expect(bar(1)).toBeTruthy();
  });

  it('Select by binder selects that binder\'s cards, and says how many there are', async () => {
    await setup(FIVE, { saved: FIVE_SAVED });
    await screen.findByRole('table');
    await dataArrived('Soul Warden', 'FDN 24');
    await dataArrived('Command Tower', 'FDC 352');
    press(copy.bulk.selectByBinder);
    const items = screen.getAllByRole('menuitem').map(i => i.textContent);
    expect(items).toContain(copy.bulk.binderOption('Foundations', 2));
    expect(items).toContain(copy.bulk.binderOption('Commander box', 2));
    choose(copy.bulk.binderOption('Commander box', 2));
    expect(bar(2)).toBeTruthy();
    expect(checkbox('Command Tower').checked).toBe(true);
    expect(checkbox('Arcane Signet').checked).toBe(true);
    expect(checkbox('Soul Warden').checked).toBe(false);
  });

  it('Select by binder is off until card data says where cards go', async () => {
    await setup(FIVE, { saved: [], hold: true });
    await screen.findByRole('table');
    expect((screen.getByRole('button', { name: copy.bulk.selectByBinder }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('List review: bulk status', () => {
  it('sets the status of the selected cards, saves it, updates the counts and says so with Undo', async () => {
    const { lists } = await setup(FIVE, { saved: FIVE_SAVED });
    await screen.findByRole('table');
    pick("Ajani's Pridemate", 'Soul Warden');
    press(copy.bulk.setStatus);
    const menu = screen.getByRole('menu');
    for (const hint of Object.values(copy.statusHint)) expect(within(menu).getByText(hint)).toBeTruthy();
    choose(/^In collection/);
    expect(await screen.findByText(copy.bulk.statusSet(2, 'In collection'))).toBeTruthy();
    expect(await statusesOf(lists)).toEqual(["Ajani's Pridemate:in_collection", 'Soul Warden:in_collection', 'Command Tower:needed', 'Lightning Greaves:needed', 'Arcane Signet:needed']);
    expect(await screen.findByText(copy.review.summary(5, 3, '$21'))).toBeTruthy();
    expect(bar(2)).toBeNull();
  });

  it('Undo puts every status back, and Updated too', async () => {
    const { lists } = await setup(FIVE, { saved: FIVE_SAVED, lists: [spec(FIVE, { updated: new Date(T0.getTime() - 5 * 24 * 3600 * 1000) })] });
    await screen.findByRole('table');
    const before = await lists.get('a');
    pick("Ajani's Pridemate", 'Soul Warden');
    press(copy.bulk.setStatus);
    choose(/^Ordered/);
    await screen.findByText(copy.bulk.statusSet(2, 'Ordered'));
    expect((await lists.get('a'))!.updatedAt).toBe(T0.toISOString());
    fireEvent.click(screen.getByRole('button', { name: copy.common.undo }));
    await waitFor(async () => expect(await lists.get('a')).toEqual(before));
    expect(await screen.findByRole('button', { name: "Status of Ajani's Pridemate: Needed" })).toBeTruthy();
  });

  it('Mark all as owned sets every card to In collection, and Undo brings them back', async () => {
    const { lists } = await setup([["Ajani's Pridemate"], ['Soul Warden', 1, 'proxy'], ['Command Tower']], { saved: ['ajani', 'warden', 'tower'] });
    await screen.findByRole('table');
    press(copy.bulk.markOwned);
    expect(await screen.findByText(copy.bulk.statusSet(3, 'In collection'))).toBeTruthy();
    expect(await statusesOf(lists)).toEqual(["Ajani's Pridemate:in_collection", 'Soul Warden:in_collection', 'Command Tower:in_collection']);
    expect(await screen.findByText(copy.review.summary(3, 0, null))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: copy.common.undo }));
    await waitFor(async () => expect(await statusesOf(lists)).toEqual(["Ajani's Pridemate:needed", 'Soul Warden:proxy', 'Command Tower:needed']));
  });

  it('Mark all as needed does nothing, and leaves Updated alone, when every card is already needed', async () => {
    const { lists } = await setup([["Ajani's Pridemate"], ['Soul Warden']], { saved: ['ajani', 'warden'] });
    await screen.findByRole('table');
    press(copy.bulk.markNeeded);
    await act(async () => { await new Promise(r => setTimeout(r, 100)); });
    expect(screen.queryByRole('button', { name: copy.common.undo })).toBeNull();
    expect((await lists.get('a'))!.updatedAt).toBe(T0.toISOString());
  });

  it('Mark all as needed counts only the cards that changed, and puts them back with Undo', async () => {
    const { lists } = await setup([["Ajani's Pridemate", 1, 'in_collection'], ['Soul Warden']], { saved: ['ajani', 'warden'] });
    await screen.findByRole('table');
    press(copy.bulk.markNeeded);
    expect(await screen.findByText(copy.bulk.statusSet(1, 'Needed'))).toBeTruthy();
    expect(await statusesOf(lists)).toEqual(["Ajani's Pridemate:needed", 'Soul Warden:needed']);
    fireEvent.click(screen.getByRole('button', { name: copy.common.undo }));
    await waitFor(async () => expect(await statusesOf(lists)).toEqual(["Ajani's Pridemate:in_collection", 'Soul Warden:needed']));
    press(copy.bulk.markOwned);
    expect(await screen.findByText(copy.bulk.statusSet(1, 'In collection'))).toBeTruthy();
  });
});

describe('List review: bulk remove', () => {
  it('removes the selected cards, says so, and Undo brings them back exactly as they were', async () => {
    const { lists } = await setup(FIVE, { saved: FIVE_SAVED });
    await screen.findByRole('table');
    const before = await lists.get('a');
    pick('Soul Warden', 'Arcane Signet');
    press(copy.bulk.removeFromList);
    expect(await screen.findByText(copy.bulk.removed(2, 'Lifegain Commander'))).toBeTruthy();
    expect(await keysOf(lists, 'a')).toEqual(["ajani's pridemate", 'command tower', 'lightning greaves']);
    expect(names()).toEqual(["Ajani's Pridemate", 'Command Tower', 'Lightning Greaves']);
    expect(await screen.findByText(/^3 cards · 3 still needed/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: copy.common.undo }));
    await waitFor(async () => expect(await lists.get('a')).toEqual(before));
    await waitFor(() => expect(names()).toHaveLength(5));
  });

  it('can remove every card, and Undo restores them', async () => {
    const { lists } = await setup(FIVE, { saved: FIVE_SAVED });
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('checkbox', { name: copy.bulk.selectAllCards }));
    press(copy.bulk.removeFromList);
    expect(await screen.findByText(copy.listView.emptyList)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: copy.common.undo }));
    expect(await screen.findByRole('table')).toBeTruthy();
    expect(await keysOf(lists, 'a')).toHaveLength(5);
  });
});

describe('List review: bulk copy to another list', () => {
  const copyTo = (target: string) => { press(copy.bulk.copyToAnotherList); choose(target); };

  it('offers the other lists, not this one', async () => {
    await setup(FIVE, { saved: FIVE_SAVED, lists: [spec(FIVE), ZOMBIES] });
    await screen.findByRole('table');
    pick('Soul Warden');
    press(copy.bulk.copyToAnotherList);
    const names = screen.getAllByRole('menuitem').map(i => i.textContent);
    expect(names).toContain('Zombie Tribal');
    expect(names).toContain('Wishlist');
    expect(names).not.toContain('Lifegain Commander');
  });

  it('copies the cards: new ones are added, one already there gains its copies, and this list is unchanged', async () => {
    const { lists } = await setup(FIVE, { saved: FIVE_SAVED, lists: [spec(FIVE), ZOMBIES] });
    await screen.findByRole('table');
    pick("Ajani's Pridemate", 'Command Tower');
    copyTo('Zombie Tribal');
    expect(await screen.findByText(copy.bulk.copied(2, 'Zombie Tribal'))).toBeTruthy();
    const zombies = (await lists.get('b'))!;
    expect(zombies.entries.map(e => [e.cardKey, e.quantity])).toEqual([['command tower', 2], ["ajani's pridemate", 1]]);
    expect(await keysOf(lists, 'a')).toHaveLength(5);
    expect(bar(2)).toBeNull();
  });

  it('Undo takes the copies back out of the other list', async () => {
    const { lists } = await setup(FIVE, { saved: FIVE_SAVED, lists: [spec(FIVE), ZOMBIES] });
    await screen.findByRole('table');
    const before = await lists.get('b');
    pick("Ajani's Pridemate", 'Command Tower');
    copyTo('Zombie Tribal');
    await screen.findByText(copy.bulk.copied(2, 'Zombie Tribal'));
    fireEvent.click(screen.getByRole('button', { name: copy.common.undo }));
    await waitFor(async () => expect(await lists.get('b')).toEqual(before));
    expect(await keysOf(lists, 'a')).toHaveLength(5);
  });

  const filler = (n: number): Spec['cards'] => Array.from({ length: n }, (_, i) => [`Filler ${i}`] as [string]);

  it('says how many did not fit under 250, and still copies the ones that did', async () => {
    const { lists } = await setup(FIVE, { saved: FIVE_SAVED, lists: [spec(FIVE), { ...ZOMBIES, cards: filler(249) }] });
    await screen.findByRole('table');
    pick("Ajani's Pridemate", 'Soul Warden', 'Command Tower');
    copyTo('Zombie Tribal');
    expect(await screen.findByText(copy.bulk.copiedSomeDidNotFit(1, 'Zombie Tribal', 2, 250))).toBeTruthy();
    expect(await keysOf(lists, 'b')).toHaveLength(250);
  });

  it('says so when nothing fit, changes nothing, and offers no Undo', async () => {
    const { lists } = await setup(FIVE, { saved: FIVE_SAVED, lists: [spec(FIVE), { ...ZOMBIES, cards: filler(250) }] });
    await screen.findByRole('table');
    const before = await lists.get('b');
    pick('Soul Warden');
    copyTo('Zombie Tribal');
    expect(await screen.findByText(copy.bulk.copiedNone('Zombie Tribal', 250))).toBeTruthy();
    expect(screen.queryByRole('button', { name: copy.common.undo })).toBeNull();
    expect(await lists.get('b')).toEqual(before);
  });
});

describe('List review: selecting on a phone', () => {
  const phoneSetup = async (options: Options = {}) => {
    setWidth(375);
    const result = await setup(FIVE, { saved: FIVE_SAVED, ...options });
    await screen.findByRole('button', { name: "Status of Ajani's Pridemate: Needed" });
    return result;
  };
  const tapRow = (name: string) => fireEvent.click(screen.getByText(name));

  it('has a Select button, and no checkboxes or table until it is tapped', async () => {
    await phoneSetup();
    expect(screen.getByRole('button', { name: copy.bulk.select })).toBeTruthy();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryByText(copy.bulk.quickActions)).toBeNull();
  });

  it('Select shows the header with the count, the hint, checkboxes and the bottom bar', async () => {
    await phoneSetup();
    press(copy.bulk.select);
    expect(screen.getByRole('button', { name: copy.bulk.exitSelect })).toBeTruthy();
    expect(screen.getByText(copy.bulk.selectedShort(0))).toBeTruthy();
    expect(screen.getByText(copy.bulk.selectHint)).toBeTruthy();
    expect(screen.getAllByRole('checkbox')).toHaveLength(5);
    for (const label of [copy.bulk.setStatus, copy.bulk.copyToList, copy.bulk.remove]) expect((screen.getByRole('button', { name: label }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: copy.bulk.select })).toBeNull();
  });

  it('tapping a row toggles it and the count follows', async () => {
    await phoneSetup();
    press(copy.bulk.select);
    tapRow('Soul Warden');
    tapRow('Command Tower');
    expect(screen.getByText(copy.bulk.selectedShort(2))).toBeTruthy();
    expect(screen.queryByText(copy.bulk.selectHint)).toBeNull();
    expect(checkbox('Soul Warden').checked).toBe(true);
    tapRow('Soul Warden');
    expect(screen.getByText(copy.bulk.selectedShort(1))).toBeTruthy();
  });

  it('Select all selects what is shown, then becomes Select none', async () => {
    await phoneSetup();
    fireEvent.change(screen.getByLabelText(copy.review.search.label), { target: { value: 'ar' } });
    const shownCount = 2;   // Arcane Signet and Soul Warden
    press(copy.bulk.select);
    press(copy.bulk.selectAll);
    expect(screen.getByText(copy.bulk.selectedShort(shownCount))).toBeTruthy();
    press(copy.bulk.deselectAll);
    expect(screen.getByText(copy.bulk.selectedShort(0))).toBeTruthy();
  });

  it('the close button leaves select mode and clears the selection', async () => {
    await phoneSetup();
    press(copy.bulk.select);
    tapRow('Soul Warden');
    press(copy.bulk.exitSelect);
    expect(screen.getByRole('button', { name: copy.bulk.select })).toBeTruthy();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    press(copy.bulk.select);
    expect(screen.getByText(copy.bulk.selectedShort(0))).toBeTruthy();
  });

  it('holding a row down starts select mode with that card chosen', async () => {
    await phoneSetup();
    fireEvent.pointerDown(screen.getByText('Soul Warden'));
    await act(async () => { await new Promise(r => setTimeout(r, 600)); });
    expect(screen.getByText(copy.bulk.selectedShort(1))).toBeTruthy();
    expect(checkbox('Soul Warden').checked).toBe(true);
  });

  it('Set status opens the five statuses as a bottom sheet, and changes the cards', async () => {
    const { lists } = await phoneSetup();
    press(copy.bulk.select);
    tapRow('Soul Warden');
    tapRow('Command Tower');
    press(copy.bulk.setStatus);
    const sheet = screen.getByRole('dialog', { name: copy.bulk.setStatus });
    expect(within(sheet).getByText(copy.statusHint.proxy)).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('menuitem', { name: /^Proxy/ }));
    expect(await screen.findByText(copy.bulk.statusSet(2, 'Proxy'))).toBeTruthy();
    expect(await statusesOf(lists)).toContain('Soul Warden:proxy');
    expect(screen.getByRole('button', { name: copy.bulk.select })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: copy.common.undo }));
    await waitFor(async () => expect(await statusesOf(lists)).not.toContain('Soul Warden:proxy'));
  });

  it('Copy to list lets the player pick a list in a bottom sheet', async () => {
    const { lists } = await phoneSetup({ lists: [spec(FIVE), ZOMBIES] });
    press(copy.bulk.select);
    tapRow('Soul Warden');
    press(copy.bulk.copyToList);
    const sheet = screen.getByRole('dialog', { name: copy.bulk.copyToListTitle });
    fireEvent.click(within(sheet).getByRole('menuitem', { name: 'Zombie Tribal' }));
    expect(await screen.findByText(copy.bulk.copied(1, 'Zombie Tribal'))).toBeTruthy();
    expect(await keysOf(lists, 'b')).toEqual(['command tower', 'soul warden']);
  });

  it('Remove takes the selected cards off, with Undo', async () => {
    const { lists } = await phoneSetup();
    press(copy.bulk.select);
    tapRow('Soul Warden');
    press(copy.bulk.remove);
    expect(await screen.findByText(copy.bulk.removed(1, 'Lifegain Commander'))).toBeTruthy();
    expect(await keysOf(lists, 'a')).toHaveLength(4);
    expect(screen.queryByText('Soul Warden')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: copy.common.undo }));
    await waitFor(async () => expect(await keysOf(lists, 'a')).toHaveLength(5));
    expect(await screen.findByText('Soul Warden')).toBeTruthy();
  });
});

describe('List review: tabs, the dive plan and the binder groups beside the list', () => {
  const TWO: Spec[] = [spec([["Ajani's Pridemate"], ['Soul Warden'], ['Command Tower', 1, 'in_collection']]), { id: 'b', name: 'Zombie Tribal', cards: [['Lightning Greaves']] }];
  const panel = () => screen.getByRole('complementary', { name: copy.divePanel.title });
  const SETTINGS = { pull: { worthPullMinCards: 2, worthPullMinUsd: 10 }, includeBasicLands: false };
  beforeEach(() => { setWidth(1280); });   // the plan sits beside the list only on a desktop

  it('shows a tab for each list, marks this one, and opens another', async () => {
    await setup(undefined, { lists: TWO, saved: ['ajani', 'warden', 'tower', 'greaves'] });
    const tabs = await screen.findByRole('navigation', { name: copy.review.tabsLabel });
    const [all, ...links] = within(tabs).getAllByRole('link');
    expect(all.textContent).toBe(copy.listView.back);
    expect(all.getAttribute('aria-current')).toBeNull();
    expect(links.map(a => a.textContent)).toEqual(['Lifegain Commander', 'Zombie Tribal', 'Wishlist']);
    expect(links[0].getAttribute('aria-current')).toBe('page');
    fireEvent.click(links[1]);
    expect(await screen.findByRole('heading', { level: 1, name: 'Zombie Tribal' })).toBeTruthy();
  });

  it('has Paste another list, which opens the import', async () => {
    await setup(undefined, { lists: TWO, saved: ['ajani'] });
    fireEvent.click(await screen.findByRole('button', { name: copy.review.pasteAnother }));
    expect(window.location.pathname).toBe('/import');
  });

  it('says Nothing to find for a card that is not needed', async () => {
    await setup(undefined, { lists: TWO, saved: ['ajani', 'warden', 'tower'] });
    await waitFor(() => expect(text(tableRow('Command Tower'))).toContain(copy.review.target.nothing));
  });

  it('shows the dive plan: the stops with their verdicts, for the lists turned on', async () => {
    await setup(undefined, { lists: TWO, saved: ['ajani', 'warden', 'tower', 'greaves'] });
    const aside = await screen.findByRole('complementary', { name: copy.divePanel.title });
    await waitFor(() => expect(within(aside).getByText('Foundations')).toBeTruthy());
    const foundations = within(aside).getByText('Foundations').closest('li') as HTMLElement;
    expect(foundations.textContent).toContain('2 cards');
    expect(foundations.textContent).toContain(copy.verdict.worth_a_pull);
    expect(within(aside).getByText('Display case').closest('li')!.textContent).toContain(copy.verdict.show_staff);
  });

  it('has a switch for each list in this dive, and turning one off changes the plan and is saved', async () => {
    const { lists } = await setup(undefined, { lists: TWO, saved: ['ajani', 'warden', 'tower', 'greaves'] });
    const aside = await screen.findByRole('complementary', { name: copy.divePanel.title });
    await waitFor(() => expect(within(aside).getByText('Display case')).toBeTruthy());
    expect(within(aside).getByRole('switch', { name: copy.divePanel.listLabel('Lifegain Commander', 2) })).toBeTruthy();
    fireEvent.click(within(aside).getByRole('switch', { name: copy.divePanel.listLabel('Zombie Tribal', 1) }));
    await waitFor(() => expect(within(panel()).queryByText('Display case')).toBeNull());
    expect((await lists.get('b'))!.inNextDive).toBe(false);
  });

  it('says how many cards have no binder, and links to the plan', async () => {
    await setup(undefined, { lists: TWO, saved: ['ajani', 'warden', 'greaves'], settings: { ...SETTINGS, binderGroups: [], notCarried: ['rna'] } });
    const aside = await screen.findByRole('complementary', { name: copy.divePanel.title });
    fireEvent.click(await within(aside).findByRole('button', { name: copy.divePanel.noBinder(1) }));
    expect(window.location.pathname).toBe('/plan');
  });

  it('shows the binder groups in one line each, and Edit opens the editor', async () => {
    await setup(undefined, {
      lists: TWO, saved: ['ajani', 'warden', 'tower'],
      settings: { ...SETTINGS, binderGroups: [{ id: 'g', name: 'Commander Box', setCodes: ['fdc', 'cmm'] }], notCarried: ['khm'] },
    });
    const aside = await screen.findByRole('complementary', { name: copy.divePanel.title });
    await waitFor(() => expect(within(aside).getByText(copy.divePanel.groupLine('CMM', 'Commander Box'), { exact: false })).toBeTruthy());
    expect(within(aside).getByText(copy.divePanel.groupLine('KHM', copy.groups.notCarried.title))).toBeTruthy();
    fireEvent.click(within(aside).getByRole('button', { name: copy.divePanel.editGroups }));
    expect(window.location.pathname).toBe('/groups');
  });

  it('starts a store dive from the plan, with the lists that have cards', async () => {
    const { storage } = await setup(undefined, { lists: TWO, saved: ['ajani', 'warden', 'greaves'] });
    const aside = await screen.findByRole('complementary', { name: copy.divePanel.title });
    // Start store dive is at the top of the plan and at its end; either starts the dive.
    await waitFor(() => expect(within(aside).getAllByRole('button', { name: copy.dive.startDive })).toHaveLength(2));
    const [start, end] = within(aside).getAllByRole('button', { name: copy.dive.startDive });
    await waitFor(() => expect((start as HTMLButtonElement).disabled).toBe(false));
    expect(start.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(start);
    expect(window.location.pathname).toBe('/dive');
    expect((await storage.get<{ listIds: string[] }>('trips', 'current'))!.listIds).toEqual(['a', 'b']);
  });

  it('on a phone a Build my dive plan button sits on the closed plan, and opens the plan page', async () => {
    setWidth(375);
    await setup(undefined, { lists: TWO, saved: ['ajani', 'warden', 'greaves'] });
    const aside = await screen.findByRole('complementary', { name: copy.divePanel.title });
    fireEvent.click(within(aside).getByRole('button', { name: copy.divePanel.build }));
    expect(window.location.pathname).toBe('/plan');
  });

  it('on a phone the plan opens and closes above the cards', async () => {
    setWidth(375);
    await setup(undefined, { lists: TWO, saved: ['ajani', 'warden', 'greaves'] });
    const aside = await screen.findByRole('complementary', { name: copy.divePanel.title });
    expect(within(aside).queryByText(copy.divePanel.listsTitle)).toBeNull();
    fireEvent.click(within(aside).getByRole('button', { name: copy.divePanel.show }));
    expect(within(aside).getByText(copy.divePanel.listsTitle)).toBeTruthy();
    fireEvent.click(within(aside).getByRole('button', { name: copy.divePanel.hide }));
    expect(within(aside).queryByText(copy.divePanel.listsTitle)).toBeNull();
  });

  it('on a tablet the plan sits above the cards, closed, so the table has the full width', async () => {
    setWidth(800);
    await setup(undefined, { lists: TWO, saved: ['ajani', 'warden', 'greaves'] });
    const aside = await screen.findByRole('complementary', { name: copy.divePanel.title });
    expect(within(aside).queryByText(copy.divePanel.listsTitle)).toBeNull();
    expect(within(aside).getByRole('button', { name: copy.divePanel.show })).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('sorts by set', async () => {
    await setup(undefined, { lists: [spec([['Command Tower'], ["Ajani's Pridemate"], ['Soul Warden']])], saved: ['tower', 'ajani', 'warden'] });
    await dataArrived('Command Tower', 'FDC');
    fireEvent.change(screen.getByLabelText(copy.review.sort.label), { target: { value: 'set' } });
    expect(names()).toEqual(['Command Tower', 'Soul Warden', "Ajani's Pridemate"]);   // fdc, then fdn by number
  });
});

describe('List review: refreshing card data', () => {
  const ON = { binderGroups: [], notCarried: [], includeBasicLands: true, pull: { worthPullMinCards: 2, worthPullMinUsd: 10 } };

  it('has a Refresh card data button that forgets what is saved and fetches the cards again', async () => {
    const { fake, repo } = await setup([["Ajani's Pridemate"], ['Soul Warden']], { saved: ['ajani', 'warden'] });
    await dataArrived("Ajani's Pridemate", 'FDN 135');
    expect(fake.calls.lookups).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: copy.review.refresh }));
    await waitFor(() => expect(fake.calls.lookups).toHaveLength(1));
    expect(fake.calls.lookups[0].sort()).toEqual(["Ajani's Pridemate", 'Soul Warden']);
    await waitFor(async () => expect((await repo.get('soul warden'))!.fetchedAt).toBe(T0.toISOString()));
    await dataArrived('Soul Warden', 'FDN 24');
  });

  it('fetches a basic land saved without printings once basics are included, so it gets a binder', async () => {
    const { fake } = await setup([['Forest', 2], ['Soul Warden']], { settings: ON, saved: ['warden'], emptyPrintings: ['forest'] });
    await dataArrived('Forest', 'FDN 280');
    expect(fake.calls.lookups.flat()).toContain('Forest');
    expect(text(tableRow('Forest'))).not.toContain(copy.review.target.noBinder);
  });
});

describe('List review: nothing left to find', () => {
  it('says every card is accounted for, with how they are marked, when none is still needed', async () => {
    await setup([["Ajani's Pridemate", 1, 'in_collection'], ['Soul Warden', 1, 'in_collection'], ['Command Tower', 1, 'ordered']], { saved: ['ajani', 'warden', 'tower'] });
    expect(await screen.findByText(copy.allAccounted.title)).toBeTruthy();
    expect(screen.getByText(copy.allAccounted.detail(3, '2 in collection, 1 ordered'))).toBeTruthy();
  });

  it('says nothing of the kind while a card is still needed', async () => {
    await setup([["Ajani's Pridemate"], ['Soul Warden', 1, 'in_collection']], { saved: ['ajani', 'warden'] });
    await dataArrived("Ajani's Pridemate", 'FDN 135');
    expect(screen.queryByText(copy.allAccounted.title)).toBeNull();
  });
});
