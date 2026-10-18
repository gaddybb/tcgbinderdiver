import type { ReactNode } from 'react';
import { copy } from '../copy/en';
import styles from './Chip.module.css';

// A chip is a toggle (pressed or not), or, with onRemove, a removable tag such as a set in a binder group.
type ChipProps =
  | { children: ReactNode; pressed: boolean; onPress: () => void; onRemove?: never; removeLabel?: never }
  | { children: ReactNode; onRemove: () => void; removeLabel?: string; pressed?: never; onPress?: never };

export function Chip(props: ChipProps) {
  if (props.onRemove) {
    return (
      <span className={styles.removable}>
        {props.children}
        <button type="button" className={styles.remove} aria-label={props.removeLabel ?? copy.common.remove} onClick={props.onRemove}>✕</button>
      </span>
    );
  }
  return (
    <button type="button" className={styles.chip} aria-pressed={props.pressed} onClick={props.onPress}>
      {props.children}
    </button>
  );
}
