import { copy } from '../copy/en';
import { cx } from '../cx';
import styles from './Skeleton.module.css';

// A placeholder for a card row while data loads.
export function SkeletonRow({ label = copy.loading }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className={styles.row}>
      <span aria-hidden="true" className={cx(styles.block, styles.thumb)} />
      <span aria-hidden="true" className={styles.lines}>
        <span className={cx(styles.block, styles.long)} />
        <span className={cx(styles.block, styles.short)} />
      </span>
    </div>
  );
}
