import { useRef } from 'react';
import type { MouseEvent, PointerEvent, ReactNode } from 'react';
import { cx } from '../cx';
import { Checkbox } from './Checkbox';
import styles from './ListRow.module.css';

// How long a finger must stay down on a row to start selecting.
export const LONG_PRESS_MS = 500;

export interface RowSelect {
  checked: boolean;
  label: string;               // "Select Sol Ring", read aloud
  onChange: () => void;
}

interface ListRowProps {
  lead?: ReactNode;        // a CardThumb for a card row, or a Rank for a binder row
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;    // a price, or a PullVerdict
  select?: RowSelect;      // while choosing cards: a checkbox in front, and the whole row toggles it
  onLongPress?: () => void;   // holding the row down (when not already choosing)
  onOpen?: () => void;        // opens card detail: the picture and the title become buttons
  openLabel?: string;         // "Open Sol Ring", read aloud
}

// One row in a list: a card on a phone list, or a binder in the dive plan.
export function ListRow({ lead, title, subtitle, trailing, select, onLongPress, onOpen, openLabel }: ListRowProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);   // a long press just fired: the click that ends it must not also open the card
  const open = () => { if (held.current) { held.current = false; return; } onOpen?.(); };
  const cancel = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  const longPress = onLongPress && !select
    ? {
        onPointerDown: (event: PointerEvent) => {
          if ((event.target as HTMLElement).closest('button:not([data-open]), a, input')) return;
          cancel();
          held.current = false;
          timer.current = setTimeout(() => { timer.current = null; held.current = true; onLongPress(); }, LONG_PRESS_MS);
        },
        onPointerUp: cancel,
        onPointerLeave: cancel,
        onPointerCancel: cancel,
        onPointerMove: cancel,
        onContextMenu: (event: MouseEvent) => event.preventDefault(),
      }
    : {};
  const toggle = select
    ? (event: MouseEvent) => { if (!(event.target as HTMLElement).closest('button, a, input, label')) select.onChange(); }
    : undefined;
  return (
    <li className={cx(styles.row, select && styles.selectable, select?.checked && styles.selected)} onClick={toggle} {...longPress}>
      {select && <div className={styles.lead}><Checkbox hideLabel label={select.label} checked={select.checked} onChange={select.onChange} /></div>}
      {lead && (
        <div className={styles.lead}>
          {onOpen ? <button type="button" tabIndex={-1} aria-hidden="true" className={styles.open} data-open onClick={open}>{lead}</button> : lead}
        </div>
      )}
      <div className={styles.body}>
        <div className={styles.title}>
          {onOpen ? <button type="button" className={styles.openTitle} data-open aria-label={openLabel} onClick={open}>{title}</button> : title}
        </div>
        {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      </div>
      {trailing && <div className={styles.trailing}>{trailing}</div>}
    </li>
  );
}

// The number in front of a binder row in the dive plan.
export function Rank({ n }: { n: number }) {
  return <span className={styles.rank}>{n}</span>;
}
