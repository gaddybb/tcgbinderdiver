import { useState } from 'react';
import { copy } from '../copy/en';
import { cx } from '../cx';
import { edgeClass } from './colors';
import type { ColorCategory } from './colors';
import styles from './CardImage.module.css';

interface CardImageProps {
  name: string;
  src: string | null;
  fallback?: string | null;   // the card's usual picture, used if the one in src cannot be loaded
  edge: ColorCategory;
  dim?: boolean;
  fluid?: boolean;     // fill the width of its column instead of the fixed tile width (the store dive gallery)
}

// The card picture at tile size, with the colour edge on top. A missing or broken image becomes a labelled
// placeholder (the card's name and "Image unavailable"), so the tile still works. Images are shown as Scryfall sends them.
export function CardImage({ name, src, fallback, edge, dim, fluid }: CardImageProps) {
  const [failures, setFailures] = useState(0);
  const shown = failures === 0 ? src : failures === 1 ? fallback : null;
  if (!shown) {
    return (
      <div role="img" aria-label={copy.cardTile.imageUnavailableFor(name)} className={cx(styles.unavailable, fluid && styles.fluid, dim && styles.dim)}>
        <strong className={styles.unavailableName}>{name}</strong>
        <span className={styles.unavailableNote}>{copy.cardTile.imageUnavailable}</span>
      </div>
    );
  }
  return (
    <span aria-hidden="true" className={cx(styles.box, styles.tile, fluid && styles.fluid, edgeClass[edge], dim && styles.dim)}>
      <img src={shown} alt="" loading="lazy" className={styles.img} onError={() => setFailures(n => n + 1)} />
    </span>
  );
}

// A small version for rows and list cards: the colour edge and a card-shaped block, with the picture when there is one.
export function CardThumb({ edge, size = 'md', src, fallback }: { edge: ColorCategory; size?: 'md' | 'lg'; src?: string | null; fallback?: string | null }) {
  const [failures, setFailures] = useState(0);
  const shown = failures === 0 ? src : failures === 1 ? fallback : null;
  return (
    <span aria-hidden="true" className={cx(styles.box, styles.thumb, size === 'lg' && styles.thumbLg, edgeClass[edge])}>
      {shown && <img src={shown} alt="" loading="lazy" className={styles.img} onError={() => setFailures(n => n + 1)} />}
    </span>
  );
}
