import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeConnector, fakeSummary } from '../../../connectors/fakeConnector';
import { pr } from '../../../core/engine/fixtures';
import { startTrip } from '../../../core/trip';
import { CardsRepository, MemoryStorage } from '../../../storage';
import { App } from '../../App';
import { copy } from '../../copy/en';
import { T0, makeList } from '../../testkit';

const goTo = (path: string) => window.history.replaceState(null, '', path);
const setWidth = (width: number) => act(() => { window.innerWidth = width; window.dispatchEvent(new Event('resize')); });
const open = (path: string, storage = new MemoryStorage()) => { goTo(path); return { storage, ...render(<App storage={storage} clock={() => T0} connector={fakeConnector([]).connector} />) }; };

beforeEach(() => goTo('/'));
afterEach(() => { setWidth(1024); goTo('/'); });

describe('Site navigation', () => {
  it('has a header with the logo, Walkthrough, Support, the game choice, My lists and Store dive', () => {
    open('/');
    const nav = screen.getByRole('navigation', { name: copy.siteNav.label });
    expect(within(nav).getByRole('link', { name: copy.siteNav.home })).toBeTruthy();
    for (const name of [copy.siteNav.walkthrough, copy.siteNav.support, copy.siteNav.lists, copy.siteNav.dive]) {
      expect(within(nav).getByRole('link', { name })).toBeTruthy();
    }
  });

  it('offers Magic now and shows the other games as coming, not choosable', () => {
    open('/');
    const select = screen.getByLabelText(copy.siteNav.game) as HTMLSelectElement;
    expect([...select.options].map(o => [o.textContent, o.disabled])).toEqual([
      [copy.games.magic, false],
      [copy.siteNav.gameComing(copy.games.pokemon), true],
      [copy.siteNav.gameComing(copy.games.lorcana), true],
      [copy.siteNav.gameComing(copy.games.yugioh), true],
    ]);
  });

  it('marks the page you are on', () => {
    open('/support');
    const nav = within(screen.getByRole('navigation', { name: copy.siteNav.label }));
    expect(nav.getByRole('link', { name: copy.siteNav.support }).getAttribute('aria-current')).toBe('page');
    expect(nav.getByRole('link', { name: copy.siteNav.walkthrough }).getAttribute('aria-current')).toBeNull();
  });

  it('links to the pages from the footer, under the Fan Content disclaimer rules', () => {
    open('/');
    const footer = screen.getByRole('navigation', { name: copy.footerLinks.label });
    expect(within(footer).getAllByRole('link').map(a => a.textContent)).toEqual([copy.footerLinks.about, copy.footerLinks.privacy, copy.footerLinks.walkthrough, copy.footerLinks.kit]);
    expect(screen.getByTestId('fan-content-disclaimer').textContent).toBe(copy.footer.fanContentDisclaimer);
  });

  it('on a phone has a slim header and the tab bar, with the current tab named', () => {
    setWidth(375);
    open('/lists');
    expect(screen.getByRole('link', { name: copy.siteNav.menuLabel })).toBeTruthy();
    const tabs = screen.getByRole('navigation', { name: copy.tabs.label });
    expect(within(tabs).getAllByRole('link').map(a => a.textContent)).toEqual([copy.tabs.lists, copy.tabs.plan, copy.tabs.dive, copy.tabs.more]);
    expect(within(tabs).getByRole('link', { name: copy.tabs.lists }).getAttribute('aria-current')).toBe('page');
    expect(screen.queryByLabelText(copy.siteNav.game)).toBeNull();
  });

  it('the More page lists the other pages', () => {
    setWidth(375);
    open('/more');
    // The heading stays for screen readers but is visually hidden (the tab already says where you are).
    expect(screen.getByRole('heading', { level: 1, name: copy.more.title }).className).toContain('srOnly');
    for (const name of [copy.more.walkthrough, copy.more.support, copy.more.about, copy.more.privacy]) {
      expect(within(screen.getByRole('main')).getByRole('link', { name })).toBeTruthy();
    }
    expect(within(screen.getByRole('navigation', { name: copy.tabs.label })).getByRole('link', { name: copy.tabs.more }).getAttribute('aria-current')).toBe('page');
  });
});

