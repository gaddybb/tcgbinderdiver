import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeConnector, fakeSummary } from '../../../connectors/fakeConnector';
import type { Printing } from '../../../core/engine/engine';
import { pr } from '../../../core/engine/fixtures';
import type { CardList } from '../../../core/lists';
import { startTrip } from '../../../core/trip';
import type { Trip } from '../../../core/trip';
import { CardsRepository, MemoryStorage } from '../../../storage';
import { App } from '../../App';
import { copy } from '../../copy/en';
import { T0, makeList } from '../../testkit';
import type { Spec } from '../../testkit';

const t = copy.cardDetail;

const recent = (setCode: string, setName: string, over: Partial<Parameters<typeof pr>[0]> = {}): Printing =>
  pr({ setCode, setName, setType: 'core', releasedAt: '2026-06-01', usd: '1.00', ...over });

const CARDS: Record<string, { name: string; typeLine?: string; printings: Printing[] }> = {
  ajani: {
    name: "Ajani's Pridemate",
    printings: [
      recent('fdn', 'Foundations', { collectorNumber: '135', usd: '0.25', rarity: 'uncommon' }),
      pr({ setCode: 'cmm', setName: 'Commander Masters', setType: 'commander', collectorNumber: '15', usd: '0.30', rarity: 'uncommon' }),
      pr({ setCode: 'mtgo', setName: 'Online Set', digital: true, games: ['mtgo'], usd: '0.10' }),
    ],
  },
  warden: { name: 'Soul Warden', printings: [recent('fdn', 'Foundations', { collectorNumber: '24' })] },
  elves: { name: 'Llanowar Elves', printings: [recent('fdn', 'Foundations', { collectorNumber: '227', usd: '0.30' })] },
};

const DECK: Spec = { id: 'a', name: 'Lifegain', cards: [["Ajani's Pridemate", 2], ['Soul Warden']] };
const STORE: Spec = { id: 'a', name: 'Lifegain', cards: [['Soul Warden'], ['Llanowar Elves', 2]] };
const ELVES: Spec = { id: 'a', name: 'Elves', cards: [['Llanowar Elves', 3]] };
const WISH: Spec = { id: 'b', name: 'Wishlist', kind: 'wishlist', cards: [['Llanowar Elves', 1]] };

async function setup(path: string, lists: Spec[], trip?: Trip) {
  const storage = new MemoryStorage();
  (storage as { persistent: boolean }).persistent = true;
  for (const spec of lists) { const list = makeList(spec); await storage.put('lists', list.id, list); }
  if (trip) await storage.put('trips', 'current', trip);
  const repo = new CardsRepository(storage);
  for (const card of Object.values(CARDS)) {
    await repo.put({ key: card.name.toLowerCase(), summary: fakeSummary({ name: card.name, typeLine: card.typeLine }), printings: card.printings, fetchedAt: T0.toISOString() });
  }
  window.history.replaceState(null, '', path);
  render(<App storage={storage} clock={() => T0} connector={fakeConnector([]).connector} />);
  return { storage };
}

const setWidth = (width: number) => act(() => { window.innerWidth = width; window.dispatchEvent(new Event('resize')); });
const dialog = () => screen.findByRole('dialog');
const savedList = async (storage: MemoryStorage, id: string) => (await storage.get<CardList>('lists', id))!;
const savedTrip = async (storage: MemoryStorage) => (await storage.get<Trip>('trips', 'current'))!;

beforeEach(() => setWidth(1024));
afterEach(() => { setWidth(1024); window.history.replaceState(null, '', '/'); });

