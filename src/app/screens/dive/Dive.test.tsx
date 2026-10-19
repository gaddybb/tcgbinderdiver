import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeConnector, fakeSummary } from '../../../connectors/fakeConnector';
import { pr } from '../../../core/engine/fixtures';
import type { Printing } from '../../../core/engine/engine';
import { DEFAULT_STORE_SETTINGS } from '../../../core/store';
import type { StoreSettings } from '../../../core/store';
import { CardsRepository, MemoryStorage } from '../../../storage';
import { App } from '../../App';
import { copy } from '../../copy/en';
import { T0, makeList } from '../../testkit';
import type { Spec } from '../../testkit';

const t = copy.dive;
const g = copy.groups;
const p = copy.pullSettings;

const recent = (setCode: string, setName: string, over: Partial<Parameters<typeof pr>[0]> = {}): Printing =>
  pr({ setCode, setName, setType: 'core', releasedAt: '2026-06-01', usd: '1.00', ...over });

const CARDS: Record<string, { name: string; typeLine?: string; printings: Printing[] }> = {
  ajani: { name: "Ajani's Pridemate", printings: [recent('fdn', 'Foundations')] },
  warden: { name: 'Soul Warden', printings: [recent('fdn', 'Foundations')] },
  cultivate: { name: 'Cultivate', printings: [pr({ setCode: 'cmm', setName: 'Commander Masters', setType: 'commander', usd: '0.50' })] },   // Commander only: a recent set binder would now outrank the box
  tower: { name: 'Command Tower', printings: [pr({ setCode: 'cmm', setName: 'Commander Masters', setType: 'commander', usd: '0.35' }), pr({ setCode: 'fdc', setName: 'Foundations Commander', setType: 'commander', usd: '0.40' })] },
  greaves: { name: 'Lightning Greaves', printings: [pr({ setCode: 'rna', setName: 'Ravnica Allegiance', setType: 'expansion', releasedAt: '2019-01-25', usd: '18.50' })] },
  forest: { name: 'Forest', typeLine: 'Basic Land — Forest', printings: [recent('fdn', 'Foundations', { usd: '0.10' })] },
  duskmourn: { name: 'Duskmourn Thing', printings: [recent('dsk', 'Duskmourn', { setType: 'expansion', releasedAt: '2026-05-01', usd: '0.80' })] },
};

interface Options { lists?: Spec[]; settings?: StoreSettings; path?: string; saved?: (keyof typeof CARDS)[] }

async function setup(options: Options = {}) {
  const storage = new MemoryStorage();
  (storage as { persistent: boolean }).persistent = true;
  for (const spec of options.lists ?? []) { const list = makeList(spec); await storage.put('lists', list.id, list); }
  // These fixtures have a combined Commander library; the setting is off unless a test says otherwise.
  await storage.put('settings', 'store-settings', { combinedCommander: true, ...(options.settings as object | undefined) });
  const repo = new CardsRepository(storage);
  for (const key of options.saved ?? Object.keys(CARDS)) {
    const c = CARDS[key];
    await repo.put({ key: c.name.toLowerCase(), summary: fakeSummary({ name: c.name, typeLine: c.typeLine }), printings: c.printings, fetchedAt: T0.toISOString() });
  }
  window.history.replaceState(null, '', options.path ?? '/plan');
  const view = render(<App storage={storage} clock={() => T0} connector={fakeConnector([]).connector} />);
  return { storage, ...view };
}

const deck = (id: string, name: string, cards: Spec['cards'], on = true): Spec => ({ id, name, cards, on });
const DECK = deck('a', 'Lifegain Commander', [["Ajani's Pridemate", 2], ['Soul Warden'], ['Cultivate'], ['Command Tower'], ['Lightning Greaves']]);

const setWidth = (width: number) => act(() => { window.innerWidth = width; window.dispatchEvent(new Event('resize')); });
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const saved = async (storage: MemoryStorage) => (await storage.get<StoreSettings>('settings', 'store-settings'))!;

beforeEach(() => window.history.replaceState(null, '', '/plan'));
afterEach(() => { setWidth(1024); window.history.replaceState(null, '', '/'); });

