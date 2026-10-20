import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeConnector } from '../../../connectors/fakeConnector';
import { buildHandoff, fingerprint } from '../../../core/handoff';
import { DEFAULT_STORE_SETTINGS, addGroup } from '../../../core/store';
import { ListsRepository, MemoryStorage } from '../../../storage';
import { App } from '../../App';
import { copy } from '../../copy/en';
import { decodeHandoff, encodeHandoff, handoffLink } from '../../handoff/codec';
import { T0, makeList } from '../../testkit';
import type { Spec } from '../../testkit';
import { QR_MAX_CHARS, qrSvg } from './DiveQr';

const goTo = (path: string) => window.history.replaceState(null, '', path);
beforeEach(() => goTo('/'));
afterEach(() => { window.innerWidth = 1024; goTo('/'); Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); });

const DECK: Spec = { id: 'a', name: 'Lifegain', cards: [['Sol Ring', 2], ['Cultivate']] };

// A connector with the whole card catalog on the device, as the app has after its card data loads.
const withCatalog = (names: readonly string[]) => ({ ...fakeConnector([]).connector, fingerprintIndex: async () => new Map(names.map(n => [fingerprint(n), n] as const)) });

async function open(path: string, specs: Spec[] = [DECK], storage = new MemoryStorage(), connector: ReturnType<typeof fakeConnector>['connector'] = fakeConnector([]).connector) {
  (storage as { persistent: boolean }).persistent = true;
  for (const spec of specs) { const list = makeList(spec); await storage.put('lists', list.id, list); }
  goTo(path);
  const view = render(<App storage={storage} clock={() => T0} connector={connector} />);
  return { storage, repo: new ListsRepository(storage), ...view };
}

describe('the hand-off link', () => {
  const handoff = buildHandoff([makeList(DECK)], addGroup(DEFAULT_STORE_SETTINGS, 'g', 'Commander', ['cmm']));

  it('reads back what it wrote', async () => {
    expect(await decodeHandoff(await encodeHandoff(handoff))).toEqual(handoff);
  });

  it('is smaller deflated when there is a lot to say, and still reads back', async () => {
    const big = buildHandoff([makeList({ id: 'big', name: 'Big', cards: Array.from({ length: 120 }, (_, i) => [`Some Card Name Number ${i}`, 1] as [string, number]) })], DEFAULT_STORE_SETTINGS);
    const encoded = await encodeHandoff(big);
    expect(await decodeHandoff(encoded)).toEqual(big);
    if (typeof CompressionStream !== 'undefined') expect(encoded.startsWith('1.')).toBe(true);
  });

  it('refuses text that is not a hand-off, and does not throw on junk', async () => {
    expect(await decodeHandoff('')).toBeNull();
    expect(await decodeHandoff('x.abc')).toBeNull();
    expect(await decodeHandoff('0.%%%')).toBeNull();
    expect(await decodeHandoff('1.AAAA')).toBeNull();
    expect(await decodeHandoff(`0.${btoa('{"v":1,"l":[]}')}`)).toBeNull();
  });

  it('builds the address from the site, with the data after the #', () => {
    expect(handoffLink('https://binderdiver.example', '0.abc')).toBe('https://binderdiver.example/open#0.abc');
  });
});

describe('the QR code', () => {
  it('draws one for a short link, and none for a link that is too long', () => {
    expect(qrSvg('https://x.example/open#0.abc')).toContain('<svg');
    expect(qrSvg('x'.repeat(QR_MAX_CHARS + 1))).toBeNull();
  });

  it('shows beside the list, labelled, with a link to copy', async () => {
    window.innerWidth = 1280;
    let copied = '';
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t: string) => { copied = t; } }, configurable: true });
    await open('/lists/a');
    const aside = await screen.findByRole('complementary', { name: copy.divePanel.title });
    const qr = await within(aside).findByRole('img', { name: copy.qr.label });
    expect(qr.querySelector('svg')).not.toBeNull();
    expect(within(aside).getByText(copy.qr.text)).toBeTruthy();
    fireEvent.click(within(aside).getByRole('button', { name: copy.qr.copyLink }));
    await waitFor(() => expect(copied).toMatch(/\/open#[01]\./));
    expect(await screen.findByText(copy.qr.copied)).toBeTruthy();
  });

  it('is left out on a phone, where it would only point at itself', async () => {
    window.innerWidth = 375;
    window.dispatchEvent(new Event('resize'));
    await open('/lists/a');
    await screen.findByRole('complementary', { name: copy.divePanel.title });
    expect(screen.queryByRole('img', { name: copy.qr.label })).toBeNull();
    window.innerWidth = 1024;
    window.dispatchEvent(new Event('resize'));
  });

  it('says a dive is too big for a code when it is, and still offers the link', async () => {
    window.innerWidth = 1280;
    // Names that do not repeat each other, so deflating them does not shrink the link below a QR code's limit.
    let seed = 12345;
    const word = () => Array.from({ length: 14 }, () => { seed = (seed * 1103515245 + 12345) % 2147483648; return String.fromCharCode(97 + (seed >> 8) % 26); }).join('');
    const cards = Array.from({ length: 200 }, () => [`${word()} ${word()}`, 1] as [string, number]);
    await open('/lists/a', [{ ...DECK, cards }]);
    const aside = await screen.findByRole('complementary', { name: copy.divePanel.title }, { timeout: 10000 });
    // Compressing 200 names is slow when the whole suite is running, so this waits longer than the default.
    expect(await within(aside).findByText(copy.qr.tooBig, {}, { timeout: 10000 })).toBeTruthy();
    expect(within(aside).queryByRole('img', { name: copy.qr.label })).toBeNull();
    expect(within(aside).getByRole('button', { name: copy.qr.copyLink })).toBeTruthy();
  }, 20000);

  it('is not shown when no list in the dive has anything to find', async () => {
    await open('/lists/a', [{ ...DECK, cards: [['Sol Ring', 1, 'in_collection']] }]);
    await screen.findByRole('complementary', { name: copy.divePanel.title });
    expect(screen.queryByRole('img', { name: copy.qr.label })).toBeNull();
  });
});

