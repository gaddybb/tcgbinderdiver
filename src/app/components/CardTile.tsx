import { copy } from '../copy/en';
import { cx } from '../cx';
import { Button } from './Button';
import { CardImage } from './CardImage';
import { ProgressBar } from './ProgressBar';
import { QuantityBadge } from './QuantityBadge';
import type { ColorCategory } from './colors';
import styles from './CardTile.module.css';

export interface CardTileProps {
  name: string;
  setLabel: string;          // "FDN 135": the set and collector number of the printing at this stop
  price: string;             // already formatted, for example "$0.25"
  lists: string;             // which lists want this card
  imageUrl: string | null;
  fallbackUrl?: string | null;   // the card's usual picture, if the print's own cannot be loaded
  edge: ColorCategory;
  quantity: number;          // copies wanted across the lists that are on
  found: number;             // copies found so far
  onFound: () => void;
  onUndo: () => void;
  onOpen?: () => void;       // opens card detail; makes the picture a button
  fluid?: boolean;           // fill the column, for the store dive gallery (the picture grows with it)
  hint?: string;             // a line about where to look, for counter places
  notAvailable?: boolean;    // the staff do not have it
  onNotAvailable?: () => void;   // shows a Not available button (counter places)
}

// A card at a store stop. One copy: Found, then Found · Undo. Several copies: a ×N badge, progress in copies,
// Found +1 and a minus to undo one. Progress is always written out, never only a bar.
export function CardTile({ name, setLabel, price, lists, imageUrl, fallbackUrl, edge, quantity, found, onFound, onUndo, onOpen, fluid, hint, notAvailable, onNotAvailable }: CardTileProps) {
  const many = quantity > 1;
  const allFound = found >= quantity;
  const image = <CardImage name={name} src={imageUrl} fallback={fallbackUrl} edge={edge} fluid={fluid} dim={(found > 0 && (allFound || !many)) || (notAvailable === true && found === 0)} />;

  return (
    <li className={cx(styles.tile, fluid && styles.fluid)}>
      <span className={styles.imageWrap}>
        {onOpen
          ? <button type="button" className={styles.open} aria-label={copy.cardTile.openCard(name)} onClick={onOpen}>{image}</button>
          : image}
        {many && <span className={styles.badge}><QuantityBadge quantity={quantity} /></span>}
      </span>
      <div className={styles.name}>{name}</div>
      <div className={styles.meta}>
        <span>{setLabel}</span>
        <span className={styles.price}>{price}</span>
      </div>
      <span className={styles.lists}>{lists}</span>
      {hint && <span className={styles.hint}>{hint}</span>}

      {/* The controls sit at the bottom of the tile, and tiles in a row stretch to the same height, so every Found button is level. */}
      <div className={styles.controls}>
      {many && (
        <ProgressBar size="sm" value={found} max={quantity} label={copy.progress.copiesLabel(name)} caption={copy.progress.copiesOf(found, quantity)} />
      )}

      {!many && (found > 0
        ? <Button variant="secondary" fullWidth aria-pressed onClick={onUndo}>{copy.cardTile.foundUndo}</Button>
        : notAvailable
          ? <><span className={styles.allFound}>{copy.cardTile.notAvailable}</span><Button fullWidth onClick={onFound}>{copy.cardTile.found}</Button></>
          : <Button fullWidth onClick={onFound}>{copy.cardTile.found}</Button>)}

      {onNotAvailable && !notAvailable && found === 0 && (
        <Button variant="secondary" fullWidth aria-label={copy.cardTile.notAvailableFor(name)} onClick={onNotAvailable}>{copy.cardTile.notAvailable}</Button>
      )}

      {many && (
        <div className={styles.actions}>
          <Button variant="icon" aria-label={copy.cardTile.undoOne(name)} disabled={found === 0} onClick={onUndo}>−</Button>
          {allFound
            ? <span className={styles.allFound}>{copy.cardTile.allFound(quantity)}</span>
            : <span className={styles.grow}><Button fullWidth onClick={onFound}>{copy.cardTile.foundPlusOne}</Button></span>}
        </div>
      )}
      </div>
    </li>
  );
}