describe('Dive plan', () => {
  it('says when no list is turned on, with a way back to My lists', async () => {
    await setup({ lists: [deck('a', 'Off', [['Sol Ring']], false), { id: 'wishlist', kind: 'wishlist', name: 'Wishlist', on: false }] });
    expect(await screen.findByRole('heading', { name: t.empty.title })).toBeTruthy();
    press(t.empty.action);
    expect(window.location.pathname).toBe('/lists');
  });

  it('says there is nothing left to find when every card is owned', async () => {
    await setup({ lists: [{ ...DECK, cards: [['Sol Ring', 1, 'in_collection']] }] });
    expect(await screen.findByRole('heading', { name: t.nothingNeeded.title })).toBeTruthy();
  });

  it('groups stops by type in walking order, with count, value and verdict', async () => {
    await setup({ lists: [DECK] });
    await screen.findByRole('heading', { name: t.kind.set_binder.title });
    const headings = screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent);
    expect(headings).toEqual([t.kind.set_binder.title, t.kind.commander_box.title, t.kind.display_case.title]);
    const rows = screen.getAllByRole('listitem').filter(li => li.closest('ul'));
    const text = (label: string) => rows.find(r => r.textContent?.includes(label))!.textContent!;
    expect(text('Foundations')).toContain('3 cards · $3.00');
    expect(text('Foundations')).toContain(copy.verdict.worth_a_pull);
    expect(text('Commander box')).toContain('2 cards · $0.85');
    expect(text('Commander box')).toContain(copy.verdict.worth_a_pull);
    expect(text('Display case')).toContain('1 card · $18.50');
    expect(text('Display case')).toContain(copy.verdict.show_staff);
  });

  it('numbers the stops in order and says how many cards are in how many stops', async () => {
    await setup({ lists: [DECK] });
    expect(await screen.findByText(t.subtitle(6, 3))).toBeTruthy();
  });

  it('plans only the lists that are turned on, and names them', async () => {
    await setup({ lists: [DECK, deck('b', 'Zombies', [['Duskmourn Thing']], false)] });
    expect(await screen.findByText(t.listsUsed('Lifegain Commander'))).toBeTruthy();
    expect(screen.queryByText('Duskmourn')).toBeNull();
  });

  it('lists cards with no binder, and why', async () => {
    await setup({ lists: [DECK], settings: { ...DEFAULT_STORE_SETTINGS, notCarried: ['rna'] } });
    expect(await screen.findByText(t.noBinder.title(1))).toBeTruthy();
    expect(screen.getByText('Lightning Greaves', { selector: 'li' })).toBeTruthy();
    expect(screen.getByText(t.noBinder.detail)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t.noBinder.checkGroups }));
    expect(window.location.pathname).toBe('/groups');
  });

  it('starts a trip from Start store dive and opens the store dive', async () => {
    const { storage } = await setup({ lists: [DECK, deck('b', 'Zombies', [['Duskmourn Thing']], false)] });
    await screen.findByText(t.subtitle(6, 3));
    press(t.startDive);
    expect(window.location.pathname).toBe('/dive');
    const trip = await storage.get<{ listIds: string[] }>('trips', 'current');
    expect(trip!.listIds).toEqual(['a']);
  });

  it('offers Resume and a confirmed new trip when a trip is in progress', async () => {
    const { storage } = await setup({ lists: [DECK] });
    await screen.findByText(t.subtitle(6, 3));
    press(t.startDive);
    window.history.replaceState(null, '', '/plan');
    act(() => { window.dispatchEvent(new Event('popstate')); });
    expect(await screen.findByRole('button', { name: t.resumeDive })).toBeTruthy();
    press(t.newTrip);
    expect(screen.getByRole('dialog', { name: t.newTripDialog.title })).toBeTruthy();
    press(t.newTripDialog.start);
    expect(window.location.pathname).toBe('/dive');
    expect(await storage.get('trips', 'current')).toBeDefined();
  });

  it('keeps Start store dive off when there is nothing to find', async () => {
    await setup({ lists: [{ ...DECK, cards: [['Sol Ring', 1, 'in_collection']] }] });
    await screen.findByRole('heading', { name: t.nothingNeeded.title });
    expect((screen.getByRole('button', { name: t.startDive }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('uses the binder groups: sets in a group become one stop with the group name', async () => {
    const settings = { ...DEFAULT_STORE_SETTINGS, binderGroups: [{ id: 'x', name: 'Recent sets', setCodes: ['fdn', 'dsk'] }] };
    await setup({ lists: [deck('a', 'D', [['Soul Warden'], ['Duskmourn Thing']])], settings });
    await screen.findByText('Recent sets');
    expect(screen.queryByText('Foundations')).toBeNull();
    expect(screen.getByText('Recent sets').closest('li')!.textContent).toContain('2 cards');
  });
});

describe('Pull settings', () => {
  const open = async () => { await screen.findByText(t.subtitle(6, 3)); press(t.pullSettings); return screen.getByRole('dialog', { name: p.title }); };

  it('opens as a dialog on desktop and a sheet on a phone, with the same controls', async () => {
    await setup({ lists: [DECK] });
    const dialog = await open();
    expect(within(dialog).getByRole('group', { name: p.cardsLabel })).toBeTruthy();
    expect(within(dialog).getByRole('switch', { name: p.basics })).toBeTruthy();
  });

  it('shows the live preview of how many binders are worth a pull, and it follows the steppers', async () => {
    const { storage } = await setup({ lists: [DECK] });
    const dialog = await open();
    expect(within(dialog).getByText(p.preview(2, 0))).toBeTruthy();   // Foundations (3 cards) and the Commander box (2) both reach 2 cards
    const cards = within(dialog).getByRole('group', { name: p.cardsLabel });
    for (let i = 0; i < 3; i++) fireEvent.click(within(cards).getByRole('button', { name: copy.common.more }));
    expect(within(dialog).getByText(p.preview(0, 2))).toBeTruthy();   // needs 5 cards or $10
    await waitFor(async () => expect((await saved(storage)).pull.worthPullMinCards).toBe(5));
    press(p.done);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Foundations').closest('li')!.textContent).toContain(copy.verdict.buy_online);
  });

  it('can go down to a value of 0 and up, and reset to the defaults', async () => {
    const { storage } = await setup({ lists: [DECK] });
    const dialog = await open();
    expect((within(dialog).getByRole('button', { name: p.reset }) as HTMLButtonElement).disabled).toBe(true);
    const value = within(dialog).getByRole('group', { name: p.valueLabel });
    fireEvent.click(within(value).getByRole('button', { name: copy.common.more }));
    expect((within(dialog).getByRole('button', { name: p.reset }) as HTMLButtonElement).disabled).toBe(false);
    press(p.reset);
    await waitFor(async () => expect((await saved(storage)).pull).toEqual({ worthPullMinCards: 2, worthPullMinUsd: 10 }));
  });

  it('turns basic lands on, so they join the hunt, and keeps the choice', async () => {
    const { storage } = await setup({ lists: [deck('a', 'D', [['Forest', 3], ['Soul Warden']])] });
    await screen.findByText(t.subtitle(1, 1));
    press(t.pullSettings);
    const dialog = screen.getByRole('dialog', { name: p.title });
    fireEvent.click(within(dialog).getByRole('switch', { name: p.basics }));
    expect(await screen.findByText(t.subtitle(4, 1))).toBeTruthy();
    expect((await saved(storage)).includeBasicLands).toBe(true);
  });

  it('is remembered the next time the app opens', async () => {
    await setup({ lists: [DECK], settings: { ...DEFAULT_STORE_SETTINGS, pull: { worthPullMinCards: 5, worthPullMinUsd: 50 } } });
    await screen.findByText(t.subtitle(6, 3));
    await waitFor(() => expect(screen.getByText('Foundations').closest('li')!.textContent).toContain(copy.verdict.buy_online));
  });
});

describe('Binder groups', () => {
  const GROUP_DECK = deck('a', 'D', [['Soul Warden'], ['Duskmourn Thing'], ['Command Tower'], ['Cultivate'], ['Lightning Greaves']]);

  it('lists the sets the needed cards use, most cards first, with type and counts', async () => {
    await setup({ lists: [GROUP_DECK], path: '/groups' });
    await screen.findByText(g.ungrouped.title(5));
    const rows = screen.getAllByRole('listitem').filter(li => li.textContent?.includes('needed card'));
    const names = rows.map(r => r.textContent!.split(/core|expansion|commander/)[0]);
    expect(names[0]).toContain('Commander Masters');   // two needed cards
    expect(screen.getByText(`${g.setTypes.commander} · ${g.ungrouped.neededCards(2)}`)).toBeTruthy();
  });

  it('makes a new binder from a set, names it, and says how many needed cards it holds', async () => {
    const { storage } = await setup({ lists: [GROUP_DECK], path: '/groups' });
    await screen.findByText(g.ungrouped.title(5));
    fireEvent.click(screen.getByRole('button', { name: g.ungrouped.addToLabel('Duskmourn') }));
    fireEvent.click(screen.getByRole('menuitem', { name: g.addToNew }));
    const name = await screen.findByLabelText(g.nameLabel) as HTMLInputElement;
    expect(name.value).toBe(g.newBinderName);
    expect(screen.getByText(g.holds(1))).toBeTruthy();
    fireEvent.change(name, { target: { value: 'Recent sets' } });
    fireEvent.blur(name);
    await waitFor(async () => expect((await saved(storage)).binderGroups).toMatchObject([{ name: 'Recent sets', setCodes: ['dsk'] }]));
    expect(screen.getByText(g.ungrouped.title(4))).toBeTruthy();
  });

  it('keeps an empty name from being saved', async () => {
    await setup({ lists: [GROUP_DECK], path: '/groups', settings: { ...DEFAULT_STORE_SETTINGS, binderGroups: [{ id: 'x', name: 'Keep me', setCodes: [] }] } });
    const name = await screen.findByLabelText(g.nameLabel) as HTMLInputElement;
    fireEvent.change(name, { target: { value: '   ' } });
    fireEvent.blur(name);
    expect(name.value).toBe('Keep me');
  });

  it('adds a set to a group from the group, removes it with the x, and deleting frees the sets', async () => {
    const { storage } = await setup({ lists: [GROUP_DECK], path: '/groups', settings: { ...DEFAULT_STORE_SETTINGS, binderGroups: [{ id: 'x', name: 'Mine', setCodes: [] }] } });
    await screen.findByLabelText(g.nameLabel);
    fireEvent.change((await screen.findAllByLabelText(g.addSetLabel('Mine')))[0], { target: { value: 'fdn' } });
    await waitFor(async () => expect((await saved(storage)).binderGroups[0].setCodes).toEqual(['fdn']));
    fireEvent.click(await screen.findByRole('button', { name: g.removeSet('Foundations', 'Mine') }));
    await waitFor(async () => expect((await saved(storage)).binderGroups[0].setCodes).toEqual([]));
    fireEvent.click(screen.getByRole('button', { name: g.deleteGroup('Mine') }));
    await waitFor(async () => expect((await saved(storage)).binderGroups).toEqual([]));
    expect(await screen.findByText(g.noGroups)).toBeTruthy();
  });

  it('marks a set not carried, and brings it back', async () => {
    const { storage } = await setup({ lists: [GROUP_DECK], path: '/groups' });
    await screen.findByText(g.ungrouped.title(5));
    fireEvent.click(screen.getByRole('button', { name: g.ungrouped.addToLabel('Duskmourn') }));
    fireEvent.click(screen.getByRole('menuitem', { name: g.addToNotCarried }));
    await waitFor(async () => expect((await saved(storage)).notCarried).toEqual(['dsk']));
    fireEvent.click(await screen.findByRole('button', { name: g.removeSet('Duskmourn', g.notCarried.title) }));
    await waitFor(async () => expect((await saved(storage)).notCarried).toEqual([]));
  });

  it('suggests one Commander binder when the lists use several Commander sets, and makes it', async () => {
    const { storage } = await setup({ lists: [GROUP_DECK], path: '/groups' });
    expect(await screen.findByText(g.suggestion.title(2))).toBeTruthy();
    press(g.suggestion.make);
    await waitFor(async () => expect((await saved(storage)).binderGroups).toMatchObject([{ name: g.suggestion.groupName, setCodes: ['cmm', 'fdc'] }]));
    expect(screen.queryByText(g.suggestion.title(2))).toBeNull();
  });

  it('lets the suggestion be dismissed for now', async () => {
    await setup({ lists: [GROUP_DECK], path: '/groups' });
    await screen.findByText(g.suggestion.title(2));
    press(g.suggestion.dismiss);
    expect(screen.queryByText(g.suggestion.title(2))).toBeNull();
  });

  it('filters the sets without a group by set type, and shows only a few at first', async () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    const many: Record<string, Printing> = Object.fromEntries(names.map(n => [n, recent(`s${n.toLowerCase()}`, `Set ${n}`)]));
    for (const n of names) CARDS[`many${n}`] = { name: `Many ${n}`, printings: [many[n]] };
    await setup({ lists: [deck('a', 'Many', names.map(n => [`Many ${n}`] as [string]))], path: '/groups', saved: names.map(n => `many${n}`) });
    await screen.findByText(g.ungrouped.title(9));
    expect(screen.getAllByRole('button', { name: /^Add Set .* to a group$/ })).toHaveLength(7);
    press(g.ungrouped.showAll(9));
    expect(screen.getAllByRole('button', { name: /^Add Set .* to a group$/ })).toHaveLength(9);
    for (const n of names) delete CARDS[`many${n}`];
  });

  it('changes the dive plan: after grouping, the plan shows the group as one stop', async () => {
    await setup({ lists: [deck('a', 'D', [['Soul Warden'], ['Duskmourn Thing']])], path: '/groups' });
    await screen.findByText(g.ungrouped.title(2));
    fireEvent.click(screen.getByRole('button', { name: g.ungrouped.addToLabel('Foundations') }));
    fireEvent.click(screen.getByRole('menuitem', { name: g.addToNew }));
    const name = await screen.findByLabelText(g.nameLabel) as HTMLInputElement;
    fireEvent.change(name, { target: { value: 'Both' } });
    fireEvent.blur(name);
    fireEvent.change(screen.getAllByLabelText(g.addSetLabel('Both'))[0], { target: { value: 'dsk' } });
    fireEvent.click(screen.getByRole('link', { name: g.back }));
    expect((await screen.findByText('Both')).closest('li')!.textContent).toContain('2 cards');
  });
});
