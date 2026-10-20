import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FuzzyResult } from '../../../core/connector';
import { fakeConnector, fakeSummary } from '../../../connectors/fakeConnector';
import type { FakeCard } from '../../../connectors/fakeConnector';
import { WISHLIST_ID } from '../../../core/lists';
import { ListsRepository, MemoryStorage } from '../../../storage';
import { App } from '../../App';
import { copy } from '../../copy/en';
import { T0, makeList } from '../../testkit';
import type { Spec } from '../../testkit';

const t = copy.importFlow;
const f = t.fix;
const CARDS: (string | FakeCard)[] = ['Sol Ring', 'Cultivate', 'Command Tower', "Ajani's Pridemate", 'Zuran Orb', 'Zuran Spellcaster', 'Archangel of Thune', 'Archangel Avacyn', 'Frog Tongue', 'Frog Umbra'];
const FUZZY: Record<string, FuzzyResult> = {
  'Ajanis Pridemate': { status: 'match', card: fakeSummary({ name: "Ajani's Pridemate" }) },
  Archangel: { status: 'ambiguous', candidates: [fakeSummary({ name: 'Archangel of Thune', typeLine: 'Creature — Angel' }), fakeSummary({ name: 'Archangel Avacyn', typeLine: 'Legendary Creature — Angel' })] },
  Frog: { status: 'ambiguous', candidates: [fakeSummary({ name: 'Frog Tongue' }), fakeSummary({ name: 'Frog Umbra' })] },
};

interface Options { known?: (string | FakeCard)[]; lists?: Spec[]; path?: string; failLookup?: boolean }

async function setup(options: Options = {}) {
  const storage = new MemoryStorage();
  (storage as { persistent: boolean }).persistent = true;
  for (const spec of options.lists ?? []) { const list = makeList(spec); await storage.put('lists', list.id, list); }
  const fake = fakeConnector(options.known ?? CARDS, { fuzzy: FUZZY, failLookup: options.failLookup });
  window.history.replaceState(null, '', options.path ?? '/import');
  const view = render(<App storage={storage} clock={() => T0} connector={fake.connector} />);
  return { storage, repo: new ListsRepository(storage), fake, ...view };
}

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const setWidth = (width: number) => act(() => { window.innerWidth = width; window.dispatchEvent(new Event('resize')); });
const lookUp = (n: number) => press(t.name.lookUp(n));
const fill = (name: string, text: string) => { type(t.name.nameLabel, name); type(t.name.textLabel, text); };
const heading = (name: string) => screen.findByRole('heading', { name });

beforeEach(() => window.history.replaceState(null, '', '/import'));
afterEach(() => {
  setWidth(1024);
  window.history.replaceState(null, '', '/');
});

