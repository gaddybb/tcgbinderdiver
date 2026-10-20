import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../../../storage';
import { copy } from '../../copy/en';
import { StorageProvider } from '../../data/StorageProvider';
import { Tour } from './Tour';
import type { TourId } from './Tour';

const show = (id: TourId, storage = new MemoryStorage(), targets: string[] = []) => {
  const page = render(
    <StorageProvider storage={storage}>
      {targets.map(name => <div key={name} data-tour={name}>target</div>)}
      <Tour id={id} />
    </StorageProvider>,
  );
  return { storage, ...page };
};
const region = (id: TourId) => screen.queryByRole('region', { name: copy.tourFlow[id].label });

describe('Tour', () => {
  it.each(['dive', 'list', 'plan'] as const)('the %s tour welcomes, then goes through its tips in order, then is remembered', async id => {
    const { storage } = show(id);
    fireEvent.click(await screen.findByRole('button', { name: copy.tourFlow.show }));
    const tips = copy.tourFlow[id].tips;
    expect(tips.length).toBeGreaterThanOrEqual(2);
    expect(tips.length).toBeLessThanOrEqual(4);
    tips.forEach((tip, i) => {
      expect(screen.getByText(tip.title)).toBeTruthy();
      expect(screen.getByText(copy.tour.stepOf(i + 1, tips.length))).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: i === tips.length - 1 ? copy.tour.done : copy.tour.next }));
    });
    expect(region(id)).toBeNull();
    await waitFor(async () => expect(await storage.get('settings', `pref:tour-${id}`)).toBe('yes'));
  });

  it('Skip and Escape both close it and are remembered, and it does not come back on this device', async () => {
    const first = show('list');
    fireEvent.click(await screen.findByRole('button', { name: copy.tourFlow.skip }));
    expect(region('list')).toBeNull();
    await waitFor(async () => expect(await first.storage.get('settings', 'pref:tour-list')).toBe('yes'));
    first.unmount();

    const again = show('list', first.storage);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(region('list')).toBeNull();
    again.unmount();

    const other = show('plan');
    await screen.findByRole('region', { name: copy.tourFlow.plan.label });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(region('plan')).toBeNull();
    await waitFor(async () => expect(await other.storage.get('settings', 'pref:tour-plan')).toBe('yes'));
  });

  it('each tour is remembered on its own', async () => {
    const storage = new MemoryStorage();
    await storage.put('settings', 'pref:tour-dive', 'yes');
    show('plan', storage);
    expect(await screen.findByRole('region', { name: copy.tourFlow.plan.label })).toBeTruthy();
  });

  it('lights up the target and sits beside it, and falls back to a centered tip when the target is not on screen', async () => {
    const rect = { top: 100, left: 20, width: 200, height: 40, bottom: 140, right: 220, x: 20, y: 100, toJSON: () => ({}) };
    const original = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () { return this.hasAttribute('data-tour') ? rect : original.call(this); };
    try {
      show('list', new MemoryStorage(), ['list-controls']);
      fireEvent.click(await screen.findByRole('button', { name: copy.tourFlow.show }));
      expect(screen.getByTestId('tour-spotlight')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: copy.tour.next }));   // list-cards is not on this page
      expect(screen.queryByTestId('tour-spotlight')).toBeNull();
      expect(screen.getByText(copy.tourFlow.list.tips[1].title)).toBeTruthy();
    } finally {
      Element.prototype.getBoundingClientRect = original;
    }
  });
});
