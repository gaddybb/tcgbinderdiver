import type { ReactNode } from 'react';
import { copy } from '../copy/en';
import styles from './TourTip.module.css';

interface TourTipProps {
  step: number;       // 1-based
  total: number;
  title: string;
  children: ReactNode;
  onSkip: () => void;
  onNext: () => void;
}

// One tip of the first-time tour, with Skip and Next. The last tip says Done instead of Next.
export function TourTip({ step, total, title, children, onSkip, onNext }: TourTipProps) {
  const last = step >= total;
  return (
    <div role="group" aria-label={title} className={styles.tip}>
      <span className={styles.count}>{copy.tour.stepOf(step, total)}</span>
      <strong>{title}</strong>
      <span className={styles.body}>{children}</span>
      <div className={styles.actions}>
        {!last && <button type="button" className={styles.skip} onClick={onSkip}>{copy.tour.skip}</button>}
        <button type="button" className={styles.next} onClick={onNext}>{last ? copy.tour.done : copy.tour.next}</button>
      </div>
    </div>
  );
}
