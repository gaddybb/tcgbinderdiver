import type { ReactNode } from 'react';
import styles from './Pages.module.css';

// The heading block at the top of a text page: a small label, the title and a line under it.
export function PageIntro({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <div className={styles.intro}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1 className={styles.title}>{title}</h1>
      {lead && <p className={styles.lead}>{lead}</p>}
    </div>
  );
}

// A titled block of text on a text page.
export function TextSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section} aria-label={title}>
      <h2 className={styles.h2}>{title}</h2>
      {children}
    </section>
  );
}
