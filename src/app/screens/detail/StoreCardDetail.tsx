// Card detail in the store: the same picture and places, with a Found button. A card on several lists shows how many
// copies each list has found, and a copy can be put on a specific list. Opens from a tile's picture.
import type { CardRecord } from '../../../core/cards';
import type { PlanStop } from '../../../core/engine/engine';
import type { NeededAcrossLists } from '../../../core/lists';
import { foundCopies, foundOnList, remainingCopies } from '../../../core/trip';
import type { Trip } from '../../../core/trip';
import { Button, ProgressBar } from '../../components';
import { copy } from '../../copy/en';
import { CardDetailShell } from './CardDetailShell';
import { useDetailModel } from './model';
import { AlsoTry, BuyButton, FirstPlace, Heading, Picture, Printings, subtitleFor } from './Sections';
import styles from './CardDetail.module.css';

const t = copy.cardDetail;

interface StoreCardDetailProps {
  stop: PlanStop;                          // the binder or counter being searched
  cardKey: string;
  keys: readonly string[];                 // the cards to walk through, in the order shown
  records: ReadonlyMap<string, CardRecord>;
  parts: ReadonlyMap<string, NeededAcrossLists>;
  trip: Trip;
  onOpen: (cardKey: string) => void;
  onClose: () => void;
  onFound: (part: NeededAcrossLists) => void;
  onUndo: (part: NeededAcrossLists) => void;
  onFoundOn: (part: NeededAcrossLists, listId: string) => void;
  onUndoOn: (part: NeededAcrossLists, listId: string) => void;
}

export function StoreCardDetail({ stop, cardKey, keys, records, parts, trip, onOpen, onClose, onFound, onUndo, onFoundOn, onUndoOn }: StoreCardDetailProps) {
  const record = records.get(cardKey);
  const part = parts.get(cardKey);
  const model = useDetailModel(record, stop.stop.id);
  if (!part) return null;

  const at = keys.indexOf(cardKey);
  const go = (to: number) => (at >= 0 && to >= 0 && to < keys.length ? () => onOpen(keys[to]) : undefined);
  const name = record?.summary.name ?? part.name;
  const found = foundCopies(trip, part);
  const many = part.copies > 1;
  const done = remainingCopies(trip, part) <= 0;
  const counter = stop.stop.kind !== 'set_binder' && stop.stop.kind !== 'commander_box';

  const footer = many ? (
    <>
      <Button variant="icon" aria-label={copy.cardTile.undoOne(name)} disabled={found === 0} onClick={() => onUndo(part)}>−</Button>
      <span className={styles.footerGrow}>
        {done
          ? <strong>{copy.cardTile.allFound(part.copies)}</strong>
          : <Button size="lg" fullWidth onClick={() => onFound(part)}>{copy.cardTile.foundPlusOne}</Button>}
      </span>
    </>
  ) : found > 0 ? (
    <Button variant="secondary" size="lg" fullWidth aria-pressed onClick={() => onUndo(part)}>{copy.cardTile.foundUndo}</Button>
  ) : (
    <Button size="lg" fullWidth onClick={() => onFound(part)}>{copy.cardTile.found}</Button>
  );

  return (
    <CardDetailShell
      position={at >= 0 ? t.positionIn(stop.stop.label, at + 1, keys.length) : stop.stop.label}
      onClose={onClose}
      onPrevious={go(at - 1)}
      onNext={go(at + 1)}
      footer={footer}
    >
      {titleId => (
        <>
          <Picture name={name} model={model} />
          <Heading id={titleId} name={name} subtitle={subtitleFor(model)} />
          {many && <ProgressBar value={found} max={part.copies} label={t.progressLabel} caption={t.progress(found, part.copies)} />}
          <BuyButton name={name} />
          {part.parts.length > 1 && (
            <section className={styles.split} aria-labelledby="split-title">
              <h3 id="split-title" className={styles.sectionTitle}>{t.split.title(part.parts.length)}</h3>
              <p className={styles.note}>{t.split.hint}</p>
              <ul className={styles.plain}>
                {part.parts.map(p => {
                  const got = foundOnList(trip, part, p.listId);
                  const full = got >= p.quantity;
                  return (
                    <li key={p.listId} className={styles.splitRow}>
                      <div className={styles.splitText}>
                        <div className={styles.splitName}>{p.listName}</div>
                        <div className={styles.note}>{t.split.listProgress(got, p.quantity)}</div>
                      </div>
                      <div className={styles.splitActions}>
                        {got > 0 && <Button variant="icon" aria-label={t.split.undoForListLabel(p.listName)} onClick={() => onUndoOn(part, p.listId)}>−</Button>}
                        {full
                          ? <span className={styles.note}>{t.split.listDone}</span>
                          : <Button variant="secondary" aria-label={t.split.foundForListLabel(p.listName)} onClick={() => onFoundOn(part, p.listId)}>{t.split.foundForList}</Button>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {model && (
            <>
              <FirstPlace model={model} kicker={counter ? t.atThisCounter : t.inThisBinder} />
              <AlsoTry model={model} title={t.notHereTry} />
              <Printings model={model} />
            </>
          )}
        </>
      )}
    </CardDetailShell>
  );
}
