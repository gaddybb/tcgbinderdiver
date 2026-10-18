import type { CardStatus } from '../../core/status';
import { copy } from '../copy/en';
import styles from './Labels.module.css';

// Needed, In collection, Ordered, Proxy or Out of deck. Words, not color, say which.
export function StatusLabel({ status }: { status: CardStatus }) {
  return <span className={styles.status}>{copy.status[status]}</span>;
}
