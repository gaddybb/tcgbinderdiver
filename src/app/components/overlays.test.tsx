import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Banner, BinderPicker, Dialog, DialogPanel, GameAnchor, Logo, Menu, MenuList, Sheet, SheetPanel, TabBar, TOAST_DURATION_MS,
  ToastProvider, ToastView, TourTip, useToast,
} from './index';
import { copy } from '../copy/en';

describe('Banner', () => {
  it('announces an error right away, and the others politely', () => {
    render(<><Banner tone="error" title="Bad" /><Banner tone="warning" title="Careful" /><Banner tone="info" title="FYI" /></>);
    expect(screen.getAllByRole('alert').map(e => e.textContent)).toEqual(['Bad']);
    expect(screen.getAllByRole('status').map(e => e.textContent)).toEqual(['Careful', 'FYI']);
  });

  it('shows a detail line and actions', () => {
    render(<Banner tone="info" title="Finishing" actions={<button type="button">Retry</button>}>9 of 14 cards looked up</Banner>);
    expect(screen.getByText('9 of 14 cards looked up')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});

describe('ToastView', () => {
  it('shows the message and Undo', () => {
    const onAction = vi.fn();
    render(<ToastView message="Soul Warden found" onAction={onAction} />);
    expect(screen.getByRole('status').textContent).toContain('Soul Warden found');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('has no button when there is nothing to undo', () => {
    render(<ToastView message="Saved" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('ToastProvider', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function Trigger(props: Parameters<ReturnType<typeof useToast>['show']>[0]) {
    const toast = useToast();
    return <button type="button" onClick={() => toast.show(props)}>show</button>;
  }
  const show = () => fireEvent.click(screen.getByRole('button', { name: 'show' }));

  it('lasts 5 seconds', () => {
    expect(TOAST_DURATION_MS).toBe(5000);
    render(<ToastProvider><Trigger message="Soul Warden found" /></ToastProvider>);
    show();
    expect(screen.getByText('Soul Warden found')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(4999); });
    expect(screen.queryByText('Soul Warden found')).not.toBeNull();
    act(() => { vi.advanceTimersByTime(2); });
    expect(screen.queryByText('Soul Warden found')).toBeNull();
  });

  it('Undo runs the action and closes the toast', () => {
    const onAction = vi.fn();
    render(<ToastProvider><Trigger message="Deleted" onAction={onAction} /></ToastProvider>);
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Deleted')).toBeNull();
  });

  it('a new toast replaces the old one and restarts the 5 seconds', () => {
    function Two() {
      const toast = useToast();
      return (
        <>
          <button type="button" onClick={() => toast.show({ message: 'First' })}>first</button>
          <button type="button" onClick={() => toast.show({ message: 'Second' })}>second</button>
        </>
      );
    }
    render(<ToastProvider><Two /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'first' }));
    act(() => { vi.advanceTimersByTime(3000); });
    fireEvent.click(screen.getByRole('button', { name: 'second' }));
    expect(screen.queryByText('First')).toBeNull();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.queryByText('Second')).not.toBeNull();
    act(() => { vi.advanceTimersByTime(2100); });
    expect(screen.queryByText('Second')).toBeNull();
  });

  it('can use its own duration and a custom action word', () => {
    render(<ToastProvider><Trigger message="Hi" durationMs={1000} actionLabel="Back" onAction={() => {}} /></ToastProvider>);
    show();
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1001); });
    expect(screen.queryByText('Hi')).toBeNull();
  });

  it('useToast outside a provider says what is missing', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Trigger message="x" />)).toThrow(/ToastProvider/);
    error.mockRestore();
  });
});

