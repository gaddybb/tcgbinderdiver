import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CardTable, CardThumb, Menu, StatusPicker } from './index';
import { CARD_STATUSES } from '../../core/status';
import { copy } from '../copy/en';

describe('Menu: choices with a check mark', () => {
  const items = (current: string) => ['Needed', 'Ordered', 'Proxy'].map(label => ({ label, hint: `About ${label}`, checked: label === current, onSelect: vi.fn() }));

  it('makes a choice list: radio items, with the current one checked and marked', () => {
    render(<Menu label="Pick" items={items('Ordered')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pick' }));
    const options = screen.getAllByRole('menuitemradio');
    expect(options.map(o => o.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(within(options[1]).getByText('✓')).toBeTruthy();
    expect(within(options[0]).queryByText('✓')).toBeNull();
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it('a menu with no checked items keeps plain menu items', () => {
    render(<Menu label="Pick" items={[{ label: 'Rename', onSelect: () => {} }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pick' }));
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeTruthy();
    expect(screen.queryByRole('menuitemradio')).toBeNull();
  });

  it('the arrow keys move through radio items too', () => {
    render(<Menu label="Pick" items={items('Needed')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pick' }));
    const menu = screen.getByRole('menu');
    expect((document.activeElement as HTMLElement).textContent).toContain('Needed');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect((document.activeElement as HTMLElement).textContent).toContain('Ordered');
    fireEvent.keyDown(menu, { key: 'End' });
    expect((document.activeElement as HTMLElement).textContent).toContain('Proxy');
  });

  it('shows the hints in the popup only when asked', () => {
    const { rerender } = render(<Menu label="Pick" items={items('Needed')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pick' }));
    expect(screen.queryByText('About Needed')).toBeNull();
    rerender(<Menu label="Pick" items={items('Needed')} showHints />);
    expect(screen.getByText('About Needed')).toBeTruthy();
  });

  it('can open from a button with words in it instead of an icon', () => {
    render(<Menu label="Status of Cultivate" variant="text" trigger={<span>Needed ▾</span>} items={items('Needed')} />);
    const trigger = screen.getByRole('button', { name: 'Status of Cultivate' });
    expect(trigger.textContent).toBe('Needed ▾');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
  });
});

describe('StatusPicker', () => {
  it('shows the current status on a button that names the card', () => {
    render(<StatusPicker cardName="Cultivate" status="ordered" onChange={() => {}} />);
    const button = screen.getByRole('button', { name: 'Status of Cultivate: Ordered' });
    expect(button.textContent).toContain('Ordered');
  });

  it('offers every status with its line, in order, and checks the current one', () => {
    render(<StatusPicker cardName="Cultivate" status="proxy" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Status of Cultivate/ }));
    const options = screen.getAllByRole('menuitemradio');
    expect(options).toHaveLength(CARD_STATUSES.length);
    CARD_STATUSES.forEach((status, i) => {
      expect(options[i].textContent).toContain(copy.status[status]);
      expect(options[i].textContent).toContain(copy.statusHint[status]);
      expect(options[i].getAttribute('aria-checked')).toBe(String(status === 'proxy'));
    });
  });

  it('reports the status that was chosen', () => {
    const onChange = vi.fn();
    render(<StatusPicker cardName="Cultivate" status="needed" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /^Status of Cultivate/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^In collection/ }));
    expect(onChange).toHaveBeenCalledWith('in_collection');
  });

  it('says nothing when the status it already has is chosen again', () => {
    const onChange = vi.fn();
    render(<StatusPicker cardName="Cultivate" status="needed" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /^Status of Cultivate/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Needed/ }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('CardTable', () => {
  const labels = { table: 'Cards on Lifegain Commander', image: 'Image', card: 'Card', status: 'Status', target: 'Target binder', set: 'Set and #', price: 'Avg online' };
  const rows = [
    { key: 'a', thumb: <span>thumb a</span>, name: "Ajani's Pridemate", quantity: 1, status: <button type="button">status a</button>, target: 'Foundations', setLabel: 'FDN 135', price: '$0.25' },
    { key: 'b', thumb: <span>thumb b</span>, name: 'Llanowar Elves', quantity: 4, status: <button type="button">status b</button>, target: 'Commander box', setLabel: 'FDC 9', price: '$0.30' },
  ];

  it('is a labelled table with a header for each column', () => {
    render(<CardTable rows={rows} labels={labels} />);
    expect(screen.getByRole('table', { name: 'Cards on Lifegain Commander' })).toBeTruthy();
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Image', 'Card', 'Status', 'Target binder', 'Set and #', 'Avg online']);
  });

  it('has a row per card with each value in its column', () => {
    render(<CardTable rows={rows} labels={labels} />);
    const cells = within(screen.getByRole('rowheader', { name: /Ajani/ }).closest('tr') as HTMLElement).getAllByRole('cell').map(c => c.textContent);
    expect(cells).toEqual(['thumb a', 'status a', 'Foundations', 'FDN 135', '$0.25']);
  });

  it('names each row by its card, and shows ×N for several copies only', () => {
    render(<CardTable rows={rows} labels={labels} />);
    expect(screen.getByRole('rowheader', { name: "Ajani's Pridemate" }).textContent).not.toContain('×');
    expect(screen.getByRole('rowheader', { name: /Llanowar Elves/ }).textContent).toContain('×4');
  });

  it('keeps the controls it was given live', () => {
    render(<CardTable rows={rows} labels={labels} />);
    expect(screen.getByRole('button', { name: 'status b' })).toBeTruthy();
  });

  it('is an empty table for no rows', () => {
    render(<CardTable rows={[]} labels={labels} />);
    expect(screen.getAllByRole('columnheader')).toHaveLength(6);
    expect(screen.queryAllByRole('rowheader')).toEqual([]);
  });
});

describe('CardThumb with a picture', () => {
  it('shows the picture as given, as decoration', () => {
    const { container } = render(<CardThumb edge="Green" src="https://img.example/a.jpg" />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://img.example/a.jpg');
    expect(img.getAttribute('alt')).toBe('');
  });

  it('is just the colour edge without one', () => {
    const { container } = render(<CardThumb edge="Green" />);
    expect(container.querySelector('img')).toBeNull();
    expect(render(<CardThumb edge="Green" src={null} />).container.querySelector('img')).toBeNull();
  });

  it('drops a picture that fails to load, leaving the edge', () => {
    const { container } = render(<CardThumb edge="Red" src="https://img.example/broken.jpg" />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('span')).not.toBeNull();
  });
});
