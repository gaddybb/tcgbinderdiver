import type { ReactNode } from 'react';
import styles from './ListRow.module.css';

interface ListRowProps {
  lead?: ReactNode;        // a CardThumb for a card row, or a Rank for a binder row
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;    // a price, or a PullVerdict
}

// One row in a list: a card on a phone list, or a binder in the dive plan.
export function ListRow({ lead, title, subtitle, trailing }: ListRowProps) {
  return (
    <li className={styles.row}>
      {lead && <div className={styles.lead}>{lead}</div>}
      <div className={styles.body}>
        <div className={styles.title}>{title}</div>
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
