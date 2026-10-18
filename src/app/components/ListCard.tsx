import type { ReactNode } from 'react';
import { copy } from '../copy/en';
import { Link } from '../router';
import { CardThumb } from './CardImage';
import { Switch } from './Switch';
import type { ColorCategory } from './colors';
import styles from './ListCard.module.css';

interface ListCardProps {
  kindLabel: string;                 // "Deck" or "Wishlist"
  title: string;
  to: string;                        // where the list opens
  summary: string;                   // "11 needed of 13 · Updated today"
  thumbs: readonly ColorCategory[];  // colour edges of the first few cards
  inNextDive: boolean;
  onInNextDiveChange: (on: boolean) => void;
  menu?: ReactNode;                  // the "⋯" Menu for this list
}

// A list on My lists: its name, a short summary, a few card edges, the In next dive switch and Open.
export function ListCard({ kindLabel, title, to, summary, thumbs, inNextDive, onInNextDiveChange, menu }: ListCardProps) {
  return (
    <li className={styles.card}>
      <div className={styles.head}>
        <div className={styles.titles}>
          <span className={styles.kind}>{kindLabel}</span>
          <Link to={to} className={styles.title}>{title}</Link>
          <span className={styles.summary}>{summary}</span>
        </div>
        {menu}
      </div>
      <div aria-hidden="true" className={styles.thumbs}>
        {thumbs.map((edge, i) => <CardThumb key={i} edge={edge} size="lg" />)}
      </div>
      <div className={styles.foot}>
        <Switch label={copy.listCard.inNextDive} aria-label={copy.listCard.includeInNext(title)} checked={inNextDive} onChange={onInNextDiveChange} />
        <Link to={to} className={styles.open}>{copy.listCard.open}</Link>
      </div>
    </li>
  );
}
