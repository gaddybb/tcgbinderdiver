import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './SelectionBar.module.css';

interface SelectionBarProps {
  label: string;               // "3 cards selected"
  actions: ReactNode;          // Buttons and Menus
  placement?: 'inline' | 'bottom';   // above the cards (tablet, desktop), or stuck to the bottom of the screen (phone)
  ariaLabel: string;
}

// The bar that appears once cards are selected: how many, and what to do with them.
export function SelectionBar({ label, actions, placement = 'inline', ariaLabel }: SelectionBarProps) {
  return (
    <section aria-label={ariaLabel} className={cx(styles.bar, placement === 'bottom' && styles.bottom)}>
      <span role="status" className={styles.count}>{label}</span>
      <div className={styles.actions}>{actions}</div>
    </section>
  );
}