describe('Home', () => {
  it('has the pitch, a box for a decklist, the walkthrough link and the four steps', () => {
    open('/');
    expect(screen.getByRole('heading', { level: 1, name: copy.homePage.title })).toBeTruthy();
    expect(screen.getByLabelText(copy.homePage.formLabel)).toBeTruthy();
    expect(screen.getAllByRole('link', { name: copy.homePage.takeWalkthrough })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)).toEqual(copy.homePage.steps.map(s => s.title));
  });

  it('explains itself before the box, shows an example as the hint, and keeps the walkthrough link in the box with the buttons', () => {
    open('/');
    const box = screen.getByLabelText(copy.homePage.formLabel) as HTMLTextAreaElement;
    expect(screen.getByText(copy.homePage.primer)).toBeTruthy();
    expect(box.placeholder.startsWith('Example')).toBe(true);
    expect(box.value).toBe('');
    const form = box.closest('form')!;
    expect(within(form).getByRole('link', { name: copy.homePage.takeWalkthrough })).toBeTruthy();
    expect(within(form).getByRole('button', { name: copy.homePage.plan })).toBeTruthy();
  });

  it('says why it helps, with the no-guarantee note under the steps', () => {
    open('/');
    expect(screen.getByText(copy.homePage.whyLead)).toBeTruthy();
    expect(screen.getByText(copy.homePage.stepsNote)).toBeTruthy();
    expect(screen.getByRole('button', { name: new RegExp(copy.homePage.whyCue) })).toBeTruthy();
  });

  it('has a Ko-fi button at the bottom of the page', () => {
    const opened = vi.spyOn(window, 'open').mockReturnValue(null);
    open('/');
    fireEvent.click(screen.getByRole('button', { name: copy.homePage.support.action }));
    expect(opened).toHaveBeenCalledWith(expect.stringContaining('ko-fi.com'), '_blank', 'noopener,noreferrer');
    opened.mockRestore();
  });

  it('carries a pasted list into the import, which opens with it filled in', async () => {
    open('/');
    fireEvent.change(screen.getByLabelText(copy.homePage.formLabel), { target: { value: '1 Sol Ring\n1 Cultivate' } });
    fireEvent.click(screen.getByRole('button', { name: copy.homePage.plan }));
    expect(window.location.pathname).toBe('/import');
    expect((await screen.findByLabelText(copy.importFlow.name.textLabel) as HTMLTextAreaElement).value).toBe('1 Sol Ring\n1 Cultivate');
    expect(screen.getByText(copy.importFlow.name.ready(2))).toBeTruthy();
  });

  it('opens the import empty when nothing was pasted, and does not remember an old paste', async () => {
    open('/');
    fireEvent.click(screen.getByRole('button', { name: copy.homePage.plan }));
    expect((await screen.findByLabelText(copy.importFlow.name.textLabel) as HTMLTextAreaElement).value).toBe('');
  });
});

describe('Walkthrough', () => {
  it('has the five steps with screenshot placeholders and the questions', () => {
    open('/walkthrough');
    expect(screen.getByRole('heading', { level: 1, name: copy.walkthroughPage.title })).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent).slice(0, 5)).toEqual(copy.walkthroughPage.steps.map(s => s.title));
    expect(screen.getAllByRole('img').map(i => i.getAttribute('aria-label'))).toContain('[SCREENSHOT: store dive]');
    expect(screen.getAllByText(/\[SCREENSHOT/)).toHaveLength(5);
    for (const item of copy.walkthroughPage.faq) expect(screen.getByText(item.q)).toBeTruthy();
  });

  it('Plan my first dive opens the import', () => {
    open('/walkthrough');
    fireEvent.click(screen.getByRole('button', { name: copy.walkthroughPage.plan }));
    expect(window.location.pathname).toBe('/import');
  });

  it('replays the tour in place: a welcome, three tips, then it closes', () => {
    open('/walkthrough');
    fireEvent.click(screen.getByRole('button', { name: copy.walkthroughPage.replay }));
    expect(screen.getByText(copy.tourFlow.dive.welcomeTitle)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: copy.tourFlow.show }));
    for (const tip of copy.tourFlow.dive.tips) {
      expect(screen.getByText(tip.title)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: screen.queryByRole('button', { name: copy.tour.next }) ? copy.tour.next : copy.tour.done }));
    }
    expect(screen.queryByRole('region', { name: copy.tourFlow.dive.label })).toBeNull();
  });

  it('Skip closes the replay at once', () => {
    open('/walkthrough');
    fireEvent.click(screen.getByRole('button', { name: copy.walkthroughPage.replay }));
    fireEvent.click(screen.getByRole('button', { name: copy.tourFlow.skip }));
    expect(screen.queryByRole('region', { name: copy.tourFlow.dive.label })).toBeNull();
  });
});

