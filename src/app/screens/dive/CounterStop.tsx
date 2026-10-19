// A counter place (Display case, Ask an associate, Value binders): staff look, so the cards are A to Z with where they are
// usually kept, and a way to say the staff did not have one. Shown as a gallery (the same tiles as a binder), or as a table
// of rows with big names, which is easier to read out to an associate.
import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PlanStop } from '../../../core/engine/engine';
import type { NeededAcrossLists } from '../../../core/lists';
import { printingImageUrl } from '../../../core/cards';
import type { CardRecord } from '../../../core/cards';
import { foundCopies, remainingCopies } from '../../../core/trip';
import type { Trip } from '../../../core/trip';
import { Button, CardThumb, CardTile, Chip, HoverPreview, SummaryBar } from '../../components';
import type { ColorCategory } from '../../components';
import { isColorCategory } from '../../components';
import { copy } from '../../copy/en';
import { cx } from '../../cx';
import { useModal } from '../../components/useModal';
import { usePreference } from '../../data/usePreference';
import { printingLabel } from '../../printingLabel';
import { formatUsd } from '../../format';
import { useLayout } from '../../layout/useLayout';
import styles from './StoreDive.module.css';

const t = copy.storeDive.counter;

interface CounterStopProps {
  stop: PlanStop;
  trip: Trip;
  parts: ReadonlyMap<string, NeededAcrossLists>;
  records: ReadonlyMap<string, CardRecord>;
  categoryOf: (record: CardRecord) => string;
  gridClass: string;
  onFound: (part: NeededAcrossLists) => void;
  onUndo: (part: NeededAcrossLists) => void;
  onNotAvailable: (key: string) => void;
  onOpen: (key: string, keys: string[]) => void;   // opens card detail, with the cards to walk through
  onDone: () => void;
}

interface Row {
  key: string;
  name: string;
  setLabel: string;
  price: string;
  hint: string;
  part: NeededAcrossLists;
  edge: ColorCategory;
  image: string | null;
  thumb: string | null;
  fallback: string | null;   // the card's usual picture, if the print's own cannot be loaded
  sub: string;
}

type View = 'gallery' | 'table';

