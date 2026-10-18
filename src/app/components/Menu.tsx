import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { cx } from '../cx';
import { Button } from './Button';
import styles from './Menu.module.css';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

interface MenuListProps {
  label: string;
  items: readonly MenuItem[];
  onItemSelected?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLUListElement>) => void;
}

// The list itself, so the kit gallery can show it without a trigger.
export function MenuList({ label, items, onItemSelected, onKeyDown }: MenuListProps) {
  return (
    <ul role="menu" aria-label={label} className={styles.list} onKeyDown={onKeyDown}>
      {items.map(item => (
        <li key={item.label} role="none">
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={cx(styles.item, item.danger && styles.danger)}
            onClick={() => { item.onSelect(); onItemSelected?.(); }}
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

interface MenuProps {
  label: string;               // names the button and the menu, for example "More for Lifegain Commander"
  items: readonly MenuItem[];
  trigger?: ReactNode;         // defaults to the "⋯" icon
}

// A button that opens a menu. Arrow keys move, Escape closes and returns to the button, a click outside closes.
export function Menu({ label, items, trigger = '⋯' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popupId = useId();

  const itemButtons = () => Array.from(wrapRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
  const triggerButton = () => wrapRef.current?.querySelector<HTMLButtonElement>('[aria-haspopup]');

  useEffect(() => {
    if (!open) return;
    itemButtons()[0]?.focus();
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerButton()?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const buttons = itemButtons();
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') { event.preventDefault(); close(true); }
    else if (event.key === 'Tab') close(false);
    else if (event.key === 'ArrowDown') { event.preventDefault(); buttons[(index + 1) % buttons.length]?.focus(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); buttons[(index - 1 + buttons.length) % buttons.length]?.focus(); }
    else if (event.key === 'Home') { event.preventDefault(); buttons[0]?.focus(); }
    else if (event.key === 'End') { event.preventDefault(); buttons[buttons.length - 1]?.focus(); }
  };

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <Button variant="icon" quiet aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? popupId : undefined} onClick={() => setOpen(o => !o)}>
        {trigger}
      </Button>
      {open && (
        <div id={popupId} className={styles.popup}>
          <MenuList label={label} items={items} onKeyDown={onKeyDown} onItemSelected={() => close(true)} />
        </div>
      )}
    </div>
  );
}
