import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeConnector, fakeSummary } from '../../../connectors/fakeConnector';
import { pr } from '../../../core/engine/fixtures';
import type { Printing } from '../../../core/engine/engine';
import { startTrip } from '../../../core/trip';
import type { Trip } from '../../../core/trip';
import { CardsRepository, MemoryStorage } from '../../../storage';
import { App } from '../../App';
import { NEARBY_STORES_URL } from '../../links';
import { copy } from '../../copy/en';
import { T0, makeList } from '../../testkit';
import type { Spec } from '../../testkit';

const t = copy.storeDive;
const c = t.counter;

const recent = (setCode: string, setName: string, over: Partial<Parameters<typeof pr>[0]> = {}): Printing =>
  pr({ setCode, setName, setType: 'core', releasedAt: '2026-06-01', usd: '1.00', ...over });

const CARDS: Record<string, { name: string; typeLine?: string; printings: Printing[] }> = {
  forest: { name: 'Forest', typeLine: 'Basic Land — Forest', printings: [recent('fdn', 'Foundations', { collectorNumber: '280', usd: '0.10' })] },
  ajani: { name: "Ajani's Pridemate", printings: [recent('fdn', 'Foundations', { collectorNumber: '135' })] },
  warden: { name: 'Soul Warden', printings: [recent('fdn', 'Foundations', { collectorNumber: '24' })] },
  cultivate: { name: 'Cultivate', printings: [recent('fdn', 'Foundations', { collectorNumber: '214' }), pr({ setCode: 'cmm', setName: 'Commander Masters', setType: 'commander', usd: '0.50', collectorNumber: '1' })] },
  tower: { name: 'Command Tower', printings: [pr({ setCode: 'cmm', setName: 'Commander Masters', setType: 'commander', usd: '0.35', collectorNumber: '2' })] },
  greaves: { name: 'Lightning Greaves', printings: [pr({ setCode: 'rna', setName: 'Ravnica Allegiance', setType: 'expansion', releasedAt: '2019-01-25', usd: '18.50', collectorNumber: '9' })] },
  bulk: { name: 'Old Bulk', printings: [pr({ setCode: 'old', setName: 'Old Set', setType: 'expansion', releasedAt: '2010-01-01', usd: '0.30', collectorNumber: '7' })] },
  zombie: { name: 'Zombie Thing', printings: [recent('fdn', 'Foundations', { collectorNumber: '300', usd: '6.00' })] },
};

const DECK: Spec = { id: 'a', name: 'Lifegain', cards: [["Ajani's Pridemate", 2], ['Soul Warden'], ['Cultivate'], ['Command Tower'], ['Lightning Greaves'], ['Old Bulk']] };
const ZOMBIES: Spec = { id: 'b', name: 'Zombies', cards: [["Ajani's Pridemate"], ['Zombie Thing']] };

interface Options { lists?: Spec[]; trip?: Trip | null; path?: string }

async function setup(options: Options = {}) {
  const storage = new MemoryStorage();
  (storage as { persistent: boolean }).persistent = true;
  for (const spec of options.lists ?? [DECK, ZOMBIES]) { const list = makeList(spec); await storage.put('lists', list.id, list); }
  if (options.trip !== null) await storage.put('trips', 'current', options.trip ?? startTrip('t1', T0, ['a', 'b']));
  const repo = new CardsRepository(storage);
  for (const card of Object.values(CARDS)) {
    await repo.put({ key: card.name.toLowerCase(), summary: fakeSummary({ name: card.name, typeLine: card.typeLine }), printings: card.printings, fetchedAt: T0.toISOString() });
  }
  window.history.replaceState(null, '', options.path ?? '/dive');
  const view = render(<App storage={storage} clock={() => T0} connector={fakeConnector([]).connector} />);
  return { storage, ...view };
}

const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const setWidth = (width: number) => act(() => { window.innerWidth = width; window.dispatchEvent(new Event('resize')); });
const tile = (name: string) => screen.getByText(name, { selector: 'div' }).closest('li') as HTMLElement;
const picker = () => screen.getByLabelText(t.pickerHint(true)) as HTMLSelectElement;
const savedTrip = async (storage: MemoryStorage) => (await storage.get<Trip>('trips', 'current'))!;
const onFoundations = () => screen.findByText(t.stopOf(1, 4));

