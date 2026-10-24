import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeConnector, fakeSummary } from '../../connectors/fakeConnector';
import { pr } from '../../core/engine/fixtures';
import { startTrip } from '../../core/trip';
import { CardsRepository, MemoryStorage } from '../../storage';
import { App } from '../App';
import { copy } from '../copy/en';
import { T0, makeList } from '../testkit';
import type { AnalyticsConfig } from './AnalyticsProvider';

const goTo = (path: string) => window.history.replaceState(null, '', path);
beforeEach(() => goTo('/'));
afterEach(() => goTo('/'));

type Entry = Record<string, string | number | boolean>;

function setup(options: { enabled?: boolean; gtmId?: string } = {}) {
  const sent: Entry[] = [];
  const loaded: string[] = [];
  const modes: string[] = [];   // Consent Mode calls and the script load, in the order they happened
  const config: AnalyticsConfig = {
    enabled: options.enabled ?? true,
    gtmId: options.gtmId ?? 'GTM-TEST123',
    loadTagManager: id => { loaded.push(id); modes.push('load'); },
    consentMode: (command, state) => { modes.push(`${command}:${state}`); },
    send: entry => { sent.push(entry); },
  };
  return { sent, loaded, modes, config };
}

async function open(path: string, config: AnalyticsConfig, storage = new MemoryStorage(), prepare?: (s: MemoryStorage) => Promise<void>) {
  (storage as { persistent: boolean }).persistent = true;
  await prepare?.(storage);
  goTo(path);
  const view = render(<App storage={storage} clock={() => T0} connector={fakeConnector([]).connector} analytics={config} />);
  return { storage, ...view };
}

describe('the consent banner', () => {
  it('asks before anything is loaded or sent, with No thanks as easy as Allow', async () => {
    const { loaded, sent, config } = setup();
    await open('/', config);
    const banner = await screen.findByRole('region', { name: copy.consent.label });
    expect(within(banner).getByRole('button', { name: copy.consent.deny })).toBeTruthy();
    expect(within(banner).getByRole('button', { name: copy.consent.allow })).toBeTruthy();
    expect(within(banner).getByRole('link', { name: copy.consent.more })).toBeTruthy();
    expect(loaded).toEqual([]);
    expect(sent).toEqual([]);
  });

  it('Allow loads Tag Manager once and remembers the choice', async () => {
    const { loaded, config } = setup();
    const { storage } = await open('/', config);
    fireEvent.click(await screen.findByRole('button', { name: copy.consent.allow }));
    expect(screen.queryByRole('region', { name: copy.consent.label })).toBeNull();
    await waitFor(() => expect(loaded).toEqual(['GTM-TEST123']));
    await waitFor(async () => expect(await storage.get('settings', 'consent')).toBe('granted'));
  });

  it('No thanks loads nothing and sends nothing, and the question does not come back', async () => {
    const { loaded, sent, config } = setup();
    const { storage, unmount } = await open('/', config);
    fireEvent.click(await screen.findByRole('button', { name: copy.consent.deny }));
    await waitFor(async () => expect(await storage.get('settings', 'consent')).toBe('denied'));
    unmount();
    await open('/', config, storage);
    await screen.findByRole('heading', { level: 1, name: copy.homePage.title });
    expect(screen.queryByRole('region', { name: copy.consent.label })).toBeNull();
    expect(loaded).toEqual([]);
    expect(sent).toEqual([]);
  });

  it('is not shown, and nothing is loaded, while analytics is off or there is no container id', async () => {
    for (const options of [{ enabled: false }, { gtmId: '' }]) {
      const { loaded, config } = setup(options);
      const view = await open('/', config);
      await screen.findByRole('heading', { level: 1, name: copy.homePage.title });
      expect(screen.queryByRole('region', { name: copy.consent.label })).toBeNull();
      expect(loaded).toEqual([]);
      view.unmount();
    }
  });

  it('does nothing in the app as shipped, because there is no container id yet', async () => {
    goTo('/');
    render(<App storage={new MemoryStorage()} />);
    await screen.findByRole('heading', { level: 1, name: copy.homePage.title });
    expect(screen.queryByRole('region', { name: copy.consent.label })).toBeNull();
  });

  it('Change cookie choice on the privacy page asks again, and the page only describes analytics when it is on', async () => {
    const { config } = setup();
    await open('/privacy', config, new MemoryStorage(), async s => { await s.put('settings', 'consent', 'denied'); });
    expect(screen.queryByRole('region', { name: copy.consent.label })).toBeNull();
    expect(await screen.findByRole('heading', { name: copy.privacyPage.sections.analytics.title })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: copy.consent.change }));
    expect(await screen.findByRole('region', { name: copy.consent.label })).toBeTruthy();
  });

  it('leaves analytics out of the privacy page while it is off', async () => {
    const { config } = setup({ enabled: false });
    await open('/privacy', config);
    await screen.findByRole('heading', { level: 1, name: copy.privacyPage.title });
    expect(screen.queryByRole('heading', { name: copy.privacyPage.sections.analytics.title })).toBeNull();
    expect(screen.queryByRole('button', { name: copy.consent.change })).toBeNull();
  });
});

