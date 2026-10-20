import { CARD_STATUSES } from '../../../core/status';
import type { CardStatus } from '../../../core/status';
import { resetStatuses, setAll, setStatus, statusCounts, statusOf } from '../../../core/import';
import type { ResolvedEntry, StatusChoices } from '../../../core/import';
import { Button, CardThumb, HoverPreview, Menu, StatusPicker } from '../../components';
import type { ColorCategory } from '../../components';
import { copy } from '../../copy/en';
import styles from './Import.module.css';

const t = copy.importFlow.own;

// The colored edge of a thumbnail from the card's colors (the store's own color order is not needed here).
const EDGE: Record<string, ColorCategory> = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };
const edgeOf = (colors: readonly string[]): ColorCategory => (colors.length > 1 ? 'Multicolor' : EDGE[colors[0]] ?? 'Colorless');

interface OwnStepProps {
  entries: readonly ResolvedEntry[];
  choices: StatusChoices;
  onChange: (choices: StatusChoices) => void;
  busy: boolean;
  onBack: () => void;
  onFinish: (choices: StatusChoices) => void;
}

// Step 4 (decks only): mark cards that are already owned, on the way or stood in for.
export function OwnStep({ entries, choices, onChange, busy, onBack, onFinish }: OwnStepProps) {
  const counts = statusCounts(entries, choices);
  return (
    <div className={styles.flow}>
      <section className={styles.group}>
        <h2 className={styles.heading}>{t.title}</h2>
        <p className={styles.lead}>{t.lead}</p>
      </section>

      {/* At the top, so a long list never hides the way forward. */}
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onBack}>{copy.importFlow.back}</Button>
        <span className={styles.actionsEnd}>
          <Button disabled={busy} onClick={() => onFinish(choices)}>{t.finish}</Button>
        </span>
      </div>
      <p className={styles.note}>{t.later}</p>

      <div className={styles.toolbar}>
        <p className={styles.counts}>{t.summary(counts.in_collection, counts.ordered, counts.proxy, counts.out_of_deck, counts.needed)}</p>
        <Menu
          variant="text"
          label={t.setAll}
          trigger={<>{t.setAll}<span aria-hidden="true">▾</span></>}
          items={CARD_STATUSES.map((s: CardStatus) => ({ label: copy.status[s], onSelect: () => onChange(setAll(entries, s)) }))}
        />
        <Button variant="text" onClick={() => onChange(resetStatuses())}>{t.reset}</Button>
      </div>

      <ul className={styles.list}>
        {entries.map(entry => (
          <li key={entry.cardKey} className={styles.row}>
            <span className={styles.rowLead}>
              <HoverPreview src={entry.card.imageNormal}>
                <CardThumb edge={edgeOf(entry.card.colors)} src={entry.card.imageSmall} />
              </HoverPreview>
              <span className={styles.rowName}>{entry.name}{entry.quantity > 1 && ` ×${entry.quantity}`}</span>
            </span>
            <StatusPicker
              cardName={entry.name}
              status={statusOf(choices, entry.cardKey)}
              onChange={status => onChange(setStatus(choices, entry.cardKey, status))}
            />
          </li>
        ))}
      </ul>

      <p className={styles.note}>{t.legend}</p>
    </div>
  );
}