beforeEach(() => window.history.replaceState(null, '', '/dive'));
afterEach(() => { setWidth(1024); window.history.replaceState(null, '', '/'); });

describe('Store dive: with no trip', () => {
  it('says there is no trip and points to the dive plan', async () => {
    await setup({ trip: null });
    expect(await screen.findByRole('heading', { name: t.noTrip.title })).toBeTruthy();
    press(t.noTrip.action);
    expect(window.location.pathname).toBe('/plan');
  });
});

describe('Store dive: a binder', () => {
  it('opens the first binder in walking order, and lists every binder in the picker with its size', async () => {
    await setup();
    await onFoundations();
    expect([...picker().options].map(o => o.textContent)).toEqual([
      t.option(1, 'Foundations', 5, false), t.option(2, 'Commander box', 2, false), t.option(3, 'Display case', 1, false), t.option(4, 'Ask an associate', 1, false),
    ]);
    expect(screen.getByText("Ajani's Pridemate")).toBeTruthy();
    expect(screen.queryByText('Command Tower')).toBeNull();
  });

  it('shows each card with its set and number, price and the lists that want it', async () => {
    await setup();
    await onFoundations();
    const ajani = tile("Ajani's Pridemate");
    expect(ajani.textContent).toContain('FDN 135');
    expect(ajani.textContent).toContain('$1.00');
    expect(ajani.textContent).toContain('Lifegain, Zombies');
  });

  it('Found marks a card and Undo takes it back, with progress counted in copies', async () => {
    const { storage } = await setup();
    await onFoundations();
    expect(screen.getByText(t.foundProgress(0, 5))).toBeTruthy();
    fireEvent.click(within(tile('Soul Warden')).getByRole('button', { name: copy.cardTile.found }));
    expect(screen.getByText(t.foundProgress(1, 5))).toBeTruthy();
    await waitFor(async () => expect((await savedTrip(storage)).found).toEqual({ 'soul warden': { a: 1 } }));
    fireEvent.click(within(tile('Soul Warden')).getByRole('button', { name: copy.cardTile.foundUndo }));
    expect(screen.getByText(t.foundProgress(0, 5))).toBeTruthy();
  });

  it('Found +1 on a card wanted several times fills the lists top to bottom, and the minus takes one back', async () => {
    const { storage } = await setup();
    await onFoundations();
    const ajani = () => tile("Ajani's Pridemate");
    for (let i = 0; i < 3; i++) fireEvent.click(within(ajani()).getByRole('button', { name: copy.cardTile.foundPlusOne }));
    await waitFor(async () => expect((await savedTrip(storage)).found["ajani's pridemate"]).toEqual({ a: 2, b: 1 }));
    expect(within(ajani()).getByText(copy.cardTile.allFound(3))).toBeTruthy();
    fireEvent.click(within(ajani()).getByRole('button', { name: copy.cardTile.undoOne("Ajani's Pridemate") }));
    await waitFor(async () => expect((await savedTrip(storage)).found["ajani's pridemate"]).toEqual({ a: 2, b: 0 }));
  });

  it('moves between binders with the arrows and the picker', async () => {
    await setup();
    await onFoundations();
    expect((screen.getByRole('button', { name: t.previous }) as HTMLButtonElement).disabled).toBe(true);
    press(t.next);
    expect(await screen.findByText(t.stopOf(2, 4))).toBeTruthy();
    expect(screen.getByText('Command Tower')).toBeTruthy();
    fireEvent.change(picker(), { target: { value: 'set:fdn' } });
    expect(await screen.findByText(t.stopOf(1, 4))).toBeTruthy();
  });

  it('Finish binder sends the cards not found to their next binder and opens the next one', async () => {
    const { storage } = await setup();
    await onFoundations();
    fireEvent.click(within(tile('Soul Warden')).getByRole('button', { name: copy.cardTile.found }));
    expect(screen.getByText(t.cardsLeft(4))).toBeTruthy();
    press(t.finishBinder);
    expect(await screen.findByText(t.finishedToast('Foundations'))).toBeTruthy();
    expect(await screen.findByText(t.stopOf(1, 3))).toBeTruthy();
    expect(screen.getByText('Command Tower')).toBeTruthy();
    await waitFor(async () => expect((await savedTrip(storage)).events).toEqual([{ type: 'finish', stopId: 'set:fdn', found: ['soul warden'] }]));
  });

  it('lists finished binders in the picker, and choosing one reopens it', async () => {
    await setup();
    await onFoundations();
    press(t.finishBinder);
    await screen.findByText(t.stopOf(1, 3));
    const groups = picker().querySelectorAll('optgroup');
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe(t.finishedGroup);
    fireEvent.change(picker(), { target: { value: 'finished:set:fdn' } });
    expect(await screen.findByText(t.reopened('Foundations'))).toBeTruthy();
    expect(await screen.findByText(t.stopOf(1, 4))).toBeTruthy();
    expect(screen.getByText("Ajani's Pridemate")).toBeTruthy();
  });

  it('turns a list off for the trip, taking its cards out', async () => {
    await setup();
    await onFoundations();
    expect(screen.getByText('Zombie Thing')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t.listChip('Zombies', 2) }));
    await waitFor(() => expect(screen.queryByText('Zombie Thing')).toBeNull());
    expect(screen.getByText(t.foundProgress(0, 3))).toBeTruthy();
  });

  it('sorts and filters the cards in a binder', async () => {
    await setup();
    await onFoundations();
    press(t.sortAndFilter);
    fireEvent.change(screen.getByLabelText(copy.filters.price.label), { target: { value: '5_up' } });
    expect(screen.queryByText("Ajani's Pridemate")).toBeNull();
    expect(screen.getByText('Zombie Thing')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(copy.filters.price.label), { target: { value: 'any' } });
    fireEvent.change(screen.getByLabelText(t.sort.label), { target: { value: 'price_desc' } });
    const names = screen.getAllByText(/Ajani|Soul Warden|Zombie Thing|Cultivate/, { selector: 'div' }).map(n => n.textContent);
    expect(names[0]).toBe('Zombie Thing');
  });

  it('says so when the filters hide every card', async () => {
    await setup();
    await onFoundations();
    press(t.sortAndFilter);
    fireEvent.change(screen.getByLabelText(copy.filters.price.label), { target: { value: '1_to_5' } });
    fireEvent.change(screen.getByLabelText(copy.filters.price.label), { target: { value: '5_up' } });
    fireEvent.click(screen.getByRole('button', { name: copy.colors.Red.name }));
    expect(screen.getByText(t.noMatches)).toBeTruthy();
  });

  it('keeps its place after a refresh: the trip is saved and read back', async () => {
    const { storage, unmount } = await setup();
    await onFoundations();
    fireEvent.click(within(tile('Soul Warden')).getByRole('button', { name: copy.cardTile.found }));
    await waitFor(async () => expect((await savedTrip(storage)).found).toEqual({ 'soul warden': { a: 1 } }));
    unmount();
    render(<App storage={storage} clock={() => T0} connector={fakeConnector([]).connector} />);
    expect(await screen.findByText(t.foundProgress(1, 5))).toBeTruthy();
  });

  it('says when every binder is done', async () => {
    await setup({ lists: [{ ...DECK, cards: [['Soul Warden']] }], trip: startTrip('t', T0, ['a']) });
    await screen.findByText(t.stopOf(1, 1));
    press(t.finishBinder);
    expect(await screen.findByRole('heading', { name: t.allDone.title })).toBeTruthy();
  });
});

