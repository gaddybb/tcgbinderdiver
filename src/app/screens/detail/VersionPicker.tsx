import { listedPrinting, lowestPrice } from '../../../core/cards';
import type { Printing } from '../../../core/engine/engine';
import type { ListEntry, PrintRef } from '../../../core/lists';
import { Button, Select, Switch } from '../../components';
import { copy } from '../../copy/en';
import { formatUsd } from '../../format';
import { printingLabel } from '../../printingLabel';
import styles from './CardDetail.module.css';

const t = copy.cardDetail.version;

interface VersionPickerProps {
  entry: ListEntry;
  printings: readonly Printing[];                                              // every paper printing of the card
  onChange: (version: { print: PrintRef; locked: boolean } | null) => void;   // null: any version again
}

const keyOf = (p: PrintRef): string => `${p.setCode}|${p.collectorNumber}`;
const refOf = (p: Printing): PrintRef => ({ setCode: p.setCode, collectorNumber: p.collectorNumber });

// Which version of a card to look for. Choosing one locks it, so the plan looks only for that print; the lock can be turned
// off, which keeps the choice but lets the plan look for any version. Without a choice the plan looks for the print most
// likely to be in the store.
export function VersionPicker({ entry, printings, onChange }: VersionPickerProps) {
  const listed = entry.listed && !entry.print ? listedPrinting(printings, entry.listed) : undefined;
  return (
    <section className={styles.version} aria-label={t.title}>
      <Select
        label={t.label}
        value={entry.print ? keyOf(entry.print) : ''}
        onChange={e => {
          const chosen = printings.find(p => keyOf(p) === e.target.value);
          onChange(chosen ? { print: refOf(chosen), locked: true } : null);
        }}
      >
        <option value="">{t.any}</option>
        {printings.map(p => (
          <option key={keyOf(p)} value={keyOf(p)}>{`${p.setName} · ${printingLabel(p)} · ${formatUsd(lowestPrice(p))}`}</option>
        ))}
      </Select>
      {entry.print && <Switch label={t.lock} checked={entry.locked === true} onChange={on => onChange({ print: entry.print as PrintRef, locked: on })} />}
      <p className={styles.note}>{entry.print ? (entry.locked ? t.lockedNote : t.chosenNote) : t.anyNote}</p>
      {listed && (
        <p className={styles.note}>
          {t.listed(printingLabel(listed))}{' '}
          <Button variant="text" onClick={() => onChange({ print: refOf(listed), locked: true })}>{t.useListed}</Button>
        </p>
      )}
    </section>
  );
}
