import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { copy } from '../copy/en';
import { cx } from '../cx';
import { useLayout } from '../layout/useLayout';
import { Button } from './Button';
import { Sheet } from './Sheet';
import styles from './Menu.module.css';

export interface MenuItem {
  label: string;
  hint?: string;       // a line under the label, shown in the phone sheet
  onSelect: () => void;
  danger?: boolean;
}

interface MenuListProps {
  label: string;
  items: readonly MenuItem[];
  showHints?: boolean;
  tabbable?: boolean;      // every item is a tab stop (in a sheet); otherwise arrow keys move between them
  onItemSelected?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLUListElement>) => void;
}

// The list itself, so the kit gallery can show it without a trigger.
export function MenuList({ label, items, showHints = false, tabbable = false, onItemSelected, onKeyDown }: MenuListProps) {
  return (
    <ul role="menu" aria-label={label} className={styles.list} onKeyDown={onKeyDown}>
      {items.map(item => (
        <li key={item.label} role="none">
          <button
            type="button"
            role="menuitem"
            tabIndex={tabbable ? 0 : -1}
            className={cx(styles.item, item.danger && styles.danger)}
            onClick={() => { item.onSelect(); onItemSelected?.(); }}
          >
            {item.label}
            {showHints && item.hint && <span className={styles.hint}>{item.hint}</span>}
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
  sheetTitle?: string;         // when set, a phone opens the menu as a bottom sheet with this title
}

const menuButtons = (root: ParentNode) => Array.from(root.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));

// A button that opens a menu. Arrow keys move, Escape closes and returns to the button, a click outside closes.
// On a phone, with a sheetTitle, the same items open in a bottom sheet with their hints and a Cancel button.
export function Menu({ label, items, trigger = '⋯', sheetTitle }: MenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popupId = useId();
  const asSheet = useLayout() === 'phone' && sheetTitle !== undefined;

  useEffect(() => {
    if (!open || asSheet) return;
    menuButtons(wrapRef.current!)[0]?.focus();
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, asSheet]);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) wrapRef.current?.querySelector<HTMLButtonElement>('[aria-haspopup]')?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const buttons = menuButtons(event.currentTarget);
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
      <Button variant="icon" quiet aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open && !asSheet ? popupId : undefined} onClick={() => setOpen(o => !o)}>
        {trigger}
      </Button>
      {open && !asSheet && (
        <div id={popupId} className={styles.popup}>
          <MenuList label={label} items={items} onKeyDown={onKeyDown} onItemSelected={() => close(true)} />
        </div>
      )}
      {asSheet && (
        <Sheet open={open} onClose={() => close(true)} title={sheetTitle}>
          <div className={styles.sheetList}>
            <MenuList label={label} items={items} showHints tabbable onItemSelected={() => close(true)} />
            <Button variant="secondary" fullWidth onClick={() => close(true)}>{copy.common.cancel}</Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
