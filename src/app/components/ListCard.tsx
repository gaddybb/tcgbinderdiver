import type { KeyboardEvent, ReactNode } from 'react';
import { copy } from '../copy/en';
import { Link } from '../router';
import { Button } from './Button';
import { CardThumb } from './CardImage';
import { DeckBanner } from './DeckBanner';
import { Input } from './Input';
import { Switch } from './Switch';
import type { ColorCategory } from './colors';
import styles from './ListCard.module.css';

interface Rename {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  error?: string;
}

interface ListCardProps {
  kindLabel: string;                 // "Deck" or "Wishlist"
  title: string;
  to: string;                        // where the list opens
  summary: string;                   // "11 needed of 13 · Updated today"
  thumbs: readonly ColorCategory[];  // colour edges of the first few cards
  bannerSrc?: string | null;         // card art that heads the list, like a deck banner
  inNextDive: boolean;
  onInNextDiveChange: (on: boolean) => void;
  menu?: ReactNode;                  // the "⋯" Menu for this list
  rename?: Rename;                   // while set, the name is edited right on the card
}

// A list on My lists: its name, a short summary, a few card edges, the In next dive switch and Open.
// Renaming happens on the card itself: Enter or Save keeps the name, Escape or Cancel leaves it.
export function ListCard({ kindLabel, title, to, summary, thumbs, bannerSrc, inNextDive, onInNextDiveChange, menu, rename }: ListCardProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!rename) return;
    if (event.key === 'Enter') { event.preventDefault(); rename.onSave(); }
    else if (event.key === 'Escape') { event.preventDefault(); rename.onCancel(); }
  };

  return (
    <li className={styles.card}>
      {bannerSrc && <div className={styles.banner}><DeckBanner src={bannerSrc} /></div>}
      <div className={styles.head}>
        <div className={styles.titles}>
          <span className={styles.kind}>{kindLabel}</span>
          {rename ? (
            <div className={styles.rename}>
              <Input
                label={copy.listCard.nameLabel}
                value={rename.value}
                error={rename.error}
                autoFocus
                onChange={e => rename.onChange(e.target.value)}
                onKeyDown={onKeyDown}
              />
              <div className={styles.renameActions}>
                <Button onClick={rename.onSave}>{copy.common.save}</Button>
                <Button variant="text" onClick={rename.onCancel}>{copy.common.cancel}</Button>
              </div>
            </div>
          ) : (
            <Link to={to} className={styles.title}>{title}</Link>
          )}
          <span className={styles.summary}>{summary}</span>
        </div>
        {menu}
      </div>
      {thumbs.length > 0 && (
        <div aria-hidden="true" className={styles.thumbs}>
          {thumbs.map((edge, i) => <CardThumb key={i} edge={edge} size="lg" />)}
        </div>
      )}
      <div className={styles.foot}>
        <Switch label={copy.listCard.inNextDive} aria-label={copy.listCard.includeInNext(title)} checked={inNextDive} onChange={onInNextDiveChange} />
        <Link to={to} className={styles.open}>{copy.listCard.open}</Link>
      </div>
    </li>
  );
}
