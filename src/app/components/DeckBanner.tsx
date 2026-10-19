import { useState } from 'react';
import { cx } from '../cx';
import styles from './DeckBanner.module.css';

interface DeckBannerProps {
  src: string | null;          // the cropped art of a card from the deck
  size?: 'card' | 'page';      // a strip on a list card, or a taller one over a list's page
}

// A strip of card art that heads a deck, fading into the page. Decoration only: the deck's name is always written beside it,
// and a picture that cannot load simply leaves no strip.
export function DeckBanner({ src, size = 'card' }: DeckBannerProps) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <span aria-hidden="true" className={cx(styles.banner, size === 'page' ? styles.page : styles.card)}>
      <img src={src} alt="" loading="lazy" className={styles.img} onError={() => setFailed(true)} />
    </span>
  );
}
