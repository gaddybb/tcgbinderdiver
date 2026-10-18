import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmptyState, ListCard, Menu, MenuList, PageHeader, SummaryBar } from './index';
import { copy } from '../copy/en';

describe('PageHeader', () => {
  it('has the screen\'s h1, a line of help and the action', () => {
    render(<PageHeader title="My lists" subtitle="Turn lists on." actions={<button type="button">Paste a new list</button>} />);
    expect(screen.getByRole('heading', { level: 1, name: 'My lists' })).toBeTruthy();
    expect(screen.getByText('Turn lists on.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Paste a new list' })).toBeTruthy();
  });

  it('can sit lower in the page', () => {
    render(<PageHeader level={3} title="Inside" />);
    expect(screen.getByRole('heading', { level: 3, name: 'Inside' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });
});

describe('SummaryBar', () => {
  it('is a labelled region with the summary, detail and action', () => {
    render(<SummaryBar title="Next dive: 2 lists, 34 cards to find" detail="Lifegain Commander and Wishlist" action={<button type="button">Start store dive</button>} />);
    const region = screen.getByRole('region', { name: copy.summaryBar.label });
    expect(region.textContent).toContain('Next dive: 2 lists, 34 cards to find');
    expect(region.textContent).toContain('Lifegain Commander and Wishlist');
    expect(screen.getByRole('button', { name: 'Start store dive' })).toBeTruthy();
  });

  it('works with only a title', () => {
    render(<SummaryBar title="Only this" />);
    expect(screen.getByText('Only this')).toBeTruthy();
  });
});

describe('EmptyState', () => {
  it('says what is missing and what to do', () => {
    render(<EmptyState title="No lists yet" actions={<button type="button">Paste a decklist</button>}>Paste a decklist and go.</EmptyState>);
    expect(screen.getByRole('heading', { name: 'No lists yet' })).toBeTruthy();
    expect(screen.getByText('Paste a decklist and go.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Paste a decklist' })).toBeTruthy();
  });
});

describe('ListCard renaming', () => {
  const renderCard = (over: Partial<{ value: string; error: string }> = {}) => {
    const rename = { value: 'Zombie Tribal', onChange: vi.fn(), onSave: vi.fn(), onCancel: vi.fn(), ...over };
    render(
      <ul>
        <ListCard kindLabel="Deck" title="Zombie Tribal" to="/lists/z" summary="38 needed of 100" thumbs={[]} inNextDive onInNextDiveChange={() => {}} rename={rename} />
      </ul>,
    );
    return rename;
  };

  it('replaces the title with a field holding the name, and Save and Cancel', () => {
    renderCard();
    expect((screen.getByLabelText(copy.listCard.nameLabel) as HTMLInputElement).value).toBe('Zombie Tribal');
    expect(screen.getByRole('button', { name: copy.common.save })).toBeTruthy();
    expect(screen.getByRole('button', { name: copy.common.cancel })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Zombie Tribal' })).toBeNull();
  });

  it('focuses the field so typing replaces the name right away', () => {
    renderCard();
    expect(document.activeElement).toBe(screen.getByLabelText(copy.listCard.nameLabel));
  });

  it('reports typing', () => {
    const rename = renderCard();
    fireEvent.change(screen.getByLabelText(copy.listCard.nameLabel), { target: { value: 'Zombies' } });
    expect(rename.onChange).toHaveBeenCalledWith('Zombies');
  });

  it('Enter and the Save button save; Escape and Cancel give up', () => {
    const rename = renderCard();
    const field = screen.getByLabelText(copy.listCard.nameLabel);
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(rename.onSave).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: copy.common.save }));
    expect(rename.onSave).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(rename.onCancel).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: copy.common.cancel }));
    expect(rename.onCancel).toHaveBeenCalledTimes(2);
  });

  it('shows a problem under the field', () => {
    renderCard({ error: 'Give the list a name.' });
    expect(screen.getByRole('alert').textContent).toBe('Give the list a name.');
  });

  it('shows no card thumbnails when there are none yet', () => {
    const { container } = render(
      <ul><ListCard kindLabel="Deck" title="No thumbs" to="/x" summary="s" thumbs={[]} inNextDive={false} onInNextDiveChange={() => {}} /></ul>,
    );
    expect(container.querySelector('[class*="thumb"]')).toBeNull();
  });
});

describe('Menu hints and the phone sheet', () => {
  const setWidth = (width: number) => act(() => { window.innerWidth = width; window.dispatchEvent(new Event('resize')); });
  afterEach(() => setWidth(1024));

  const items = [
    { label: 'Rename', onSelect: vi.fn() },
    { label: 'Duplicate', hint: 'Makes Zombie Tribal copy', onSelect: vi.fn() },
    { label: 'Delete list', hint: 'Asks you to confirm first', danger: true, onSelect: vi.fn() },
  ];

  it('MenuList shows hints only when asked', () => {
    const { rerender } = render(<MenuList label="List actions" items={items} />);
    expect(screen.queryByText('Makes Zombie Tribal copy')).toBeNull();
    rerender(<MenuList label="List actions" items={items} showHints />);
    expect(screen.getByText('Makes Zombie Tribal copy')).toBeTruthy();
    expect(screen.getByText('Asks you to confirm first')).toBeTruthy();
  });

  it('on a tablet or desktop it is a popup without hints, even when a sheet title is set', () => {
    setWidth(1024);
    render(<Menu label="More for Zombie Tribal" sheetTitle="Zombie Tribal" items={items} />);
    fireEvent.click(screen.getByRole('button', { name: 'More for Zombie Tribal' }));
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Makes Zombie Tribal copy')).toBeNull();
  });

  it('on a phone with a sheet title it is a bottom sheet with hints and Cancel', () => {
    setWidth(375);
    render(<Menu label="More for Zombie Tribal" sheetTitle="Zombie Tribal" items={items} />);
    fireEvent.click(screen.getByRole('button', { name: 'More for Zombie Tribal' }));
    expect(screen.getByRole('dialog', { name: 'Zombie Tribal' })).toBeTruthy();
    expect(screen.getByText('Makes Zombie Tribal copy')).toBeTruthy();
    expect(screen.getByRole('button', { name: copy.common.cancel })).toBeTruthy();
  });

  it('on a phone without a sheet title it stays a popup', () => {
    setWidth(375);
    render(<Menu label="More" items={items} />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('choosing from the sheet runs the item and closes it, returning to the button', () => {
    setWidth(375);
    const onSelect = vi.fn();
    render(<Menu label="More for Zombie Tribal" sheetTitle="Zombie Tribal" items={[{ label: 'Rename', onSelect }]} />);
    const trigger = screen.getByRole('button', { name: 'More for Zombie Tribal' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('Cancel and Escape close the sheet without choosing', () => {
    setWidth(375);
    const onSelect = vi.fn();
    render(<Menu label="More for Zombie Tribal" sheetTitle="Zombie Tribal" items={[{ label: 'Rename', onSelect }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'More for Zombie Tribal' }));
    fireEvent.click(screen.getByRole('button', { name: copy.common.cancel }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More for Zombie Tribal' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
