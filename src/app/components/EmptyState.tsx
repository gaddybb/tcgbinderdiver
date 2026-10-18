import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  title: string;
  children: ReactNode;    // what to do about it
  actions?: ReactNode;
}

// What a screen shows when there is nothing yet: a plain sentence and the next step, inline.
export function EmptyState({ title, children, actions }: EmptyStateProps) {
  return (
    <section className={styles.empty}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.text}>{children}</p>
      {actions && <div className={styles.actions}>{actions}</div>}
    </section>
  );
}