describe('Menu', () => {
  const setup = () => {
    const onSelect = [vi.fn(), vi.fn(), vi.fn()];
    render(
      <div>
        <Menu
          label="More for Lifegain Commander"
          items={[{ label: 'Rename', onSelect: onSelect[0] }, { label: 'Duplicate', onSelect: onSelect[1] }, { label: 'Delete list', onSelect: onSelect[2], danger: true }]}
        />
        <button type="button">outside</button>
      </div>,
    );
    return { onSelect, trigger: () => screen.getByRole('button', { name: 'More for Lifegain Commander' }) };
  };

  it('starts closed and says so', () => {
    const { trigger } = setup();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger().getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('opens on click, names the menu and focuses the first item', () => {
    const { trigger } = setup();
    fireEvent.click(trigger());
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('menu', { name: 'More for Lifegain Commander' })).toBeTruthy();
    expect(screen.getAllByRole('menuitem').map(i => i.textContent)).toEqual(['Rename', 'Duplicate', 'Delete list']);
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Rename' }));
  });

  it('moves with the arrow keys, wrapping at both ends', () => {
    const { trigger } = setup();
    fireEvent.click(trigger());
    const menu = screen.getByRole('menu');
    const focused = () => (document.activeElement as HTMLElement).textContent;
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(focused()).toBe('Duplicate');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(focused()).toBe('Rename');
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(focused()).toBe('Delete list');
    fireEvent.keyDown(menu, { key: 'Home' });
    expect(focused()).toBe('Rename');
    fireEvent.keyDown(menu, { key: 'End' });
    expect(focused()).toBe('Delete list');
  });

  it('Escape closes it and returns to the button', () => {
    const { trigger } = setup();
    fireEvent.click(trigger());
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('choosing an item runs it, closes the menu and returns to the button', () => {
    const { trigger, onSelect } = setup();
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(onSelect[1]).toHaveBeenCalledTimes(1);
    expect(onSelect[0]).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('a click outside closes it', () => {
    const { trigger } = setup();
    fireEvent.click(trigger());
    fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('a click inside does not close it', () => {
    const { trigger } = setup();
    fireEvent.click(trigger());
    fireEvent.mouseDown(screen.getByRole('menu'));
    expect(screen.queryByRole('menu')).not.toBeNull();
  });

  it('clicking the button again closes it', () => {
    const { trigger } = setup();
    fireEvent.click(trigger());
    fireEvent.click(trigger());
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Tab closes it', () => {
    const { trigger } = setup();
    fireEvent.click(trigger());
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Tab' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('MenuList alone shows the items without a trigger', () => {
    render(<MenuList label="List actions" items={[{ label: 'Rename', onSelect: () => {} }]} />);
    expect(screen.getByRole('menu', { name: 'List actions' })).toBeTruthy();
  });
});

function ModalHarness({ kind }: { kind: 'sheet' | 'dialog' }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>open</button>
      {kind === 'sheet'
        ? <Sheet open={open} onClose={close} title="Pull order"><button type="button">first</button><button type="button">last</button></Sheet>
        : <Dialog open={open} onClose={close} title="End this trip?" actions={<><button type="button" onClick={close}>Keep diving</button><button type="button">End trip</button></>}>Can't be undone.</Dialog>}
    </>
  );
}

describe.each([['sheet', 'Pull order'], ['dialog', 'End this trip?']] as const)('%s as a modal', (kind, title) => {
  const open = () => fireEvent.click(screen.getByRole('button', { name: 'open' }));

  it('renders nothing while closed', () => {
    render(<ModalHarness kind={kind} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens as a labelled modal dialog', () => {
    render(<ModalHarness kind={kind} />);
    open();
    const dialog = screen.getByRole('dialog', { name: title });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('moves focus inside', () => {
    render(<ModalHarness kind={kind} />);
    open();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('Escape closes it and focus goes back to the button that opened it', () => {
    render(<ModalHarness kind={kind} />);
    const opener = screen.getByRole('button', { name: 'open' });
    opener.focus();
    open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('a press on the dimmed background closes it, a press inside does not', () => {
    render(<ModalHarness kind={kind} />);
    open();
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).not.toBeNull();
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps Tab inside, wrapping from last to first and back', () => {
    render(<ModalHarness kind={kind} />);
    open();
    const buttons = Array.from(screen.getByRole('dialog').querySelectorAll('button'));
    const first = buttons[0], last = buttons[buttons.length - 1];
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('stops the page behind from scrolling while open', () => {
    render(<ModalHarness kind={kind} />);
    open();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.body.style.overflow).toBe('');
  });
});

describe('Dialog actions', () => {
  it('lets the player choose', () => {
    render(<ModalHarness kind="dialog" />);
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    expect(screen.getByText("Can't be undone.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep diving' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('panels shown in place', () => {
  it('SheetPanel and DialogPanel are plain content, not modals', () => {
    render(<><SheetPanel title="Bottom sheet">Body</SheetPanel><DialogPanel title="End this trip?" actions={<button type="button">End trip</button>}>Text</DialogPanel></>);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Bottom sheet')).toBeTruthy();
    expect(screen.getByText('End this trip?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'End trip' })).toBeTruthy();
  });
});

describe('TourTip', () => {
  it('shows where the player is in the tour, with Skip and Next', () => {
    const onSkip = vi.fn(), onNext = vi.fn();
    render(<TourTip step={1} total={3} title="Find a binder" onSkip={onSkip} onNext={onNext}>Pick a stop here.</TourTip>);
    expect(screen.getByText('1 of 3')).toBeTruthy();
    expect(screen.getByText('Pick a stop here.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: copy.tour.skip }));
    fireEvent.click(screen.getByRole('button', { name: copy.tour.next }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('the last tip says Done and has no Skip', () => {
    render(<TourTip step={3} total={3} title="Finish" onSkip={() => {}} onNext={() => {}}>Last one.</TourTip>);
    expect(screen.getByRole('button', { name: copy.tour.done })).toBeTruthy();
    expect(screen.queryByRole('button', { name: copy.tour.skip })).toBeNull();
    expect(screen.queryByRole('button', { name: copy.tour.next })).toBeNull();
  });
});

describe('TabBar', () => {
  const items = [
    { id: 'lists', label: 'Lists', to: '/lists' },
    { id: 'plan', label: 'Plan', to: '/plan' },
    { id: 'dive', label: 'Dive', to: '/dive' },
  ];

  it('links each tab and names the current one', () => {
    render(<TabBar items={items} current="dive" />);
    expect(screen.getByRole('navigation', { name: copy.tabs.label })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Plan' }).getAttribute('href')).toBe('/plan');
    expect(screen.getByRole('link', { name: 'Dive' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Lists' }).hasAttribute('aria-current')).toBe(false);
  });
});

describe('BinderPicker', () => {
  const options = [{ value: 'a', label: '1. Foundations' }, { value: 'b', label: '2. Commander Box' }, { value: 'c', label: '3. Case' }];

  function Harness({ start }: { start: string }) {
    const [value, setValue] = useState(start);
    return <BinderPicker label="Binder" options={options} value={value} onChange={setValue} />;
  }

  it('shows the current binder', () => {
    render(<Harness start="b" />);
    expect((screen.getByLabelText('Binder') as HTMLSelectElement).value).toBe('b');
  });

  it('Next and Previous move one binder', () => {
    render(<Harness start="b" />);
    fireEvent.click(screen.getByRole('button', { name: copy.picker.next }));
    expect((screen.getByLabelText('Binder') as HTMLSelectElement).value).toBe('c');
    fireEvent.click(screen.getByRole('button', { name: copy.picker.previous }));
    fireEvent.click(screen.getByRole('button', { name: copy.picker.previous }));
    expect((screen.getByLabelText('Binder') as HTMLSelectElement).value).toBe('a');
  });

  it('cannot go before the first or after the last', () => {
    const { unmount } = render(<Harness start="a" />);
    expect((screen.getByRole('button', { name: copy.picker.previous }) as HTMLButtonElement).disabled).toBe(true);
    unmount();
    render(<Harness start="c" />);
    expect((screen.getByRole('button', { name: copy.picker.next }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('the dropdown picks any binder', () => {
    render(<Harness start="a" />);
    fireEvent.change(screen.getByLabelText('Binder'), { target: { value: 'c' } });
    expect((screen.getByLabelText('Binder') as HTMLSelectElement).value).toBe('c');
  });
});

describe('Brand', () => {
  it('the logo is decoration; the game anchor is named', () => {
    const { container } = render(<><Logo size="sm" /><Logo size="lg" /><GameAnchor /></>);
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2);
    expect(screen.getByRole('img', { name: copy.kit.sample.anchorLabel })).toBeTruthy();
  });
});