describe('Import step 1: name it', () => {
  it('shows the four steps and where the cards go', async () => {
    await setup();
    expect(await heading(t.name.title)).toBeTruthy();
    expect(screen.getByRole('list', { name: t.stepsLabel }).querySelectorAll('li')).toHaveLength(4);
    expect(screen.getByLabelText(t.name.nameLabel)).toBeTruthy();
  });

  it('counts the cards ready, and says what it combined and cleaned', async () => {
    await setup();
    type(t.name.textLabel, '1 Cultivate\n1 Sol Ring *F*\n1 Cultivate (CMM) 410');
    expect(screen.getByText(t.name.ready(2))).toBeTruthy();
    expect(screen.getByText(t.name.combined('Cultivate', 2, 2))).toBeTruthy();
    expect(screen.getByText(t.name.cleaned)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.name.lookUp(2) })).toBeTruthy();
  });

  it('offers a switch for sideboard and maybeboard only when they exist, both off', async () => {
    await setup();
    type(t.name.textLabel, '1 Sol Ring');
    expect(screen.queryByRole('switch')).toBeNull();
    type(t.name.textLabel, '1 Sol Ring\nSideboard\n2 Cultivate\nMaybeboard\n1 Command Tower');
    const switches = screen.getAllByRole('switch') as HTMLInputElement[];
    expect(switches.map(s => s.checked)).toEqual([false, false]);
    expect(screen.getByText(t.name.ready(1))).toBeTruthy();
    fireEvent.click(switches[0]);
    expect(screen.getByText(t.name.ready(2))).toBeTruthy();
  });

  it('asks for a name for a deck, but not for the wishlist', async () => {
    await setup();
    type(t.name.textLabel, '1 Sol Ring');
    press(t.name.lookUp(1));
    expect(screen.getByText(t.nameMissing)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(t.name.wishlist));
    expect(screen.queryByLabelText(t.name.nameLabel)).toBeNull();
    expect(screen.getByRole('list', { name: t.stepsLabel }).querySelectorAll('li')).toHaveLength(3);
  });

  it('says when the box is empty', async () => {
    await setup();
    type(t.name.nameLabel, 'Deck');
    press(t.name.lookUpEmpty);
    expect(screen.getByText(`${t.name.empty.title}. ${t.name.empty.detail}`)).toBeTruthy();
  });

  it('says it could not read any card names, with examples', async () => {
    await setup();
    fill('Deck', '0 Sol Ring\n0 Cultivate');
    press(t.name.lookUpEmpty);
    expect(screen.getByText(t.name.noNames.title)).toBeTruthy();
    expect(screen.getByText(t.name.noNames.examples[2])).toBeTruthy();
  });

  it('says so when every card is in a section that is off', async () => {
    await setup();
    fill('Deck', 'Sideboard\n1 Sol Ring');
    press(t.name.lookUpEmpty);
    expect(screen.getByText(t.name.nothingIncluded.title)).toBeTruthy();
  });

  it('asks how to handle more than 250 cards, with split chosen to start', async () => {
    await setup();
    fill('Big', Array.from({ length: 412 }, (_, i) => `1 Card ${i}`).join('\n'));
    expect(screen.getByText(t.name.tooMany.title(412))).toBeTruthy();
    expect((screen.getByLabelText(t.name.tooMany.split([250, 162])) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(t.name.tooMany.keepFirst) as HTMLInputElement).checked).toBe(false);
  });

  it('cancel goes back to My lists and saves nothing', async () => {
    const { repo } = await setup();
    fill('Deck', '1 Sol Ring');
    press(t.cancel);
    await waitFor(() => expect(window.location.pathname).toBe('/lists'));
    expect((await repo.all()).filter(l => l.kind === 'deck')).toEqual([]);
  });
});

