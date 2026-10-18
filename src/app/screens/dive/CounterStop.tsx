// A counter stop (Display case, Ask an associate, Value binders): staff look, so the list is A to Z with big names.
import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PlanStop } from '../../../core/engine/engine';
import type { NeededAcrossLists } from '../../../core/lists';
import type { CardRecord } from '../../../core/cards';
import { foundCopies, remainingCopies } from '../../../core/trip';
import type { Trip } from '../../../core/trip';
import { Button, CardThumb, SummaryBar } from '../../components';
import type { ColorCategory } from '../../components';
import { isColorCategory } from '../../components';
import { copy } from '../../copy/en';
import { cx } from '../../cx';
import { useModal } from '../../components/useModal';
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
  onFound: (part: NeededAcrossLists) => void;
  onUndo: (part: NeededAcrossLists) => void;
  onNotAvailable: (key: string) => void;
  onDone: () => void;
}

interface Row {
  key: string;
  name: string;
  sub: string;
  part: NeededAcrossLists;
  edge: ColorCategory;
  image: string | null;
}

export function CounterStop({ stop, trip, parts, records, categoryOf, onFound, onUndo, onNotAvailable, onDone }: CounterStopProps) {
  const phone = useLayout() === 'phone';
  const [big, setBig] = useState(false);

  const rows: Row[] = stop.cards
    .flatMap(({ key, candidate }) => {
      const part = parts.get(key);
      const record = records.get(key);
      if (!part || !record) return [];
      const category = categoryOf(record);
      const hint = candidate.hint ? t.hint[candidate.hint] : undefined;
      const sub = [candidate.printing.setName, `${candidate.printing.setCode.toUpperCase()} ${candidate.printing.collectorNumber}`, formatUsd(candidate.price), hint].filter(Boolean).join(' · ');
      return [{ key, name: record.summary.name, sub, part, edge: isColorCategory(category) ? category : 'Colorless', image: record.summary.imageSmall }];
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const waiting = rows.filter(r => remainingCopies(trip, r.part) > 0 && !trip.notAvailable.includes(r.key));

  return (
    <div className={styles.rows}>
      <div className={styles.metaRow}>
        <span><strong>{t.cards(stop.cards.length)}</strong> <span className={styles.note}>· {copy.storeDive.sortedAz}</span></span>
        <Button variant="secondary" onClick={() => setBig(true)}>{t.bigText}</Button>
      </div>

      <ul className={styles.rows}>
        {rows.map(row => {
          const found = foundCopies(trip, row.part) > 0;
          const gone = trip.notAvailable.includes(row.key);
          return (
            <li key={row.key} className={cx(styles.counterRow, (found || gone) && styles.counterRowGone)}>
              <CardThumb edge={row.edge} src={row.image} />
              <div className={styles.counterText}>
                <div className={styles.counterName}>{row.name}{row.part.copies > 1 && ` ×${row.part.copies}`}</div>
                <div className={styles.counterSub}>{row.sub}</div>
              </div>
              <div className={styles.counterActions}>
                {found ? (
                  <Button variant="secondary" aria-pressed onClick={() => onUndo(row.part)}>{t.foundUndo}</Button>
                ) : gone ? (
                  <>
                    <span className={styles.note}>{t.notAvailable}</span>
                    <Button onClick={() => onFound(row.part)}>{t.found}</Button>
                  </>
                ) : (
                  <>
                    <Button variant="secondary" aria-label={t.notAvailableLabel(row.name)} onClick={() => onNotAvailable(row.key)}>{t.notAvailable}</Button>
                    <Button onClick={() => onFound(row.part)}>{t.found}</Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <SummaryBar
        sticky={phone}
        label={copy.storeDive.counter.done}
        title={t.buyRest}
        action={<Button onClick={onDone}>{t.done}</Button>}
      />

      <BigText
        open={big}
        onClose={() => setBig(false)}
        items={waiting.map(r => ({ key: r.key, name: r.name, sub: r.sub }))}
      />
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
