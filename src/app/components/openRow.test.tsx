import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { copy } from '../copy/en';
import { CardTable } from './CardTable';
import { CardThumb } from './CardImage';
import { ListRow } from './ListRow';

describe('Opening card detail from a row', () => {
  it('a list row opens from its title', () => {
    const onOpen = vi.fn();
    render(<ul><ListRow lead={<CardThumb edge="White" />} title="Sol Ring" onOpen={onOpen} openLabel="Open Sol Ring" /></ul>);
    fireEvent.click(screen.getByRole('button', { name: 'Open Sol Ring' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('the picture opens it too, but is left out of the tab order since the title does the same', () => {
    const onOpen = vi.fn();
    const { container } = render(<ul><ListRow lead={<CardThumb edge="White" />} title="Sol Ring" onOpen={onOpen} openLabel="Open Sol Ring" /></ul>);
    const picture = container.querySelector('button[tabindex="-1"]') as HTMLButtonElement;
    fireEvent.click(picture);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('a long press starts selecting without also opening the card', async () => {
    const onOpen = vi.fn();
    const onLongPress = vi.fn();
    render(<ul><ListRow title="Sol Ring" onOpen={onOpen} openLabel="Open Sol Ring" onLongPress={onLongPress} /></ul>);
    const title = screen.getByRole('button', { name: 'Open Sol Ring' });
    fireEvent.pointerDown(title);
    await act(async () => { await new Promise(r => setTimeout(r, 600)); });
    fireEvent.pointerUp(title);
    fireEvent.click(title);
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
    // The next plain tap opens it.
    fireEvent.click(title);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('a table row opens from its name', () => {
    const onOpen = vi.fn();
    const labels = { table: 'Cards', image: 'Image', card: 'Card', status: 'Status', target: 'Target', set: 'Set', price: 'Price' };
    render(<CardTable labels={labels} rows={[{ key: 'k', thumb: <CardThumb edge="White" />, name: 'Sol Ring', quantity: 1, status: 'Needed', target: 'Commander box', setLabel: 'CMD 263', price: '$1.75', onOpen }]} />);
    fireEvent.click(screen.getByRole('button', { name: copy.cardTile.openCard('Sol Ring') }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
