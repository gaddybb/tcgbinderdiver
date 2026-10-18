import { useState } from 'react';
import { copy } from '../copy/en';
import { cx } from '../cx';
import { edgeClass } from './colors';
import type { ColorCategory } from './colors';
import styles from './CardImage.module.css';

interface CardImageProps {
  name: string;
  src: string | null;
  edge: ColorCategory;
  dim?: boolean;
  fluid?: boolean;     // fill the width of its column instead of the fixed tile width (the store dive gallery)
}

// The card picture at tile size, with the colour edge on top. A missing or broken image becomes a labelled
// placeholder (the card's name and "Image unavailable"), so the tile still works. Images are shown as Scryfall sends them.
export function CardImage({ name, src, edge, dim, fluid }: CardImageProps) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div role="img" aria-label={copy.cardTile.imageUnavailableFor(name)} className={cx(styles.unavailable, fluid && styles.fluid, dim && styles.dim)}>
        <strong className={styles.unavailableName}>{name}</strong>
        <span className={styles.unavailableNote}>{copy.cardTile.imageUnavailable}</span>
      </div>
    );
  }
  return (
    <span aria-hidden="true" className={cx(styles.box, styles.tile, fluid && styles.fluid, edgeClass[edge], dim && styles.dim)}>
      <img src={src} alt="" loading="lazy" className={styles.img} onError={() => setFailed(true)} />
    </span>
  );
}

// A small version for rows and list cards: the colour edge and a card-shaped block, with the picture when there is one.
export function CardThumb({ edge, size = 'md', src }: { edge: ColorCategory; size?: 'md' | 'lg'; src?: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <span aria-hidden="true" className={cx(styles.box, styles.thumb, size === 'lg' && styles.thumbLg, edgeClass[edge])}>
      {src && !failed && <img src={src} alt="" loading="lazy" className={styles.img} onError={() => setFailed(true)} />}
    </span>
  );
}