describe('Store dive: a counter stop', () => {
  const toDisplayCase = async () => {
    await setup();
    await onFoundations();
    fireEvent.change(picker(), { target: { value: 'case' } });
    await screen.findByRole('heading', { name: 'Display case' });
  };

  it('shows the card as a tile in the same gallery, with the printing, price and the staff label', async () => {
    await toDisplayCase();
    expect(screen.getByText(copy.verdict.show_staff)).toBeTruthy();
    const card = tile('Lightning Greaves');
    expect(card.textContent).toContain('RNA 9');
    expect(card.textContent).toContain('$18.50');
    expect(screen.getByText(c.cards(1))).toBeTruthy();
  });

  it('Found marks the card, with Undo', async () => {
    await toDisplayCase();
    press(c.found);
    expect(screen.getByRole('button', { name: c.foundUndo })).toBeTruthy();
    press(c.foundUndo);
    expect(screen.getByRole('button', { name: c.found })).toBeTruthy();
  });

  it('Not available marks the card, and Found can still be pressed', async () => {
    await toDisplayCase();
    press(c.notAvailableLabel('Lightning Greaves'));
    expect(screen.getByText(c.notAvailable)).toBeTruthy();
    press(c.found);
    expect(screen.getByRole('button', { name: c.foundUndo })).toBeTruthy();
  });

  it('does not call a card found when only some copies are: it says how many, and Found +1 finds the rest', async () => {
    const { storage } = await setup({
      lists: [{ ...DECK, cards: [['Lightning Greaves', 2]] }],
      trip: { ...startTrip('t', T0, ['a']), found: { 'lightning greaves': { a: 1 } } },
    });
    await screen.findByRole('heading', { name: 'Display case' });
    expect(screen.getByText(copy.progress.copiesOf(1, 2))).toBeTruthy();
    expect(screen.queryByRole('button', { name: copy.cardTile.foundUndo })).toBeNull();
    press(copy.cardTile.foundPlusOne);
    expect(screen.getByText(copy.cardTile.allFound(2))).toBeTruthy();
    await waitFor(async () => expect((await savedTrip(storage)).found['lightning greaves']).toEqual({ a: 2 }));
  });

  it('shows the cards still wanted in big text, and closes', async () => {
    await toDisplayCase();
    press(c.bigText);
    const dialog = screen.getByRole('dialog', { name: copy.storeDive.bigText.title });
    expect(within(dialog).getByText('Lightning Greaves')).toBeTruthy();
    expect(within(dialog).getByText(copy.storeDive.bigText.count(1))).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: copy.storeDive.bigText.close }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('leaves found cards out of the big text', async () => {
    await toDisplayCase();
    press(c.found);
    press(c.bigText);
    expect(within(screen.getByRole('dialog')).queryByText('Lightning Greaves')).toBeNull();
  });

  it('gives bulk-box and value-binder hints on the ask-an-associate stop, sorted A to Z', async () => {
    await setup();
    await onFoundations();
    fireEvent.change(picker(), { target: { value: 'ask' } });
    await screen.findByRole('heading', { name: 'Ask an associate' });
    const card = tile('Old Bulk');
    expect(card.textContent).toContain('OLD 7');
    expect(card.textContent).toContain(c.hint['bulk boxes']);
    expect(screen.getByText(copy.storeDive.sortedAz, { exact: false })).toBeTruthy();
  });

  it('Done at the counter finishes the stop', async () => {
    const { storage } = await setup();
    await onFoundations();
    fireEvent.change(picker(), { target: { value: 'case' } });
    await screen.findByRole('heading', { name: 'Display case' });
    press(c.done);
    expect(await screen.findByText(c.doneToast('Display case'))).toBeTruthy();
    await waitFor(async () => expect((await savedTrip(storage)).events.map(e => e.stopId)).toEqual(['case']));
  });
});

describe('Store dive: the table view at a counter', () => {
  const toTable = async () => {
    await setup();
    await onFoundations();
    fireEvent.change(picker(), { target: { value: 'ask' } });
    await screen.findByRole('heading', { name: 'Ask an associate' });
    fireEvent.click(screen.getByRole('button', { name: c.view.table }));
  };

  it('offers Gallery and Table, with the gallery first, and Big text beside them', async () => {
    await setup();
    await onFoundations();
    fireEvent.change(picker(), { target: { value: 'ask' } });
    await screen.findByRole('heading', { name: 'Ask an associate' });
    const group = screen.getByRole('group', { name: c.view.label });
    expect(within(group).getByRole('button', { name: c.view.gallery }).getAttribute('aria-pressed')).toBe('true');
    expect(within(group).getByRole('button', { name: c.view.table }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: c.bigText })).toBeTruthy();
  });

  it('shows the cards as rows with the name large, the printing, price and the hint', async () => {
    await toTable();
    expect(screen.getByRole('button', { name: c.view.table }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/Old Set · OLD 7 · \$0\.30 · likely in bulk boxes/)).toBeTruthy();
  });

  it('Found, Undo and Not available work in rows', async () => {
    await toTable();
    fireEvent.click(screen.getByRole('button', { name: 'Old Bulk: Found' }));
    expect(screen.getByRole('button', { name: `Old Bulk: ${c.foundUndo}` })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: `Old Bulk: ${c.foundUndo}` }));
    fireEvent.click(screen.getByRole('button', { name: c.notAvailableLabel('Old Bulk') }));
    expect(screen.getByText(c.notAvailable)).toBeTruthy();
  });

  it('remembers the choice on this device, so it is the Table next time', async () => {
    const { storage, unmount } = await setup();
    await onFoundations();
    fireEvent.change(picker(), { target: { value: 'ask' } });
    await screen.findByRole('heading', { name: 'Ask an associate' });
    fireEvent.click(screen.getByRole('button', { name: c.view.table }));
    await waitFor(async () => expect(await storage.get('settings', 'pref:counter-view')).toBe('table'));
    unmount();
    render(<App storage={storage} clock={() => T0} connector={fakeConnector([]).connector} />);
    await onFoundations();
    fireEvent.change(picker(), { target: { value: 'ask' } });
    await screen.findByRole('heading', { name: 'Ask an associate' });
    await waitFor(() => expect(screen.getByRole('button', { name: c.view.table }).getAttribute('aria-pressed')).toBe('true'));
  });

  it('goes back to the gallery', async () => {
    await toTable();
    fireEvent.click(screen.getByRole('button', { name: c.view.gallery }));
    expect(screen.getByRole('button', { name: copy.cardTile.found })).toBeTruthy();
  });

  it('a card wanted several times shows Found +1 and how many are found', async () => {
    await setup({ lists: [{ ...DECK, cards: [['Lightning Greaves', 2]] }], trip: { ...startTrip('t', T0, ['a']), found: { 'lightning greaves': { a: 1 } } } });
    await screen.findByRole('heading', { name: 'Display case' });
    fireEvent.click(screen.getByRole('button', { name: c.view.table }));
    expect(screen.getByText(c.foundCount(1, 2), { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: `Lightning Greaves: ${copy.cardTile.foundPlusOne}` }));
    expect(screen.getByRole('button', { name: `Lightning Greaves: ${c.foundUndo}` })).toBeTruthy();
  });
});

