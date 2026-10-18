import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Button, CardTable, CardThumb, Checkbox, ListRow, SelectHeader, SelectionBar } from './index';
import { LONG_PRESS_MS } from './ListRow';
import { copy } from '../copy/en';

describe('Checkbox without visible words', () => {
  it('is still named for screen readers, and shows no text', () => {
    const { container } = render(<Checkbox hideLabel label="Select Sol Ring" />);
    expect(screen.getByRole('checkbox', { name: 'Select Sol Ring' })).toBeTruthy();
    expect(container.textContent).toBe('');
  });

  it('can show "some are selected"', () => {
    const { rerender } = render(<Checkbox hideLabel label="All" indeterminate onChange={() => {}} checked={false} />);
    expect((screen.getByRole('checkbox', { name: 'All' }) as HTMLInputElement).indeterminate).toBe(true);
    rerender(<Checkbox hideLabel label="All" onChange={() => {}} checked={false} />);
    expect((screen.getByRole('checkbox', { name: 'All' }) as HTMLInputElement).indeterminate).toBe(false);
  });

  it('keeps its visible label by default', () => {
    render(<Checkbox label="Include basics" />);
    expect(screen.getByLabelText('Include basics')).toBeTruthy();
    expect(screen.getByText('Include basics')).toBeTruthy();
  });
});

describe('SelectionBar', () => {
  it('says how many are selected and holds the actions', () => {
    render(<SelectionBar ariaLabel="Selected" label="3 cards selected" actions={<Button>Remove from list</Button>} />);
    const bar = screen.getByRole('region', { name: 'Selected' });
    expect(within(bar).getByRole('status').textContent).toBe('3 cards selected');
    expect(within(bar).getByRole('button', { name: 'Remove from list' })).toBeTruthy();
  });

  it('can stick to the bottom of a phone screen', () => {
    render(<SelectionBar placement="bottom" ariaLabel="Selected" label="3 cards selected" actions={<Button>Remove</Button>} />);
    expect(screen.getByRole('region', { name: 'Selected' })).toBeTruthy();
  });
});

describe('SelectHeader', () => {
  it('closes, counts and selects all', () => {
    const onClose = vi.fn(), onToggleAll = vi.fn();
    render(<SelectHeader count={3} allSelected={false} onClose={onClose} onToggleAll={onToggleAll} />);
    expect(screen.getByRole('status').textContent).toBe('3 selected');
    fireEvent.click(screen.getByRole('button', { name: copy.bulk.exitSelect }));
    fireEvent.click(screen.getByRole('button', { name: copy.bulk.selectAll }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onToggleAll).toHaveBeenCalledTimes(1);
  });

  it('offers Select none once everything is selected', () => {
    render(<SelectHeader count={9} allSelected onClose={() => {}} onToggleAll={() => {}} />);
    expect(screen.getByRole('button', { name: copy.bulk.deselectAll })).toBeTruthy();
    expect(screen.queryByRole('button', { name: copy.bulk.selectAll })).toBeNull();
  });
});

describe('CardTable with selection', () => {
  const rows = ['Sol Ring', 'Cultivate', 'Command Tower'].map(name => ({
    key: name, thumb: <CardThumb edge="White" />, name, quantity: 1, status: 'Needed', target: 'Foundations', setLabel: 'FDN 1', price: '$1',
  }));
  const labels = { table: 'Cards', ...copy.review.columns };
  const selection = (selected: string[], over = {}) => ({
    selected: new Set(selected), onToggle: vi.fn(), onToggleAll: vi.fn(), rowLabel: copy.bulk.selectCard, allLabel: copy.bulk.selectAllCards, ...over,
  });

  it('has no checkbox column unless asked', () => {
    render(<CardTable rows={rows} labels={labels} />);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('has a checkbox on every row, named for its card, checked when selected', () => {
    render(<CardTable rows={rows} labels={labels} selection={selection(['Cultivate'])} />);
    expect((screen.getByRole('checkbox', { name: 'Select Cultivate' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'Select Sol Ring' }) as HTMLInputElement).checked).toBe(false);
  });

  it('toggles a row and toggles all', () => {
    const sel = selection([]);
    render(<CardTable rows={rows} labels={labels} selection={sel} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Sol Ring' }));
    expect(sel.onToggle).toHaveBeenCalledWith('Sol Ring');
    fireEvent.click(screen.getByRole('checkbox', { name: copy.bulk.selectAllCards }));
    expect(sel.onToggleAll).toHaveBeenCalledTimes(1);
  });

  it('the select-all box is checked when every row is, and in between when some are', () => {
    const { rerender } = render(<CardTable rows={rows} labels={labels} selection={selection(['Sol Ring'])} />);
    const all = () => screen.getByRole('checkbox', { name: copy.bulk.selectAllCards }) as HTMLInputElement;
    expect(all().checked).toBe(false);
    expect(all().indeterminate).toBe(true);
    rerender(<CardTable rows={rows} labels={labels} selection={selection(['Sol Ring', 'Cultivate', 'Command Tower'])} />);
    expect(all().checked).toBe(true);
    expect(all().indeterminate).toBe(false);
  });

  it('ignores selected keys that are not among the rows shown', () => {
    render(<CardTable rows={rows} labels={labels} selection={selection(['Hidden card'])} />);
    const all = screen.getByRole('checkbox', { name: copy.bulk.selectAllCards }) as HTMLInputElement;
    expect(all.checked).toBe(false);
    expect(all.indeterminate).toBe(false);
  });
});

describe('ListRow, selecting', () => {
  it('shows a checkbox, and tapping anywhere on the row toggles it', () => {
    const onChange = vi.fn();
    render(<ul><ListRow title="Sol Ring" select={{ checked: false, label: 'Select Sol Ring', onChange }} /></ul>);
    fireEvent.click(screen.getByText('Sol Ring'));
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Sol Ring' }));
    expect(onChange).toHaveBeenCalledTimes(2);       // the box itself once, not twice
  });

  it('a button inside the row does not toggle it', () => {
    const onChange = vi.fn();
    render(<ul><ListRow title="Sol Ring" trailing={<button type="button">Status</button>} select={{ checked: true, label: 'Select Sol Ring', onChange }} /></ul>);
    fireEvent.click(screen.getByRole('button', { name: 'Status' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('has no checkbox when not selecting', () => {
    render(<ul><ListRow title="Sol Ring" /></ul>);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});

describe('ListRow, long press', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const row = (onLongPress: () => void, extra: Partial<Parameters<typeof ListRow>[0]> = {}) =>
    render(<ul><ListRow title="Sol Ring" onLongPress={onLongPress} {...extra} /></ul>);

  it('fires after the finger stays down long enough', () => {
    const onLongPress = vi.fn();
    row(onLongPress);
    fireEvent.pointerDown(screen.getByText('Sol Ring'));
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS - 1); });
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it.each(['pointerUp', 'pointerLeave', 'pointerCancel', 'pointerMove'] as const)('does not fire if the finger %s first', event => {
    const onLongPress = vi.fn();
    row(onLongPress);
    const el = screen.getByText('Sol Ring');
    fireEvent.pointerDown(el);
    fireEvent[event](el);
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS * 2); });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('does not start from a button inside the row', () => {
    const onLongPress = vi.fn();
    row(onLongPress, { trailing: <button type="button">Status</button> });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Status' }));
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS * 2); });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('does nothing once the row is already selecting', () => {
    const onLongPress = vi.fn();
    row(onLongPress, { select: { checked: false, label: 'Select', onChange: () => {} } });
    fireEvent.pointerDown(screen.getByText('Sol Ring'));
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS * 2); });
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
