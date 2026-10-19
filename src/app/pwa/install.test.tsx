import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeConnector } from '../../connectors/fakeConnector';
import { startTrip } from '../../core/trip';
import { MemoryStorage } from '../../storage';
import { App } from '../App';
import { copy } from '../copy/en';
import { T0, makeList } from '../testkit';
import { captureInstallOffer } from './install';

beforeAll(() => captureInstallOffer());
beforeEach(() => window.history.replaceState(null, '', '/'));
afterEach(() => { act(() => { window.dispatchEvent(new Event('appinstalled')); }); window.history.replaceState(null, '', '/'); });

// What the browser sends when the app can be installed.
function offerInstall(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const prompt = vi.fn(async () => undefined);
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome }) });
  act(() => { window.dispatchEvent(event); });
  return { prompt, event };
}

async function tripEnd(storage = new MemoryStorage()) {
  (storage as { persistent: boolean }).persistent = true;
  const list = makeList({ id: 'a', name: 'Deck', cards: [['Sol Ring']] });
  await storage.put('lists', list.id, list);
  await storage.put('trips', 'current', { ...startTrip('t', T0, ['a']), endedAt: T0.toISOString() });
  window.history.replaceState(null, '', '/trip');
  return { storage, ...render(<App storage={storage} clock={() => T0} connector={fakeConnector([]).connector} />) };
}

describe('the install offer', () => {
  it('is not shown when the browser has not offered to install', async () => {
    await tripEnd();
    await screen.findByRole('heading', { name: copy.tripEnd.title });
    expect(screen.queryByText(copy.install.title)).toBeNull();
  });

  it('is shown on the trip summary once the browser has offered, and keeps the browser from showing its own bar', async () => {
    const { event } = offerInstall();
    await tripEnd();
    expect(await screen.findByText(copy.install.title)).toBeTruthy();
    expect(event.defaultPrevented).toBe(true);
  });

  it('Install asks the browser to install, then goes away for good', async () => {
    const { prompt } = offerInstall();
    const { storage } = await tripEnd();
    fireEvent.click(await screen.findByRole('button', { name: copy.install.action }));
    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText(copy.install.title)).toBeNull());
    await waitFor(async () => expect(await storage.get('settings', 'pref:install-answered')).toBe('yes'));
  });

  it('Not now hides it, and it stays hidden the next time', async () => {
    offerInstall();
    const { storage, unmount } = await tripEnd();
    fireEvent.click(await screen.findByRole('button', { name: copy.install.later }));
    expect(screen.queryByText(copy.install.title)).toBeNull();
    await waitFor(async () => expect(await storage.get('settings', 'pref:install-answered')).toBe('yes'));
    unmount();
    await tripEnd(storage);
    await screen.findByRole('heading', { name: copy.tripEnd.title });
    expect(screen.queryByText(copy.install.title)).toBeNull();
  });

  it('is shown on the home page too, once the browser has offered', async () => {
    offerInstall();
    window.history.replaceState(null, '', '/');
    render(<App storage={new MemoryStorage()} clock={() => T0} connector={fakeConnector([]).connector} />);
    await screen.findByRole('heading', { level: 1, name: copy.homePage.title });
    expect(await screen.findByText(copy.install.title)).toBeTruthy();
  });

  it('is not shown on other pages', async () => {
    offerInstall();
    window.history.replaceState(null, '', '/lists');
    render(<App storage={new MemoryStorage()} clock={() => T0} connector={fakeConnector([]).connector} />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText(copy.install.title)).toBeNull();
  });
});