describe('Store dive: basic lands', () => {
  const FOREST_DECK: Spec = { id: 'a', name: 'Lifegain', cards: [['Forest', 3], ['Soul Warden']] };

  it('says basic lands are left off the hunt, with a button to include them', async () => {
    const { storage } = await setup({ lists: [FOREST_DECK], trip: startTrip('t', T0, ['a']) });
    expect(await screen.findByText(copy.basicsNote.title(1))).toBeTruthy();
    expect(screen.queryByText('Forest', { selector: 'div' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: copy.basicsNote.action }));
    await waitFor(() => expect(screen.queryByText(copy.basicsNote.title(1))).toBeNull());
    expect(tile('Forest').textContent).toContain('FDN 280');
    await waitFor(async () => expect((await storage.get<{ includeBasicLands: boolean }>('settings', 'store-settings'))!.includeBasicLands).toBe(true));
  });

  it('says nothing when the list has no basic lands', async () => {
    await setup();
    await onFoundations();
    expect(screen.queryByText(copy.basicsNote.action)).toBeNull();
  });

  it('shows the same note on the dive plan', async () => {
    await setup({ lists: [FOREST_DECK], trip: null, path: '/plan' });
    expect(await screen.findByText(copy.basicsNote.title(1))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: copy.basicsNote.action }));
    await waitFor(() => expect(screen.queryByText(copy.basicsNote.title(1))).toBeNull());
  });
});

