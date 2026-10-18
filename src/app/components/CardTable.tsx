import type { ReactNode } from 'react';
import { cx } from '../cx';
import { Checkbox } from './Checkbox';
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

// Turns the table into one you can select from: a checkbox column, with a select-all box in the header.
export interface CardTableSelection {
  selected: ReadonlySet<string>;      // row keys
  onToggle: (key: string) => void;
  onToggleAll: () => void;            // selects every row shown, or clears them when all are selected
  rowLabel: (name: string) => string; // "Select Sol Ring"
  allLabel: string;
}

interface CardTableProps {
  rows: readonly CardTableRow[];
  labels: CardTableLabels;
  selection?: CardTableSelection;
}

// A list's cards as a table, for tablet and desktop: picture, name, status, where to look, which printing, price.
export function CardTable({ rows, labels, selection }: CardTableProps) {
  const chosen = selection ? rows.filter(r => selection.selected.has(r.key)).length : 0;
  return (
    <div className={styles.wrap}>
      <table className={styles.table} aria-label={labels.table}>
        <thead className={styles.head}>
          <tr>
            {selection && (
              <th scope="col" className={styles.check}>
                <Checkbox hideLabel label={selection.allLabel} checked={rows.length > 0 && chosen === rows.length} indeterminate={chosen > 0 && chosen < rows.length} onChange={selection.onToggleAll} />
              </th>
            )}
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
            <tr key={row.key} className={cx(styles.row, selection?.selected.has(row.key) && styles.selected)}>
              {selection && (
                <td className={styles.check}>
                  <Checkbox hideLabel label={selection.rowLabel(row.name)} checked={selection.selected.has(row.key)} onChange={() => selection.onToggle(row.key)} />
                </td>
              )}
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