export function CounterStop({ stop, trip, parts, records, categoryOf, gridClass, onFound, onUndo, onNotAvailable, onOpen, onDone }: CounterStopProps) {
  const phone = useLayout() === 'phone';
  const [big, setBig] = useState(false);
  const [view, setView] = usePreference<View>('counter-view', 'gallery');

  const rows: Row[] = stop.cards
    .flatMap(({ key, candidate }) => {
      const part = parts.get(key);
      const record = records.get(key);
      if (!part || !record) return [];
      const category = categoryOf(record);
      const hint = candidate.hint ? t.hint[candidate.hint] : '';
      const setLabel = printingLabel(candidate.printing);
      const sub = [candidate.printing.setName, setLabel, formatUsd(candidate.price), hint].filter(Boolean).join(' · ');
      return [{
        key, name: record.summary.name, setLabel, price: formatUsd(candidate.price), hint, part, sub,
        edge: (isColorCategory(category) ? category : 'Colorless') as ColorCategory,
        image: printingImageUrl(candidate.printing),
        thumb: printingImageUrl(candidate.printing, 'small'),
        fallback: record.summary.imageNormal ?? record.summary.imageSmall,
      }];
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const waiting = rows.filter(r => remainingCopies(trip, r.part) > 0 && !trip.notAvailable.includes(r.key));

  return (
    <div className={styles.rows}>
      <div className={styles.metaRow}>
        <span><strong>{t.cards(stop.cards.length)}</strong> <span className={styles.note}>· {copy.storeDive.sortedAz}</span></span>
        <span className={styles.viewTools}>
          <span role="group" aria-label={t.view.label} className={styles.chips}>
            <Chip pressed={view === 'gallery'} onPress={() => setView('gallery')}>{t.view.gallery}</Chip>
            <Chip pressed={view === 'table'} onPress={() => setView('table')}>{t.view.table}</Chip>
          </span>
          <Button variant="text" aria-label={t.bigText} onClick={() => setBig(true)}>
            <span aria-hidden="true" className={styles.bigGlyph}>Aa</span>
            <span aria-hidden="true">{t.bigTextShort}</span>
          </Button>
        </span>
      </div>

      {view === 'gallery' ? (
        <ul className={gridClass}>
          {rows.map(row => (
            <CardTile
              key={row.key}
              fluid
              name={row.name}
              setLabel={row.setLabel}
              price={row.price}
              lists={row.part.parts.map(p => p.listName).join(', ')}
              hint={row.hint}
              imageUrl={row.image}
              fallbackUrl={row.fallback}
              edge={row.edge}
              quantity={row.part.copies}
              found={foundCopies(trip, row.part)}
              notAvailable={trip.notAvailable.includes(row.key)}
              onFound={() => onFound(row.part)}
              onUndo={() => onUndo(row.part)}
              onNotAvailable={() => onNotAvailable(row.key)}
              onOpen={() => onOpen(row.key, rows.map(r => r.key))}
            />
          ))}
        </ul>
      ) : (
        <ul className={styles.rows}>
          {rows.map(row => {
            const have = foundCopies(trip, row.part);
            const found = remainingCopies(trip, row.part) <= 0;
            const gone = trip.notAvailable.includes(row.key);
            return (
              <li key={row.key} className={cx(styles.counterRow, (found || gone) && styles.counterRowGone)}>
                <HoverPreview src={row.image}>
                  <button type="button" className={styles.openThumb} aria-label={copy.cardTile.openCard(row.name)} onClick={() => onOpen(row.key, rows.map(r => r.key))}>
                    <CardThumb edge={row.edge} src={row.thumb} fallback={row.fallback} />
                  </button>
                </HoverPreview>
                <div className={styles.counterText}>
                  <div className={styles.counterName}>{row.name}{row.part.copies > 1 && ` ×${row.part.copies}`}</div>
                  <div className={styles.counterSub}>{row.sub}{have > 0 && !found && ` · ${t.foundCount(have, row.part.copies)}`}</div>
                </div>
                <div className={styles.counterActions}>
                  {found ? (
                    <Button variant="secondary" aria-pressed aria-label={`${row.name}: ${t.foundUndo}`} onClick={() => onUndo(row.part)}>{t.foundUndo}</Button>
                  ) : (
                    <>
                      {gone
                        ? <span className={styles.note}>{t.notAvailable}</span>
                        : <Button variant="secondary" aria-label={t.notAvailableLabel(row.name)} onClick={() => onNotAvailable(row.key)}>{t.notAvailable}</Button>}
                      {have > 0 && (
                        <Button variant="icon" aria-label={copy.cardTile.undoOne(row.name)} onClick={() => onUndo(row.part)}>−</Button>
                      )}
                      <Button aria-label={`${row.name}: ${row.part.copies > 1 ? copy.cardTile.foundPlusOne : t.found}`} onClick={() => onFound(row.part)}>
                        {row.part.copies > 1 ? copy.cardTile.foundPlusOne : t.found}
                      </Button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <SummaryBar
        sticky={phone}
        label={copy.storeDive.counter.done}
        title={t.buyRest}
        action={<Button onClick={onDone}>{t.done}</Button>}
      />

      <BigText open={big} onClose={() => setBig(false)} items={waiting.map(r => ({ key: r.key, name: r.name, sub: r.sub }))} />
    </div>
  );
}

interface BigTextProps {
  open: boolean;
  onClose: () => void;
  items: { key: string; name: string; sub: string }[];
}

// The phone handed over the counter: names in very large type, on a plain light page.
function BigText({ open, onClose, items }: BigTextProps) {
  const titleId = useId();
  const panelRef = useModal(open, onClose);
  if (!open) return null;
  return createPortal(
    <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={styles.bigText}>
      <div className={styles.bigTextHead}>
        <strong id={titleId}>{copy.storeDive.bigText.title}</strong>
        <Button variant="secondary" onClick={onClose}>{copy.storeDive.bigText.close}</Button>
      </div>
      <ul className={styles.rows}>
        {items.map(item => (
          <li key={item.key} className={styles.bigItem}>
            <div className={styles.bigName}>{item.name}</div>
            <div className={styles.bigSub}>{item.sub}</div>
          </li>
        ))}
      </ul>
      <p>{copy.storeDive.bigText.count(items.length)}</p>
    </div>,
    document.body,
  );
}