describe('Ending the trip', () => {
  it('asks first, with how many binders were searched and how many cards are still needed', async () => {
    await setup();
    await onFoundations();
    press(copy.storeDive.endTrip);
    expect(screen.getByText(t.endDialog.body(0, 4, 9))).toBeTruthy();
    press(t.endDialog.keep);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.location.pathname).toBe('/dive');
  });

  it('ends the trip and shows what was found and what is left', async () => {
    const { storage } = await setup();
    await onFoundations();
    fireEvent.click(within(tile('Soul Warden')).getByRole('button', { name: copy.cardTile.found }));
    press(t.finishBinder);
    await screen.findByText(t.stopOf(1, 3));
    press(copy.storeDive.endTrip);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: t.endDialog.end }));
    expect(await screen.findByRole('heading', { name: copy.tripEnd.title })).toBeTruthy();
    expect(window.location.pathname).toBe('/trip');
    expect(screen.getByText(copy.tripEnd.found(1, 1))).toBeTruthy();
    expect(screen.getByText(copy.tripEnd.left(8))).toBeTruthy();
    expect((await savedTrip(storage)).endedAt).toBe(T0.toISOString());
  });

  it('copies the leftovers as quantity and name lines for TCGplayer Mass Entry', async () => {
    let copied = '';
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text: string) => { copied = text; } }, configurable: true });
    await setup({ lists: [{ ...DECK, cards: [['Soul Warden'], ['Cultivate', 2]] }], trip: { ...startTrip('t', T0, ['a']), endedAt: T0.toISOString() }, path: '/trip' });
    const button = await screen.findByRole('button', { name: copy.tripEnd.buy.copy(3) });
    fireEvent.click(button);
    await waitFor(() => expect(copied).toBe('1 Soul Warden\n2 Cultivate'));
    expect(await screen.findByText(copy.tripEnd.buy.copied)).toBeTruthy();
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });

  it('offers to find game stores nearby, opening a Google Maps search in a new tab and nothing else', async () => {
    const opened: unknown[][] = [];
    const original = window.open;
    window.open = ((...args: unknown[]) => { opened.push(args); return null; }) as typeof window.open;
    try {
      await setup({ trip: { ...startTrip('t', T0, ['a']), endedAt: T0.toISOString() }, path: '/trip' });
      expect(await screen.findByText(copy.tripEnd.stores.detail)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: copy.tripEnd.stores.action }));
      expect(opened).toEqual([[NEARBY_STORES_URL, '_blank', 'noopener,noreferrer']]);
      expect(NEARBY_STORES_URL.startsWith('https://www.google.com/maps/search/')).toBe(true);
    } finally {
      window.open = original;
    }
  });

  it('Start a new trip clears the old one and goes to the dive plan', async () => {
    const { storage } = await setup({ trip: { ...startTrip('t', T0, ['a']), endedAt: T0.toISOString() }, path: '/trip' });
    fireEvent.click(await screen.findByRole('button', { name: copy.tripEnd.newTrip }));
    expect(window.location.pathname).toBe('/plan');
    await waitFor(async () => expect(await storage.get('trips', 'current')).toBeUndefined());
  });

  it('Back to my lists goes to My lists', async () => {
    await setup({ trip: { ...startTrip('t', T0, ['a']), endedAt: T0.toISOString() }, path: '/trip' });
    fireEvent.click(await screen.findByRole('button', { name: copy.tripEnd.backToLists }));
    expect(window.location.pathname).toBe('/lists');
  });

  it('says there is nothing left when every card was found', async () => {
    await setup({
      lists: [{ ...DECK, cards: [['Soul Warden']] }],
      trip: { ...startTrip('t', T0, ['a']), found: { 'soul warden': { a: 1 } }, endedAt: T0.toISOString() },
      path: '/trip',
    });
    expect(await screen.findByText(copy.tripEnd.nothingLeft, { selector: 'p' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Copy/ })).toBeNull();
  });

  it('opening the store dive after the trip ended goes to the summary', async () => {
    await setup({ trip: { ...startTrip('t', T0, ['a']), endedAt: T0.toISOString() }, path: '/dive' });
    await waitFor(() => expect(window.location.pathname).toBe('/trip'));
  });
});