describe('Import: a deck where every name matches', () => {
  it('goes through the lookup to What you own, then makes the deck and opens it', async () => {
    const { repo } = await setup();
    fill('Lifegain Commander', '2 Sol Ring\n1 Cultivate #ramp\n1 sol ring');
    lookUp(2);
    expect(await heading(t.own.title)).toBeTruthy();
    press(t.own.finish);
    await waitFor(() => expect(window.location.pathname).toMatch(/^\/lists\/.+/));
    const [deck] = (await repo.all()).filter(l => l.kind === 'deck');
    expect(deck.name).toBe('Lifegain Commander');
    expect(deck.entries.map(e => [e.name, e.quantity, e.status])).toEqual([['Sol Ring', 3, 'needed'], ['Cultivate', 1, 'needed']]);
    expect(deck.entries[1].tags).toEqual(['ramp']);
    expect(window.location.pathname).toBe(`/lists/${deck.id}`);
  });

  it('applies the statuses chosen in What you own, and shows the counts', async () => {
    const { repo } = await setup();
    fill('Deck', '1 Sol Ring\n1 Cultivate\n1 Command Tower');
    lookUp(3);
    await heading(t.own.title);
    expect(screen.getByText(t.own.summary(0, 0, 0, 0, 3))).toBeTruthy();
    press(t.own.setAll);
    fireEvent.click(within(screen.getByRole('menu', { name: t.own.setAll })).getByRole('menuitem', { name: copy.status.proxy }));
    expect(screen.getByText(t.own.summary(0, 0, 3, 0, 0))).toBeTruthy();
    press(t.own.reset);
    expect(screen.getByText(t.own.summary(0, 0, 0, 0, 3))).toBeTruthy();
    press(t.own.setAll);
    fireEvent.click(within(screen.getByRole('menu', { name: t.own.setAll })).getByRole('menuitem', { name: copy.status.in_collection }));
    press(t.own.finish);
    await waitFor(async () => expect((await repo.all()).some(l => l.kind === 'deck')).toBe(true));
    expect((await repo.all()).find(l => l.kind === 'deck')!.entries.map(e => e.status)).toEqual(['in_collection', 'in_collection', 'in_collection']);
  });

  it('has Back and See my list above the cards, so a long list never hides them, and no separate Skip', async () => {
    await setup();
    fill('Deck', '1 Sol Ring\n1 Cultivate');
    lookUp(2);
    const title = await heading(t.own.title);
    const rows = screen.getByText('Sol Ring');
    for (const name of [copy.importFlow.back, t.own.finish]) {
      const button = screen.getByRole('button', { name });
      expect(title.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(button.compareDocumentPosition(rows) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: /skip/i })).toBeNull();
  });

  it('See my list straight away leaves everything needed, and Reset to needed clears marks first', async () => {
    const { repo } = await setup();
    fill('Deck', '1 Sol Ring\n1 Cultivate');
    lookUp(2);
    await heading(t.own.title);
    press(t.own.setAll);
    fireEvent.click(within(screen.getByRole('menu', { name: t.own.setAll })).getByRole('menuitem', { name: copy.status.proxy }));
    press(t.own.reset);
    press(t.own.finish);
    await waitFor(async () => expect((await repo.all()).some(l => l.kind === 'deck')).toBe(true));
    expect((await repo.all()).find(l => l.kind === 'deck')!.entries.map(e => e.status)).toEqual(['needed', 'needed']);
  });

  it('leaves out sideboard cards while their switch is off', async () => {
    const { repo } = await setup();
    fill('Deck', '1 Sol Ring\nSideboard\n1 Cultivate');
    lookUp(1);
    await heading(t.own.title);
    press(t.own.finish);
    await waitFor(async () => expect((await repo.all()).some(l => l.kind === 'deck')).toBe(true));
    expect((await repo.all()).find(l => l.kind === 'deck')!.entries.map(e => e.name)).toEqual(['Sol Ring']);
  });

  it('removes the draft once the deck is made', async () => {
    const { storage } = await setup();
    fill('Deck', '1 Sol Ring');
    lookUp(1);
    await heading(t.own.title);
    press(t.own.finish);
    await waitFor(() => expect(window.location.pathname).toMatch(/^\/lists\/.+/));
    expect(await storage.get('settings', 'import-draft')).toBeUndefined();
  });
});

describe('Import: the wishlist', () => {
  it('has no What you own step, adds the cards and skips those already on it', async () => {
    const { repo } = await setup({ lists: [{ id: WISHLIST_ID, kind: 'wishlist', name: 'Wishlist', cards: [['Sol Ring']] }] });
    fireEvent.click(screen.getByLabelText(t.name.wishlist));
    type(t.name.textLabel, '3 Sol Ring\n1 Cultivate');
    lookUp(2);
    await waitFor(() => expect(window.location.pathname).toBe(`/lists/${WISHLIST_ID}`));
    expect((await repo.get(WISHLIST_ID))!.entries.map(e => [e.name, e.quantity])).toEqual([['Sol Ring', 1], ['Cultivate', 1]]);
    expect(await screen.findByText(t.done.wishlist(1, 1))).toBeTruthy();
  });

  it('can be opened already set to the wishlist', async () => {
    await setup({ path: '/import?target=wishlist' });
    expect((screen.getByLabelText(t.name.wishlist) as HTMLInputElement).checked).toBe(true);
  });
});