describe('Card detail from the list review', () => {
  it('opens from a card name in the table, with where to look first, the other places and every paper printing', async () => {
    await setup('/lists/a', [DECK]);
    fireEvent.click(await screen.findByRole('button', { name: copy.cardTile.openCard("Ajani's Pridemate") }));
    const panel = within(await dialog());
    expect(panel.getByRole('heading', { name: "Ajani's Pridemate" })).toBeTruthy();
    const first = panel.getAllByText(t.lookFirst)[0].parentElement as HTMLElement;
    // The engine prefers the Commander printing for this card; the Foundations binder is the next place.
    expect(first.textContent).toContain('Commander box');
    expect(first.textContent).toContain('CMM 15');
    const alsoTry = within(panel.getByRole('heading', { name: t.alsoTry }).parentElement as HTMLElement);
    expect(alsoTry.getByText('Foundations')).toBeTruthy();
    expect(alsoTry.getByText('2')).toBeTruthy();   // its place in the order, not odds
    // Two paper printings; the online-only one is left out.
    expect(panel.getByText(t.printings(2))).toBeTruthy();
    expect(panel.getByText('Commander Masters')).toBeTruthy();
    expect(panel.queryByText('Online Set')).toBeNull();
  });

  it('never shows odds labels', async () => {
    await setup('/lists/a', [DECK]);
    fireEvent.click(await screen.findByRole('button', { name: copy.cardTile.openCard("Ajani's Pridemate") }));
    const panel = await dialog();
    expect(panel.textContent).not.toMatch(/odds|long shot|chance|probab/i);
  });

  it('shows the quantity and the status, and changes them on this list', async () => {
    const { storage } = await setup('/lists/a', [DECK]);
    fireEvent.click(await screen.findByRole('button', { name: copy.cardTile.openCard("Ajani's Pridemate") }));
    const panel = within(await dialog());
    const stepper = panel.getByRole('group', { name: t.quantityLabel("Ajani's Pridemate") });
    expect(within(stepper).getByText('2')).toBeTruthy();
    fireEvent.click(within(stepper).getByRole('button', { name: copy.common.more }));
    await waitFor(async () => expect((await savedList(storage, 'a')).entries[0].quantity).toBe(3));

    fireEvent.click(panel.getByRole('button', { name: copy.statusPicker.label("Ajani's Pridemate", copy.status.needed) }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: new RegExp(copy.status.in_collection) }));
    await waitFor(async () => expect((await savedList(storage, 'a')).entries[0].status).toBe('in_collection'));
  });

  it('walks to the next and previous card, and closes with the close button or Escape', async () => {
    await setup('/lists/a', [DECK]);
    fireEvent.click(await screen.findByRole('button', { name: copy.cardTile.openCard("Ajani's Pridemate") }));
    let panel = within(await dialog());
    expect(panel.getByText(t.position(1, 2))).toBeTruthy();
    expect((panel.getByRole('button', { name: t.previous }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(panel.getByRole('button', { name: t.next }));
    panel = within(await dialog());
    expect(panel.getByRole('heading', { name: 'Soul Warden' })).toBeTruthy();
    expect(panel.getByText(t.position(2, 2))).toBeTruthy();
    expect((panel.getByRole('button', { name: t.next }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(panel.getByRole('button', { name: t.close }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: copy.cardTile.openCard('Soul Warden') }));
    await dialog();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('removes the card from the list and closes, with Undo', async () => {
    const { storage } = await setup('/lists/a', [DECK]);
    fireEvent.click(await screen.findByRole('button', { name: copy.cardTile.openCard('Soul Warden') }));
    const panel = within(await dialog());
    fireEvent.click(panel.getByRole('button', { name: t.removeFromList }));
    await waitFor(async () => expect((await savedList(storage, 'a')).entries.map(e => e.name)).toEqual(["Ajani's Pridemate"]));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: copy.common.undo }));
    await waitFor(async () => expect((await savedList(storage, 'a')).entries).toHaveLength(2));
  });

  it('names every list the card is on', async () => {
    await setup('/lists/a', [ELVES, WISH]);
    fireEvent.click(await screen.findByRole('button', { name: copy.cardTile.openCard('Llanowar Elves') }));
    const panel = await dialog();
    expect(panel.textContent).toContain('Elves ×3 and Wishlist');
  });

  it('opens from the picture on a phone, as a full screen', async () => {
    setWidth(400);
    await setup('/lists/a', [DECK]);
    const open = (await screen.findAllByRole('button', { name: copy.cardTile.openCard("Ajani's Pridemate") }))[0];
    fireEvent.click(open);
    const panel = within(await dialog());
    expect(panel.getByText(t.position(1, 2))).toBeTruthy();
    expect(panel.getByRole('button', { name: t.close })).toBeTruthy();
  });
});

describe('Card detail in the store', () => {
  const trip = (...ids: string[]) => startTrip('t1', T0, ids);
  const openFrom = async (name: string) => {
    const buttons = await screen.findAllByRole('button', { name: copy.cardTile.openCard(name) });
    fireEvent.click(buttons[0]);
    return within(await dialog());
  };

  it('opens from a tile picture, saying what is in this binder and where else to try', async () => {
    await setup('/dive', [STORE], trip('a'));
    const panel = await openFrom('Soul Warden');
    expect(panel.getByText(t.inThisBinder)).toBeTruthy();
    expect(panel.getByRole('heading', { name: t.notHereTry })).toBeTruthy();
    expect(panel.queryByText('Foundations', { selector: 'strong' })).toBeTruthy();
    expect(panel.getByText(/^Foundations · card [12] of 2$/)).toBeTruthy();
  });

  it('has a Found button that marks the card found, and Undo that takes it back', async () => {
    const { storage } = await setup('/dive', [STORE], trip('a'));
    const panel = await openFrom('Soul Warden');
    fireEvent.click(panel.getByRole('button', { name: copy.cardTile.found }));
    await waitFor(async () => expect((await savedTrip(storage)).found).toEqual({ 'soul warden': { a: 1 } }));
    fireEvent.click(panel.getByRole('button', { name: copy.cardTile.foundUndo }));
    await waitFor(async () => expect((await savedTrip(storage)).found['soul warden']).toEqual({ a: 0 }));
  });

  it('Found +1 for a card wanted several times, with progress in copies', async () => {
    const { storage } = await setup('/dive', [STORE], trip('a'));
    const panel = await openFrom('Llanowar Elves');
    expect(panel.getByText(t.progress(0, 2))).toBeTruthy();
    fireEvent.click(panel.getByRole('button', { name: copy.cardTile.foundPlusOne }));
    fireEvent.click(panel.getByRole('button', { name: copy.cardTile.foundPlusOne }));
    await waitFor(async () => expect((await savedTrip(storage)).found['llanowar elves']).toEqual({ a: 2 }));
    expect(panel.getByText(copy.cardTile.allFound(2))).toBeTruthy();
    fireEvent.click(panel.getByRole('button', { name: copy.cardTile.undoOne('Llanowar Elves') }));
    await waitFor(async () => expect((await savedTrip(storage)).found['llanowar elves']).toEqual({ a: 1 }));
  });

  it('on several lists shows each list\'s share, and puts a copy on the list picked', async () => {
    const { storage } = await setup('/dive', [ELVES, WISH], trip('a', 'b'));
    const panel = await openFrom('Llanowar Elves');
    expect(panel.getByRole('heading', { name: t.split.title(2) })).toBeTruthy();
    expect(panel.getByText(t.split.listProgress(0, 3))).toBeTruthy();
    expect(panel.getByText(t.split.listProgress(0, 1))).toBeTruthy();
    fireEvent.click(panel.getByRole('button', { name: t.split.foundForListLabel('Wishlist') }));
    await waitFor(async () => expect((await savedTrip(storage)).found['llanowar elves']).toEqual({ b: 1 }));
    expect(panel.getByText(t.split.listDone)).toBeTruthy();
    // The plain Found +1 then fills from the top list.
    fireEvent.click(panel.getByRole('button', { name: copy.cardTile.foundPlusOne }));
    await waitFor(async () => expect((await savedTrip(storage)).found['llanowar elves']).toEqual({ b: 1, a: 1 }));
    fireEvent.click(panel.getByRole('button', { name: t.split.undoForListLabel('Wishlist') }));
    await waitFor(async () => expect((await savedTrip(storage)).found['llanowar elves']).toEqual({ b: 0, a: 1 }));
  });
});
