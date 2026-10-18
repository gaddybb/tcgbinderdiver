import { useEffect, useRef } from 'react';
import type { GameConnector } from '../../../core/connector';
import type { ImportLine } from '../../../core/import';
import type { CombinedEntry } from '../../../core/parse/parseDecklist';
import { Banner, Button, ProgressBar } from '../../components';
import { copy } from '../../copy/en';
import styles from './Import.module.css';
import { useLookup } from './useLookup';

const t = copy.importFlow.lookup;

interface LookupStepProps {
  entries: readonly CombinedEntry[];
  connector: GameConnector;
  onDone: (lines: ImportLine[]) => void;
  onProgress: (done: number) => void;
  onBack: () => void;
  onCancel: () => void;
  onSaveForLater: (done: number) => void;
}

export function LookupStep({ entries, connector, onDone, onProgress, onBack, onCancel, onSaveForLater }: LookupStepProps) {
  const lookup = useLookup(entries, connector, true);
  const total = entries.length;

  useEffect(() => { onProgress(lookup.done); }, [lookup.done, onProgress]);
  const reported = useRef(false);
  useEffect(() => {
    if (lookup.phase !== 'done' || !lookup.lines || reported.current) return;
    reported.current = true;   // the parent moves on once, however often it re-renders
    onDone(lookup.lines);
  }, [lookup.phase, lookup.lines, onDone]);

  return (
    <div className={styles.flow}>
      <section className={styles.group}>
        <h2 className={styles.heading}>{t.title}</h2>
        <p className={styles.lead}>{t.lead}</p>
      </section>

      <section className={styles.panel}>
        <p className={styles.counts}>{t.diving(total)}</p>
        <ProgressBar value={lookup.done} max={total} label={t.progressLabel} caption={t.count(lookup.done, total)} />
        {lookup.phase === 'trouble' ? (
          <Banner
            tone="warning"
            title={t.trouble.title}
            actions={
              <>
                <Button variant="secondary" onClick={lookup.retryNow}>{t.trouble.retryNow}</Button>
                <Button variant="text" onClick={() => onSaveForLater(lookup.done)}>{t.trouble.saveForLater(lookup.done)}</Button>
              </>
            }
          >
            {t.trouble.detail(lookup.done, total)}
          </Banner>
        ) : (
          <p className={styles.note}>{t.leaveNote}</p>
        )}
      </section>

      <div className={styles.actions}>
        <Button variant="secondary" onClick={onBack}>{copy.importFlow.back}</Button>
        <Button variant="secondary" onClick={onCancel}>{t.cancelLookup}</Button>
      </div>
    </div>
  );
}
