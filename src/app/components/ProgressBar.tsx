import { cx } from '../cx';
import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  value: number;
  max: number;
  // Names what is being counted, for screen readers.
  label: string;
  // The same count in words, shown beside the bar, so progress is never color alone.
  caption?: string;
  size?: 'md' | 'sm';
}

export function ProgressBar({ value, max, label, caption, size = 'md' }: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), max);
  const percent = max > 0 ? (clamped / max) * 100 : 0;
  return (
    <div className={cx(styles.wrap, size === 'sm' && styles.small)}>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={clamped} className={styles.track}>
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
      {caption && <span className={styles.caption}>{caption}</span>}
    </div>
  );
}
