import type { ReactNode } from 'react';
import { copy } from '../copy/en';
import { cx } from '../cx';
import styles from './SummaryBar.module.css';

interface SummaryBarProps {
  title: string;        // "Next dive: 2 lists, 34 cards to find"
  detail?: string;      // which lists
  action?: ReactNode;   // Start store dive
  label?: string;
  sticky?: boolean;     // stays at the bottom of the screen while the list scrolls (phone)
}

// A one-line summary with the main action beside it, such as the next dive on My lists.
export function SummaryBar({ title, detail, action, label = copy.summaryBar.label, sticky = false }: SummaryBarProps) {
  return (
    <section aria-label={label} className={cx(styles.bar, sticky && styles.sticky)}>
      <div className={styles.text}>
        <span className={styles.title}>{title}</span>
        {detail && <span className={styles.detail}>{detail}</span>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </section>
  );
}