describe('the compact link', () => {
  it('is what the QR code carries when this device has the card catalog, so a big deck still fits', async () => {
    let copied = '';
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t: string) => { copied = t; } }, configurable: true });
    window.innerWidth = 1280;
    const cards = Array.from({ length: 125 }, (_, i) => [`Some Card Name Number ${i} of the Deep`, 1] as [string, number]);
    await open('/lists/big', [{ id: 'big', name: 'Big', cards }], new MemoryStorage(), withCatalog(cards.map(c => c[0])));
    const aside = await screen.findByRole('complementary', { name: copy.divePanel.title });
    expect(await within(aside).findByRole('img', { name: copy.qr.label }, { timeout: 5000 })).toBeTruthy();   // it fits: 125 cards by name would not
    fireEvent.click(within(aside).getByRole('button', { name: copy.qr.copyLink }));
    await waitFor(() => expect(copied).toContain('/open#'));
    const decoded = await decodeHandoff(copied.split('#')[1]);
    expect(decoded!.lists[0].entries[0]).toMatchObject({ name: '', fp: fingerprint(cards[0][0]) });
  });

  it('opens on a device with the catalog: names come back, and cards it does not know are counted', async () => {
    const big = { id: 'big', name: 'Big', cards: [['Sol Ring'], ['Cultivate'], ['Brand New Card']] as [string][] };
    const path = `/open#${await encodeHandoff(buildHandoff([makeList(big)], DEFAULT_STORE_SETTINGS), true)}`;
    const { repo } = await open(path, [], new MemoryStorage(), withCatalog(['Sol Ring', 'Cultivate']));
    expect(await screen.findByText(copy.openHandoff.unmatched(1))).toBeTruthy();
    expect(screen.getByText(copy.openHandoff.detail(1, 2))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: copy.openHandoff.add }));
    await waitFor(() => expect(window.location.pathname).toBe('/plan'));
    expect((await repo.all()).find(l => l.name === 'Big')!.entries.map(e => e.name)).toEqual(['Sol Ring', 'Cultivate']);
  });

  it('says it cannot be read on a device without the catalog', async () => {
    const path = `/open#${await encodeHandoff(buildHandoff([makeList(DECK)], DEFAULT_STORE_SETTINGS), true)}`;
    await open(path, []);
    expect(await screen.findByText(copy.openHandoff.bad.title)).toBeTruthy();
  });
});

describe('opening a hand-off', () => {
  const link = async (specs: Spec[], settings = DEFAULT_STORE_SETTINGS) => `/open#${await encodeHandoff(buildHandoff(specs.map(makeList), settings))}`;

  it('shows what is in the link, and adds the lists and the binder groups on request', async () => {
    const settings = addGroup(DEFAULT_STORE_SETTINGS, 'g', 'Commander', ['cmm']);
    const path = await link([DECK], settings);
    const { repo, storage } = await open(path, []);
    expect(await screen.findByRole('heading', { name: copy.openHandoff.title })).toBeTruthy();
    expect(screen.getByText(copy.openHandoff.detail(1, 2))).toBeTruthy();
    expect(screen.getByText(copy.openHandoff.listLine('Lifegain', 2))).toBeTruthy();
    expect(screen.getByText(copy.openHandoff.settingsNote)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: copy.openHandoff.add }));
    await waitFor(() => expect(window.location.pathname).toBe('/plan'));
    const deck = (await repo.all()).find(l => l.name === 'Lifegain')!;
    expect(deck.entries.map(e => [e.name, e.quantity, e.status])).toEqual([['Sol Ring', 2, 'needed'], ['Cultivate', 1, 'needed']]);
    expect((await storage.get<{ binderGroups: unknown[] }>('settings', 'store-settings'))!.binderGroups).toHaveLength(1);
  });

  it('puts a wishlist in the wishlist', async () => {
    const path = await link([{ id: 'wishlist', kind: 'wishlist', name: 'Wishlist', cards: [['Sol Ring']] }]);
    const { repo } = await open(path, []);
    fireEvent.click(await screen.findByRole('button', { name: copy.openHandoff.add }));
    await waitFor(() => expect(window.location.pathname).toBe('/plan'));
    expect((await repo.get('wishlist'))!.entries.map(e => e.name)).toEqual(['Sol Ring']);
  });

  it('adds nothing on Cancel', async () => {
    const path = await link([DECK]);
    const { repo } = await open(path, []);
    fireEvent.click(await screen.findByRole('button', { name: copy.openHandoff.cancel }));
    expect(window.location.pathname).toBe('/lists');
    expect((await repo.all()).filter(l => l.kind === 'deck')).toEqual([]);
  });

  it.each(['/open', '/open#', '/open#0.not-a-handoff', '/open#1.AAAA'])('says the link cannot be read for %s', async path => {
    await open(path, []);
    expect(await screen.findByText(copy.openHandoff.bad.title)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: copy.openHandoff.bad.action }));
    expect(window.location.pathname).toBe('/lists');
  });
});
