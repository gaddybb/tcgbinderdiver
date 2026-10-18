import type { ReactNode } from 'react';
import { QuantityBadge } from './QuantityBadge';
import styles from './CardTable.module.css';

export interface CardTableRow {
  key: string;
  thumb: ReactNode;      // a CardThumb
  name: string;
  quantity: number;
  status: ReactNode;     // a StatusPicker
  target: string;        // the binder to look in, in words
  setLabel: string;      // "FDN 135"
  price: string;         // already formatted
}

export interface CardTableLabels {
  table: string;
  image: string;
  card: string;
  status: string;
  target: string;
  set: string;
  price: string;
}

interface CardTableProps {
  rows: readonly CardTableRow[];
  labels: CardTableLabels;
}

// A list's cards as a table, for tablet and desktop: picture, name, status, where to look, which printing, price.
export function CardTable({ rows, labels }: CardTableProps) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table} aria-label={labels.table}>
        <thead className={styles.head}>
          <tr>
            <th scope="col"><span className={styles.srOnly}>{labels.image}</span></th>
            <th scope="col">{labels.card}</th>
            <th scope="col">{labels.status}</th>
            <th scope="col">{labels.target}</th>
            <th scope="col">{labels.set}</th>
            <th scope="col" className={styles.number}>{labels.price}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.key} className={styles.row}>
              <td className={styles.thumb}>{row.thumb}</td>
              <th scope="row" className={styles.name}>
                {row.name}
                {row.quantity > 1 && <span className={styles.badge}><QuantityBadge quantity={row.quantity} /></span>}
              </th>
              <td>{row.status}</td>
              <td>{row.target}</td>
              <td className={styles.muted}>{row.setLabel}</td>
              <td className={styles.number}>{row.price}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
