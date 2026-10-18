import { isPullDefault, resetPull, setIncludeBasicLands, setPullRule, MAX_CARDS_CEILING, MAX_USD_CEILING, MIN_CARDS_FLOOR, verdictPreview } from '../../../core/store';
import type { DiveStopView } from '../../../core/store';
import { Button, Dialog, Sheet, Stepper, Switch } from '../../components';
import { copy } from '../../copy/en';
import { useStoreSettings } from '../../data/StoreSettingsProvider';
import { useLayout } from '../../layout/useLayout';
import styles from './Dive.module.css';

const t = copy.pullSettings;

interface PullSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  stops: readonly DiveStopView[];   // the plan under the current settings, for the live preview
}

// When a binder is worth walking to, and whether basic lands go on the hunt. Changes apply at once, and the plan behind
// the panel updates as they are made. A dialog on tablet and desktop, a bottom sheet on a phone.
export function PullSettingsPanel({ open, onClose, stops }: PullSettingsPanelProps) {
  const phone = useLayout() === 'phone';
  const { settings, update } = useStoreSettings();
  const { worth, buyOnline } = verdictPreview(stops);

  const body = (
    <div className={styles.panel}>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>{t.worthTitle}</span>
        <div className={styles.fieldRow}>
          <span>{t.atLeastCards}</span>
          <Stepper label={t.cardsLabel} value={settings.pull.worthPullMinCards} min={MIN_CARDS_FLOOR} max={MAX_CARDS_CEILING}
            onChange={worthPullMinCards => update(s => setPullRule(s, { worthPullMinCards }))} />
        </div>
        <span>{t.or}</span>
        <div className={styles.fieldRow}>
          <span>{t.atLeastValue}</span>
          <Stepper label={t.valueLabel} value={settings.pull.worthPullMinUsd} min={0} max={MAX_USD_CEILING}
            onChange={worthPullMinUsd => update(s => setPullRule(s, { worthPullMinUsd }))} />
        </div>
        <p className={styles.sectionDetail}>{t.note}</p>
      </div>

      <div className={styles.field}>
        <Switch label={t.basics} checked={settings.includeBasicLands} onChange={on => update(s => setIncludeBasicLands(s, on))} />
        <p className={styles.sectionDetail}>{t.basicsNote}</p>
      </div>

      <p className={styles.sectionDetail}>{t.orderNote}</p>
      <p className={styles.preview} aria-live="polite">{t.preview(worth, buyOnline)}</p>

      <div className={styles.panelActions}>
        <Button variant="text" disabled={isPullDefault(settings)} onClick={() => update(resetPull)}>{t.reset}</Button>
        <Button onClick={onClose}>{t.done}</Button>
      </div>
    </div>
  );

  return phone
    ? <Sheet open={open} onClose={onClose} title={t.title}>{body}</Sheet>
    : <Dialog open={open} onClose={onClose} title={t.title}>{body}</Dialog>;
}