describe('About, Support and Privacy', () => {
  it('About says what it does and how it picks binders, and keeps the placeholders visible, unfilled', () => {
    open('/about');
    expect(screen.getByRole('heading', { level: 1, name: copy.aboutPage.title })).toBeTruthy();
    expect(screen.getByText(copy.aboutPage.howText)).toBeTruthy();
    expect(screen.getByText(copy.aboutPage.whoText)).toBeTruthy();
    expect(screen.getByText(copy.aboutPage.whoText).textContent).toContain('[ABOUT BEN');
    expect(screen.getByText(copy.aboutPage.credits[0])).toBeTruthy();
    expect(screen.getAllByText(copy.footer.fanContentDisclaimer).length).toBeGreaterThan(0);
  });

  it('Support links to Ko-fi, and says nothing about affiliate links while they are off', () => {
    open('/support');
    expect(screen.getByRole('link', { name: copy.supportPage.tipAction }).getAttribute('href')).toContain('ko-fi.com');
    expect(screen.queryByText(copy.supportPage.affiliate)).toBeNull();
    expect(screen.getByText(copy.supportPage.goText)).toBeTruthy();
  });

  it('Privacy covers only what the app does now: device storage, card data, store search, accounts and contact', () => {
    open('/privacy');
    const s = copy.privacyPage.sections;
    expect(screen.getByRole('heading', { level: 1, name: copy.privacyPage.title })).toBeTruthy();
    for (const section of [s.device, s.cards, s.stores, s.accounts, s.contact]) expect(screen.getByRole('heading', { name: section.title })).toBeTruthy();
    for (const section of [s.analytics, s.affiliate]) expect(screen.queryByRole('heading', { name: section.title })).toBeNull();
    expect(screen.getByText(s.stores.text)).toBeTruthy();
    expect(screen.getByText(new RegExp(copy.privacyPage.updated.replace(/[[\]]/g, '\\$&')))).toBeTruthy();
  });
});

describe('First-time tour on the store dive', () => {
  const card = { name: 'Soul Warden', printings: [pr({ setCode: 'fdn', setName: 'Foundations', setType: 'core', releasedAt: '2026-06-01', usd: '1.00' })] };

  async function dive(storage = new MemoryStorage()) {
    (storage as { persistent: boolean }).persistent = true;
    const list = makeList({ id: 'a', name: 'Deck', cards: [['Soul Warden']] });
    await storage.put('lists', list.id, list);
    await storage.put('trips', 'current', startTrip('t', T0, ['a']));
    await new CardsRepository(storage).put({ key: 'soul warden', summary: fakeSummary({ name: card.name }), printings: card.printings, fetchedAt: T0.toISOString() });
    return open('/dive', storage);
  }

  it('welcomes a first visit, and Skip is remembered on this device', async () => {
    const { storage, unmount } = await dive();
    fireEvent.click(await screen.findByRole('button', { name: copy.tourFlow.skip }));
    expect(screen.queryByRole('region', { name: copy.tourFlow.dive.label })).toBeNull();
    await waitFor(async () => expect(await storage.get('settings', 'pref:tour-dive')).toBe('yes'));
    unmount();
    await dive(storage);
    await screen.findByText(copy.storeDive.stopOf(1, 1));
    expect(screen.queryByRole('region', { name: copy.tourFlow.dive.label })).toBeNull();
  });

  it('Show me goes through the three tips, and finishing it is remembered too', async () => {
    const { storage } = await dive();
    fireEvent.click(await screen.findByRole('button', { name: copy.tourFlow.show }));
    expect(screen.getByText(copy.tourFlow.dive.tips[0].title)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: copy.tour.next }));
    fireEvent.click(screen.getByRole('button', { name: copy.tour.next }));
    fireEvent.click(screen.getByRole('button', { name: copy.tour.done }));
    expect(screen.queryByRole('region', { name: copy.tourFlow.dive.label })).toBeNull();
    await waitFor(async () => expect(await storage.get('settings', 'pref:tour-dive')).toBe('yes'));
  });
});

describe('Offline', () => {
  const setOnline = (online: boolean) => {
    Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
    act(() => { window.dispatchEvent(new Event(online ? 'online' : 'offline')); });
  };
  afterEach(() => setOnline(true));

  it('says so across the top while the device is offline, and goes when it is back', () => {
    open('/');
    expect(screen.queryByText(copy.offline.title)).toBeNull();
    setOnline(false);
    expect(screen.getByText(copy.offline.title)).toBeTruthy();
    expect(screen.getByText(copy.offline.text)).toBeTruthy();
    setOnline(true);
    expect(screen.queryByText(copy.offline.title)).toBeNull();
  });

  it('shows it when the page opens offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    open('/');
    expect(screen.getByText(copy.offline.title)).toBeTruthy();
  });
});
