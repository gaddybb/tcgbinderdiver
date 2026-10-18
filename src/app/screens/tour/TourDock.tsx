// The first-time tour of the store dive: a welcome, then three tips, one at a time along the bottom of the screen.
import { useEffect, useState } from 'react';
import { Button, TourTip } from '../../components';
import { copy } from '../../copy/en';
import { useStorage } from '../../data/StorageProvider';
import styles from '../pages/Pages.module.css';

const t = copy.tourFlow;
const KEY = 'tour-done';

// Whether the player has been through (or skipped) the tour on this device. null until that is read.
export function useTourDone(): { done: boolean | null; markDone: () => void } {
  const storage = useStorage();
  const [done, setDone] = useState<boolean | null>(null);
  useEffect(() => {
    let current = true;
    void storage.get<boolean>('settings', KEY).then(saved => { if (current) setDone(saved === true); });
    return () => { current = false; };
  }, [storage]);
  const markDone = () => { setDone(true); void storage.put('settings', KEY, true); };
  return { done, markDone };
}

interface TourDockProps {
  onDone: () => void;      // after Skip, or the last tip
}

export function TourDock({ onDone }: TourDockProps) {
  const [step, setStep] = useState(0);   // 0 is the welcome, 1 to 3 are the tips
  const total = t.tips.length;

  return (
    <div className={styles.tour} role="region" aria-label={t.label}>
      {step === 0 ? (
        <div className={styles.welcome}>
          <strong>{t.welcomeTitle}</strong>
          <span>{t.welcomeText}</span>
          <div className={styles.welcomeActions}>
            <Button variant="secondary" onClick={onDone}>{t.skip}</Button>
            <Button onClick={() => setStep(1)}>{t.show}</Button>
          </div>
          <span>{t.replayNote}</span>
        </div>
      ) : (
        <TourTip
          step={step}
          total={total}
          title={t.tips[step - 1].title}
          onSkip={onDone}
          onNext={() => (step >= total ? onDone() : setStep(step + 1))}
        >
          {t.tips[step - 1].text}
        </TourTip>
      )}
    </div>
  );
}
