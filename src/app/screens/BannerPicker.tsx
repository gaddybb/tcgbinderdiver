import { useState } from 'react';
import { Button, CardThumb, Input, Sheet } from '../components';
import type { ColorCategory } from '../components';
import { copy } from '../copy/en';
import styles from './BannerPicker.module.css';

const t = copy.review.bannerPicker;

export interface BannerChoice { name: string; edge: ColorCategory; src?: string | null }

interface BannerPickerProps {
  open: boolean;
  onClose: () => void;
  cards: readonly BannerChoice[];   // the deck's cards
  current: string | null;           // the card heading the deck now
  chosen: boolean;                  // a card was chosen for it (so "first card" is a change)
  onPick: (name: string | null) => void;   // null: back to the first card
}

// Which card's art heads the deck: any card in it, found by name. Opens from the list page, so it is not hidden inside card detail.
export function BannerPicker({ open, onClose, cards, current, chosen, onPick }: BannerPickerProps) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const shown = needle ? cards.filter(c => c.name.toLowerCase().includes(needle)) : cards;
  const pick = (name: string | null) => { onPick(name); onClose(); setQuery(''); };
  return (
    <Sheet open={open} onClose={onClose} title={t.title}>
      <div className={styles.body}>
        <Input label={t.search} value={query} onChange={e => setQuery(e.target.value)} />
        {chosen && <Button variant="text" onClick={() => pick(null)}>{t.reset}</Button>}
        {shown.length === 0 ? <p className={styles.empty}>{t.none}</p> : (
          <ul className={styles.list}>
            {shown.map(c => (
              <li key={c.name}>
                <button type="button" className={styles.row} aria-pressed={c.name === current} onClick={() => pick(c.name)}>
                  <CardThumb edge={c.edge} src={c.src} />
                  <span className={styles.name}>{c.name}</span>
                  {c.name === current && <span className={styles.now}>{t.current}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
