import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CardThumb, CardTile, ListCard, ListRow, OddsLabel, ProgressBar, PullVerdict, QuantityBadge, Rank, SkeletonRow, StatusLabel,
  StepIndicator,
} from './index';
import type { CardTileProps } from './index';
import { CARD_STATUSES } from '../../core/status';
import { copy } from '../copy/en';

describe('StatusLabel', () => {
  it.each(CARD_STATUSES)('says %s in words', status => {
    render(<StatusLabel status={status} />);
    expect(screen.getByText(copy.status[status])).toBeTruthy();
  });

  it('uses the player words', () => {
    expect(copy.status).toEqual({ needed: 'Needed', in_collection: 'In collection', ordered: 'Ordered', proxy: 'Proxy', out_of_deck: 'Out of deck' });
  });
});

describe('PullVerdict', () => {
  it('shows the verdict in words, as a label and not a button', () => {
    render(<><PullVerdict verdict="worth_a_pull" /><PullVerdict verdict="buy_online" /><PullVerdict verdict="show_staff" /></>);
    expect(screen.getByText('Worth a pull')).toBeTruthy();
    expect(screen.getByText('Buy online')).toBeTruthy();
    expect(screen.getByText('Show staff')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('OddsLabel and QuantityBadge', () => {
  it('names each level', () => {
    render(<><OddsLabel level="best" /><OddsLabel level="good" /><OddsLabel level="fair" /><OddsLabel level="long_shot" /></>);
    for (const text of ['Best odds', 'Good odds', 'Fair odds', 'Long shot']) expect(screen.getByText(text)).toBeTruthy();
  });

  it('shows a quantity as ×N', () => {
    render(<QuantityBadge quantity={4} />);
    expect(screen.getByText('×4')).toBeTruthy();
  });
});

describe('ProgressBar', () => {
  it('is a progress bar with its count, named for what it counts', () => {
    render(<ProgressBar value={1} max={6} label="Cards found in this binder" caption="1 of 6 found" />);
    const bar = screen.getByRole('progressbar', { name: 'Cards found in this binder' });
    expect(bar.getAttribute('aria-valuenow')).toBe('1');
    expect(bar.getAttribute('aria-valuemax')).toBe('6');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(screen.getByText('1 of 6 found')).toBeTruthy();
  });

  it('fills in proportion', () => {
    render(<ProgressBar value={1} max={4} label="Copies" />);
    expect((screen.getByRole('progressbar').firstElementChild as HTMLElement).style.width).toBe('25%');
  });

  it('never goes below empty or above full', () => {
    const { rerender } = render(<ProgressBar value={9} max={4} label="Copies" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('4');
    expect((screen.getByRole('progressbar').firstElementChild as HTMLElement).style.width).toBe('100%');
    rerender(<ProgressBar value={-2} max={4} label="Copies" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });

  it('handles a max of 0 without dividing by zero', () => {
    render(<ProgressBar value={0} max={0} label="Copies" />);
    expect((screen.getByRole('progressbar').firstElementChild as HTMLElement).style.width).toBe('0%');
  });
});

describe('StepIndicator', () => {
  const steps = ['Name it', 'Look up cards', 'Fix names', 'What you own'];

  it('marks the current step and says where the player is', () => {
    render(<StepIndicator steps={steps} current={1} label="Import steps" />);
    const list = screen.getByRole('list', { name: 'Import steps' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[1].getAttribute('aria-current')).toBe('step');
    expect(items[0].hasAttribute('aria-current')).toBe(false);
    expect(within(items[1]).getByText('Step 2 of 4')).toBeTruthy();
  });

  it('says a finished step is done, in words, with a check mark', () => {
    render(<StepIndicator steps={steps} current={2} label="Import steps" />);
    expect(screen.getByText('Step 1 of 4, done')).toBeTruthy();
    expect(screen.getByText('Step 2 of 4, done')).toBeTruthy();
    expect(screen.getByText('Step 3 of 4')).toBeTruthy();
    expect(screen.getAllByText('✓')).toHaveLength(2);
  });

  describe('on a phone', () => {
    const setWidth = (width: number) => act(() => { window.innerWidth = width; window.dispatchEvent(new Event('resize')); });
    afterEach(() => setWidth(1024));

    it('shows only the current step by name, but still tells screen readers every step', () => {
      setWidth(375);
      render(<StepIndicator steps={steps} current={1} label="Import steps" />);
      expect(screen.getByText('Look up cards').className).not.toMatch(/srOnly/);
      for (const other of ['Name it', 'Fix names', 'What you own']) expect(screen.getByText(other).className).toMatch(/srOnly/);
      expect(screen.getByText('Step 1 of 4, done')).toBeTruthy();
      expect(screen.getByText('Step 4 of 4')).toBeTruthy();
    });

    it('shows every name on a tablet', () => {
      setWidth(800);
      render(<StepIndicator steps={steps} current={1} label="Import steps" />);
      for (const name of steps) expect(screen.getByText(name).className).not.toMatch(/srOnly/);
    });
  });

  it('shows the number for steps still to come', () => {
    render(<StepIndicator steps={steps} current={0} label="Import steps" />);
    expect(screen.getByText('4')).toBeTruthy();
  });
});

const tileProps = (over: Partial<CardTileProps> = {}): CardTileProps => ({
  name: 'Llanowar Elves', setLabel: 'FDN 227', price: '$0.30', lists: 'Elves 3 · Wishlist 1', imageUrl: '/card.svg', edge: 'Green',
  quantity: 1, found: 0, onFound: vi.fn(), onUndo: vi.fn(), ...over,
});
const renderTile = (props: CardTileProps) => render(<ul><CardTile {...props} /></ul>);

describe('CardTile', () => {
  it('shows the card name, set and number, price and lists', () => {
    renderTile(tileProps());
    for (const text of ['Llanowar Elves', 'FDN 227', '$0.30', 'Elves 3 · Wishlist 1']) expect(screen.getByText(text)).toBeTruthy();
  });

  it('one copy still to find: Found marks it', () => {
    const props = tileProps();
    renderTile(props);
    expect(screen.queryByText('×1')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Found' }));
    expect(props.onFound).toHaveBeenCalledTimes(1);
  });

  it('one copy found: Found · Undo takes it back', () => {
    const props = tileProps({ found: 1 });
    renderTile(props);
    const button = screen.getByRole('button', { name: 'Found · Undo' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button);
    expect(props.onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Found' })).toBeNull();
  });

  it('several copies: a ×N badge, progress in copies and Found +1', () => {
    const props = tileProps({ quantity: 4, found: 1 });
    renderTile(props);
    expect(screen.getByText('×4')).toBeTruthy();
    const bar = screen.getByRole('progressbar', { name: 'Llanowar Elves copies found' });
    expect(bar.getAttribute('aria-valuenow')).toBe('1');
    expect(bar.getAttribute('aria-valuemax')).toBe('4');
    expect(screen.getByText('1 of 4')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Found +1' }));
    expect(props.onFound).toHaveBeenCalledTimes(1);
  });

  it('several copies: the minus undoes one', () => {
    const props = tileProps({ quantity: 4, found: 1 });
    renderTile(props);
    fireEvent.click(screen.getByRole('button', { name: 'Undo one Llanowar Elves' }));
    expect(props.onUndo).toHaveBeenCalledTimes(1);
  });

  it('several copies, none found: nothing to undo yet', () => {
    renderTile(tileProps({ quantity: 4, found: 0 }));
    expect((screen.getByRole('button', { name: 'Undo one Llanowar Elves' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('several copies, all found: says so in words and offers no more Found', () => {
    renderTile(tileProps({ quantity: 4, found: 4 }));
    expect(screen.getByText('All 4 found')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Found +1' })).toBeNull();
    expect(screen.getByText('4 of 4')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Undo one Llanowar Elves' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows the card picture as given, as decoration beside the name', () => {
    const { container } = renderTile(tileProps());
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/card.svg');
    expect(img.getAttribute('alt')).toBe('');
  });

  it('without a picture it shows the name and "Image unavailable", and Found still works', () => {
    const props = tileProps({ imageUrl: null, name: 'Cultivate' });
    const { container } = renderTile(props);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('img', { name: 'Cultivate, image unavailable' })).toBeTruthy();
    expect(screen.getByText('Image unavailable')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Found' }));
    expect(props.onFound).toHaveBeenCalledTimes(1);
  });

  it('a picture that fails to load falls back to the same placeholder', () => {
    const { container } = renderTile(tileProps());
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('Image unavailable')).toBeTruthy();
  });

  it('opens card detail from the picture when onOpen is given', () => {
    const onOpen = vi.fn();
    renderTile(tileProps({ onOpen }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Llanowar Elves' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('has no open button without onOpen', () => {
    renderTile(tileProps());
    expect(screen.queryByRole('button', { name: /^Open / })).toBeNull();
  });

  it('every colour edge renders', () => {
    for (const edge of ['White', 'Blue', 'Black', 'Red', 'Green', 'Multicolor', 'Colorless', 'Land'] as const) {
      const { unmount } = renderTile(tileProps({ edge }));
      expect(screen.getByText('Llanowar Elves')).toBeTruthy();
      unmount();
    }
  });
});

describe('ListRow, Rank and CardThumb', () => {
  it('shows a card row: thumbnail, name, set line and price', () => {
    render(<ul><ListRow lead={<CardThumb edge="White" />} title="Ajani's Pridemate" subtitle="Foundations · FDN 135" trailing="$0.25" /></ul>);
    const row = screen.getByRole('listitem');
    for (const text of ["Ajani's Pridemate", 'Foundations · FDN 135', '$0.25']) expect(within(row).getByText(text)).toBeTruthy();
  });

  it('shows a binder row: rank, name, summary and verdict', () => {
    render(<ol><ListRow lead={<Rank n={1} />} title="Foundations" subtitle="6 cards · $3.40" trailing={<PullVerdict verdict="worth_a_pull" />} /></ol>);
    const row = screen.getByRole('listitem');
    expect(within(row).getByText('1')).toBeTruthy();
    expect(within(row).getByText('Worth a pull')).toBeTruthy();
  });

  it('does not need a subtitle, lead or trailing part', () => {
    render(<ul><ListRow title="Only a title" /></ul>);
    expect(screen.getByText('Only a title')).toBeTruthy();
  });
});

describe('ListCard', () => {
  const renderCard = (over: Partial<Parameters<typeof ListCard>[0]> = {}) => {
    const onInNextDiveChange = vi.fn();
    render(
      <ul>
        <ListCard
          kindLabel="Deck" title="Lifegain Commander" to="/lists/1" summary="11 needed of 13 · Updated today"
          thumbs={['White', 'Green']} inNextDive onInNextDiveChange={onInNextDiveChange}
          menu={<button type="button">menu slot</button>} {...over}
        />
      </ul>,
    );
    return { onInNextDiveChange };
  };

  it('shows the kind, name, summary and menu', () => {
    renderCard();
    expect(screen.getByText('Deck')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Lifegain Commander' }).getAttribute('href')).toBe('/lists/1');
    expect(screen.getByText('11 needed of 13 · Updated today')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'menu slot' })).toBeTruthy();
  });

  it('has an Open link to the same place', () => {
    renderCard();
    expect(screen.getByRole('link', { name: 'Open' }).getAttribute('href')).toBe('/lists/1');
  });

  it('has a switch that names the list and says whether it is in the next dive', () => {
    const { onInNextDiveChange } = renderCard();
    const toggle = screen.getByRole('switch', { name: 'Include Lifegain Commander in next dive' }) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    expect(onInNextDiveChange).toHaveBeenCalledWith(false);
  });

  it('works without a menu', () => {
    renderCard({ menu: undefined });
    expect(screen.queryByRole('button', { name: 'menu slot' })).toBeNull();
  });
});

describe('SkeletonRow', () => {
  it('tells screen readers something is loading', () => {
    render(<SkeletonRow />);
    expect(screen.getByRole('status', { name: copy.loading })).toBeTruthy();
  });
});
