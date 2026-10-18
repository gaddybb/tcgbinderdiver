import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeConnector } from '../../../connectors/fakeConnector';
import { ListsRepository, MemoryStorage } from '../../../storage';
import { App } from '../../App';
import { copy } from '../../copy/en';
import { T0, makeList } from '../../testkit';

const DECKS = [
  { name: 'Deck One', text: '1 Sol Ring\n2 Cultivate\n1 Cultivate' },
  { name: 'Deck Two', text: '1 Command Tower' },
];

const goTo = (path: string) => window.history.replaceState(null, '', path);
beforeEach(() => goTo('/'));
afterEach(() => goTo('/'));

async function open(path: string, options: { decks?: typeof DECKS; random?: number; own?: boolean } = {}) {
  const storage = new MemoryStorage();
  (storage as { persistent: boolean }).persistent = true;
  if (options.own) { const list = makeList({ id: 'mine', name: 'Mine', cards: [['Sol Ring']] }); await storage.put('lists', list.id, list); }
  goTo(path);
  const view = render(<App storage={storage} clock={() => T0} connector={fakeConnector([]).connector} sampleDecks={options.decks ?? DECKS} random={() => options.random ?? 0} />);
  return { storage, repo: new ListsRepository(storage), ...view };
}

describe('Sample decks', () => {
  it('Try a sample deck on Home opens the dive plan with the deck, saved as a sample', async () => {
    const { repo } = await open('/');
    fireEvent.click(await screen.findByRole('button', { name: copy.sample.button }));
    await waitFor(() => expect(window.location.pathname).toBe('/plan'));
    const sample = (await repo.all()).find(l => l.sample);
    expect(sample).toMatchObject({ name: 'Deck One', kind: 'deck', inNextDive: true });
    expect(sample!.entries.map(e => [e.name, e.quantity])).toEqual([['Sol Ring', 1], ['Cultivate', 3]]);
    expect(await screen.findByText(copy.sample.banner('Deck One'))).toBeTruthy();
  });

  it('picks the deck with the random number', async () => {
    const { repo } = await open('/', { random: 0.9 });
    fireEvent.click(await screen.findByRole('button', { name: copy.sample.button }));
    await waitFor(async () => expect((await repo.all()).find(l => l.sample)?.name).toBe('Deck Two'));
  });

  it('Try another replaces the sample with a different deck, never adding a second', async () => {
    const { repo } = await open('/');
    fireEvent.click(await screen.findByRole('button', { name: copy.sample.button }));
    fireEvent.click(await screen.findByRole('button', { name: copy.sample.another }));
    await waitFor(async () => expect((await repo.all()).filter(l => l.sample).map(l => l.name)).toEqual(['Deck Two']));
    expect(await screen.findByText(copy.sample.banner('Deck Two'))).toBeTruthy();
  });

  it('Paste my own list removes the sample and opens the import', async () => {
    const { repo } = await open('/');
    fireEvent.click(await screen.findByRole('button', { name: copy.sample.button }));
    fireEvent.click(await screen.findByRole('button', { name: copy.sample.paste }));
    await waitFor(() => expect(window.location.pathname).toBe('/import'));
    expect((await repo.all()).filter(l => l.sample)).toEqual([]);
  });

  it('has no Try another button when there is only one deck', async () => {
    await open('/', { decks: [DECKS[0]] });
    fireEvent.click(await screen.findByRole('button', { name: copy.sample.button }));
    await screen.findByText(copy.sample.banner('Deck One'));
    expect(screen.queryByRole('button', { name: copy.sample.another })).toBeNull();
  });

  it('is offered on the import, the walkthrough and the empty My lists too', async () => {
    const view = await open('/import');
    expect(await screen.findByRole('button', { name: copy.sample.button })).toBeTruthy();
    view.unmount();
    goTo('/walkthrough');
    const second = await open('/walkthrough');
    expect(await screen.findByRole('button', { name: copy.sample.button })).toBeTruthy();
    second.unmount();
    await open('/lists');
    expect(await screen.findByRole('button', { name: copy.sample.button })).toBeTruthy();
  });

  it('is not offered when there are no sample decks', async () => {
    await open('/', { decks: [] });
    await screen.findByRole('heading', { level: 1, name: copy.homePage.title });
    expect(screen.queryByRole('button', { name: copy.sample.button })).toBeNull();
  });

  it('is not offered to a player who already has a list of their own', async () => {
    await open('/', { own: true });
    await screen.findByRole('heading', { level: 1, name: copy.homePage.title });
    await waitFor(() => expect(screen.queryByRole('button', { name: copy.sample.button })).toBeNull());
  });

  it('shows the sample on My lists with its own label', async () => {
    const { repo } = await open('/');
    fireEvent.click(await screen.findByRole('button', { name: copy.sample.button }));
    await waitFor(async () => expect((await repo.all()).some(l => l.sample)).toBe(true));
    goTo('/lists');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(await screen.findByText(copy.myLists.kind.sample)).toBeTruthy();
  });
});