describe('Consent Mode', () => {
  it('starts as denied, before any choice, and loads nothing', async () => {
    const { modes, loaded, config } = setup();
    await open('/', config);
    await screen.findByRole('region', { name: copy.consent.label });
    expect(modes).toEqual(['default:denied']);
    expect(loaded).toEqual([]);
  });

  it('Allow says granted before Tag Manager loads', async () => {
    const { modes, config } = setup();
    await open('/', config);
    fireEvent.click(await screen.findByRole('button', { name: copy.consent.allow }));
    await waitFor(() => expect(modes).toContain('load'));
    expect(modes).toEqual(['default:denied', 'update:granted', 'load']);
  });

  it('No thanks never says granted', async () => {
    const { modes, config } = setup();
    await open('/', config);
    fireEvent.click(await screen.findByRole('button', { name: copy.consent.deny }));
    await waitFor(() => expect(screen.queryByRole('region', { name: copy.consent.label })).toBeNull());
    expect(modes).toEqual(['default:denied']);
  });

  it('withdrawing after Allow says denied again, and counting stops', async () => {
    const { modes, config } = setup();
    await open('/', config);
    fireEvent.click(await screen.findByRole('button', { name: copy.consent.allow }));
    await waitFor(() => expect(modes).toContain('load'));
    goTo('/privacy');
    window.dispatchEvent(new PopStateEvent('popstate'));
    fireEvent.click(await screen.findByRole('button', { name: copy.consent.change }));
    fireEvent.click(await screen.findByRole('button', { name: copy.consent.deny }));
    await waitFor(() => expect(modes).toContain('update:denied'));
    expect(modes.filter(m => m === 'load')).toHaveLength(1);
  });

  it('puts gtag-style consent commands on the data layer (Tag Manager only reads the arguments form)', async () => {
    window.dataLayer = [];
    const config: AnalyticsConfig = { enabled: true, gtmId: 'GTM-TEST123', loadTagManager: () => {} };
    await open('/', config);
    await screen.findByRole('region', { name: copy.consent.label });
    const entry = window.dataLayer[0] as ArrayLike<unknown>;
    expect(Object.prototype.toString.call(entry)).toBe('[object Arguments]');
    expect(Array.from(entry)).toEqual(['consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }]);
    window.dataLayer = undefined;
  });

  it('is not touched while analytics is unavailable', async () => {
    const { modes, config } = setup({ gtmId: '' });
    await open('/', config);
    await screen.findByRole('heading', { level: 1, name: copy.homePage.title });
    expect(modes).toEqual([]);
  });
});

describe('the events', () => {
  const card = { name: 'Soul Warden', printings: [pr({ setCode: 'fdn', setName: 'Foundations', setType: 'core', releasedAt: '2026-06-01', usd: '1.00' })] };
  const prepare = async (s: MemoryStorage) => {
    await s.put('settings', 'consent', 'granted');
    const list = makeList({ id: 'a', name: 'Secret Deck Name', cards: [['Soul Warden', 2]] });
    await s.put('lists', list.id, list);
    await s.put('trips', 'current', startTrip('t', T0, ['a']));
    await new CardsRepository(s).put({ key: 'soul warden', summary: fakeSummary({ name: card.name }), printings: card.printings, fetchedAt: T0.toISOString() });
  };

  it('counts a pasted list, with how many cards and where, and never its names', async () => {
    const { sent, config } = setup();
    await open('/import', config, new MemoryStorage(), async s => { await s.put('settings', 'consent', 'granted'); });
    fireEvent.change(await screen.findByLabelText(copy.importFlow.name.nameLabel), { target: { value: 'Secret Deck Name' } });
    fireEvent.change(screen.getByLabelText(copy.importFlow.name.textLabel), { target: { value: '1 Sol Ring\n1 Cultivate' } });
    fireEvent.click(screen.getByRole('button', { name: copy.importFlow.name.lookUp(2) }));
    await waitFor(() => expect(sent).toEqual([{ event: 'list_pasted', cards: 2, target: 'deck' }]));
  });

  it('counts a visit to the plan once, with cards and places', async () => {
    const { sent, config } = setup();
    await open('/plan', config, new MemoryStorage(), prepare);
    await waitFor(() => expect(sent).toEqual([{ event: 'plan_viewed', cards: 2, stops: 1 }]));
  });

  it('counts a card found, and a place finished with how many copies were and were not found', async () => {
    const { sent, config } = setup();
    await open('/dive', config, new MemoryStorage(), prepare);
    fireEvent.click(await screen.findByRole('button', { name: copy.cardTile.foundPlusOne }));
    fireEvent.click(screen.getAllByRole('button', { name: copy.storeDive.finishBinder })[0]);
    await waitFor(() => expect(sent).toEqual([
      { event: 'card_found', stop_type: 'set_binder' },
      { event: 'stop_finished', stop_type: 'set_binder', found: 1, unfound: 1 },
    ]));
  });

  it('counts Buy the rest being tapped, with how many cards', async () => {
    const { sent, config } = setup();
    await open('/trip', config, new MemoryStorage(), async s => { await prepare(s); await s.put('trips', 'current', { ...startTrip('t', T0, ['a']), endedAt: T0.toISOString() }); });
    fireEvent.click(await screen.findByRole('button', { name: copy.tripEnd.buy.copy(2) }));
    await waitFor(() => expect(sent).toEqual([{ event: 'buy_rest_tapped', cards: 2 }]));
  });

  it('sends nothing without consent, and nothing about a name ever appears in what is sent', async () => {
    const { sent, config } = setup();
    await open('/dive', config, new MemoryStorage(), async s => { await prepare(s); await s.put('settings', 'consent', 'denied'); });
    fireEvent.click(await screen.findByRole('button', { name: copy.cardTile.foundPlusOne }));
    expect(sent).toEqual([]);
    act(() => undefined);
    expect(JSON.stringify(sent)).not.toContain('Soul Warden');
  });
});
