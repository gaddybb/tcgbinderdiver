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
}

// The card picture at tile size, with the colour edge on top. A missing or broken image becomes a labelled
// placeholder (the card's name and "Image unavailable"), so the tile still works. Images are shown as Scryfall sends them.
export function CardImage({ name, src, edge, dim }: CardImageProps) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div role="img" aria-label={copy.cardTile.imageUnavailableFor(name)} className={cx(styles.unavailable, dim && styles.dim)}>
        <strong className={styles.unavailableName}>{name}</strong>
        <span className={styles.unavailableNote}>{copy.cardTile.imageUnavailable}</span>
      </div>
    );
  }
  return (
    <span aria-hidden="true" className={cx(styles.box, styles.tile, edgeClass[edge], dim && styles.dim)}>
      <img src={src} alt="" loading="lazy" className={styles.img} onError={() => setFailed(true)} />
    </span>
  );
}

// A small version for rows and list cards: the colour edge and a card-shaped block, no picture.
export function CardThumb({ edge, size = 'md' }: { edge: ColorCategory; size?: 'md' | 'lg' }) {
  return <span aria-hidden="true" className={cx(styles.box, styles.thumb, size === 'lg' && styles.thumbLg, edgeClass[edge])} />;
}
