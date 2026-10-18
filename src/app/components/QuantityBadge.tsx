import { copy } from '../copy/en';
import styles from './Labels.module.css';

export function QuantityBadge({ quantity }: { quantity: number }) {
  return <span className={styles.badge}>{copy.cardTile.copies(quantity)}</span>;
}
