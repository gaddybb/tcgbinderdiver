import type { PullVerdict as Verdict } from '../../core/engine/engine';
import { copy } from '../copy/en';
import { cx } from '../cx';
import styles from './Labels.module.css';

const toneClass: Record<Verdict, string> = {
  worth_a_pull: styles.worth,
  buy_online: styles.buy,
  show_staff: styles.staff,
};

// A label, never a button: "Worth a pull", "Buy online" or "Show staff".
export function PullVerdict({ verdict }: { verdict: Verdict }) {
  return (
    <span className={cx(styles.verdict, toneClass[verdict])}>
      <span aria-hidden="true" className={styles.dot} />
      {copy.verdict[verdict]}
    </span>
  );
}
