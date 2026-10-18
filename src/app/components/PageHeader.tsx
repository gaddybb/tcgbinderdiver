import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  level?: 1 | 2 | 3;   // a screen has one h1; use a lower level when the header sits inside another page
}

// The top of a screen: its one h1, a line of help, and the main action.
export function PageHeader({ title, subtitle, actions, level = 1 }: PageHeaderProps) {
  const Heading = `h${level}` as const;
  return (
    <header className={styles.header}>
      <div className={styles.text}>
        <Heading className={styles.title}>{title}</Heading>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
