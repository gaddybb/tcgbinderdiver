import { copy } from '../copy/en';
import { cx } from '../cx';
import styles from './Labels.module.css';

export type OddsLevel = 'best' | 'good' | 'fair' | 'long_shot';

export function OddsLabel({ level }: { level: OddsLevel }) {
  return <span className={cx(styles.odds, (level === 'best' || level === 'good') && styles.strong)}>{copy.odds[level]}</span>;
}
