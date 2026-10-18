import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Banner.module.css';

interface BannerProps {
  tone: 'info' | 'warning' | 'error';
  title: string;
  children?: ReactNode;   // the detail line
  actions?: ReactNode;    // buttons, for example Retry
}

// Problems show inline, in the screen they affect. An error is announced right away; the others politely.
export function Banner({ tone, title, children, actions }: BannerProps) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx(styles.banner, styles[tone])}>
      <span className={styles.text}>
        <strong>{title}</strong>
        {children && <span className={styles.detail}>{children}</span>}
      </span>
      {actions && <span className={styles.actions}>{actions}</span>}
    </div>
  );
}