describe('Import step 3: fix names', () => {
  const run = async (text: string, n: number) => {
    const view = await setup();
    fill('Deck', text);
    lookUp(n);
    await heading(t.fix.title);
    return view;
  };

  it('is skipped when every name matched exactly (checked above) and shows counts when not', async () => {
    await run('1 Sol Ring\n1 Ajanis Pridemate\n1 Archangel\n1 Zuran Orb Tribal', 4);
    expect(screen.getByText(t.fix.summary(1, 1, 2))).toBeTruthy();
  });

  it('shows a fixed spelling with what was typed, and Undo sends it to not found', async () => {
    await run('1 Sol Ring\n1 Ajanis Pridemate', 2);
    expect(screen.getByText(f.fixed.typed('Ajanis Pridemate'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: f.fixed.undoLabel("Ajani's Pridemate") }));
    expect(screen.getByText(f.missing.typed('Ajanis Pridemate'))).toBeTruthy();
    expect(screen.queryByText(f.fixed.typed('Ajanis Pridemate'))).toBeNull();
  });

  it('lets the player pick one of several matches, and change their mind', async () => {
    const { repo } = await run('1 Sol Ring\n1 Archangel', 2);
    expect(screen.getByText(f.pick.heading('Archangel', 2))).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/^Archangel Avacyn/));
    fireEvent.click(screen.getByLabelText(/^Archangel of Thune/));
    expect((screen.getByLabelText(/^Archangel of Thune/) as HTMLInputElement).checked).toBe(true);
    press(t.fix.continue);
    await heading(t.own.title);
    press(t.own.finish);
    await waitFor(async () => expect((await repo.all()).some(l => l.kind === 'deck')).toBe(true));
    expect((await repo.all()).find(l => l.kind === 'deck')!.entries.map(e => e.name)).toEqual(['Sol Ring', 'Archangel of Thune']);
  });

  it('finds a card for a name that was not found by typing and picking a suggestion', async () => {
    const { repo } = await run('1 Sol Ring\n1 Zuran Orb Tribal', 2);
    type(f.missing.inputLabel, 'zuran');
    fireEvent.click(await screen.findByRole('button', { name: 'Zuran Spellcaster' }));
    expect(await screen.findByText(f.missing.using('Zuran Spellcaster'))).toBeTruthy();
    press(t.fix.continue);
    await heading(t.own.title);
    press(t.own.finish);
    await waitFor(async () => expect((await repo.all()).some(l => l.kind === 'deck')).toBe(true));
    expect((await repo.all()).find(l => l.kind === 'deck')!.entries.map(e => e.name)).toEqual(['Sol Ring', 'Zuran Spellcaster']);
  });

  it('removing a name, or leaving it unfixed, leaves it out of the deck', async () => {
    const { repo } = await run('1 Sol Ring\n1 Nonsense Card\n1 Other Nonsense', 3);
    expect(screen.getByText(t.fix.missing.title(2))).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: f.missing.remove })[0]);
    expect(screen.getByText(t.fix.missing.title(1))).toBeTruthy();
    press(t.fix.continue);
    await heading(t.own.title);
    expect(screen.queryByText('Nonsense Card')).toBeNull();
    press(t.own.finish);
    await waitFor(async () => expect((await repo.all()).some(l => l.kind === 'deck')).toBe(true));
    expect((await repo.all()).find(l => l.kind === 'deck')!.entries.map(e => e.name)).toEqual(['Sol Ring']);
  });

  it('on a phone, shows one name to pick at a time with a pager', async () => {
    setWidth(375);
    await setup();
    fill('Deck', '1 Sol Ring\n1 Archangel\n1 Frog');
    lookUp(3);
    await heading(t.fix.title);
    expect(screen.getByText(f.pick.pager(1, 2))).toBeTruthy();
    expect(screen.getByText(f.pick.heading('Archangel', 2))).toBeTruthy();
    expect(screen.queryByText(f.pick.heading('Frog', 2))).toBeNull();
    press(f.pick.next);
    expect(screen.getByText(f.pick.heading('Frog', 2))).toBeTruthy();
    expect(screen.getByText(f.pick.pager(2, 2))).toBeTruthy();
  });

  it('can not continue when nothing is left to add', async () => {
    await run('1 Ajanis Pridemate\n1 Nonsense Card', 2);
    expect((screen.getByRole('button', { name: t.fix.continue }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: f.fixed.undoLabel("Ajani's Pridemate") }));
    for (let i = 0; i < 2; i++) fireEvent.click(screen.getAllByRole('button', { name: f.missing.remove })[0]);
    expect((screen.getByRole('button', { name: t.fix.continue }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Import: problems', () => {
  it('goes back to step 1 with the "could not read" help when no name matches any card', async () => {
    const { storage } = await setup();
    fill('Deck', 'Check out my new deck!!');
    lookUp(1);
    expect(await screen.findByText(t.name.noNames.title)).toBeTruthy();
    expect(screen.getByLabelText(t.name.textLabel)).toBeTruthy();
    expect(await storage.get('settings', 'import-draft')).toBeUndefined();
  });

  it('says the lookup is in trouble when the source stops, and can save for later', async () => {
    const { storage } = await setup({ failLookup: true });
    fill('Lifegain Commander', '1 Sol Ring\n1 Cultivate');
    lookUp(2);
    expect(await screen.findByText(t.lookup.trouble.title)).toBeTruthy();
    expect(screen.getByText(t.lookup.trouble.detail(0, 2))).toBeTruthy();
    press(t.lookup.trouble.saveForLater(0));
    await waitFor(() => expect(window.location.pathname).toBe('/lists'));
    expect(await storage.get('settings', 'import-draft')).toMatchObject({ name: 'Lifegain Commander', total: 2 });
  });

  it('tries again when asked, and carries on once the source answers', async () => {
    const { fake } = await setup({ failLookup: true });
    fill('Deck', '1 Sol Ring');
    lookUp(1);
    await screen.findByText(t.lookup.trouble.title);
    fake.state.failLookup = false;
    press(t.lookup.trouble.retryNow);
    expect(await heading(t.own.title)).toBeTruthy();
  });

  it('goes back from the lookup without leaving a draft', async () => {
    const { storage, fake } = await setup();
    fake.hold();
    fill('Deck', '1 Sol Ring');
    lookUp(1);
    await heading(t.lookup.title);
    press(t.back);
    expect(await heading(t.name.title)).toBeTruthy();
    expect(await storage.get('settings', 'import-draft')).toBeUndefined();
    fake.release();
  });

  it('keeps a draft while the lookup runs, so leaving can be picked up again', async () => {
    const { storage, fake } = await setup();
    fake.hold();
    fill('Deck', '1 Sol Ring');
    lookUp(1);
    await heading(t.lookup.title);
    expect(await storage.get('settings', 'import-draft')).toMatchObject({ name: 'Deck', total: 1, done: 0 });
    fake.release();
  });

  it('resumes from a draft straight into the lookup', async () => {
    const storage = new MemoryStorage();
    (storage as { persistent: boolean }).persistent = true;
    await storage.put('settings', 'import-draft', {
      target: 'deck', name: 'Lifegain Commander', text: '1 Sol Ring\n1 Cultivate', include: { sideboard: false, maybeboard: false },
      limitChoice: 'split', done: 1, total: 2, savedAt: T0.toISOString(),
    });
    window.history.replaceState(null, '', '/import?resume=1');
    render(<App storage={storage} clock={() => T0} connector={fakeConnector(CARDS).connector} />);
    expect(await heading(t.own.title)).toBeTruthy();
    press(t.own.finish);
    await waitFor(() => expect(window.location.pathname).toMatch(/^\/lists\/.+/));
    const decks = (await new ListsRepository(storage).all()).filter(l => l.kind === 'deck');
    expect(decks.map(d => d.name)).toEqual(['Lifegain Commander']);
  });

  it('starts empty when there is nothing to resume', async () => {
    await setup({ path: '/import?resume=1' });
    expect(await heading(t.name.title)).toBeTruthy();
  });
});

describe('Import: more than 250 cards', () => {
  const many = Array.from({ length: 300 }, (_, i) => `Card ${i}`);
  const big = async () => {
    const view = await setup({ known: many });
    fill('Big', many.map(n => `1 ${n}`).join('\n'));
    return view;
  };

  it('splits into two lists, named in order, when that is chosen', async () => {
    const { repo } = await big();
    lookUp(300);
    await heading(t.own.title);
    press(t.own.finish);
    await waitFor(() => expect(window.location.pathname).toBe('/lists'), { timeout: 4000 });
    const decks = (await repo.all()).filter(l => l.kind === 'deck').map(d => [d.name, d.entries.length]).sort();
    expect(decks).toEqual([['Big (1 of 2)', 250], ['Big (2 of 2)', 50]]);
  }, 20000);

  it('keeps only the first 250 when that is chosen', async () => {
    const { repo } = await big();
    fireEvent.click(screen.getByLabelText(t.name.tooMany.keepFirst));
    lookUp(300);
    await heading(t.own.title);
    press(t.own.finish);
    await waitFor(() => expect(window.location.pathname).toMatch(/^\/lists\/.+/), { timeout: 4000 });
    const decks = (await repo.all()).filter(l => l.kind === 'deck');
    expect(decks.map(d => d.entries.length)).toEqual([250]);
    expect(await screen.findByText(t.done.keptFirst(250, 300))).toBeTruthy();
  }, 20000);
});
