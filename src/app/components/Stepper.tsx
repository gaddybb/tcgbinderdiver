import { copy } from '../copy/en';
import styles from './Stepper.module.css';

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  fewerLabel?: string;
  moreLabel?: string;
}

export function Stepper({ value, onChange, min = 0, max = Number.POSITIVE_INFINITY, label, fewerLabel = copy.common.fewer, moreLabel = copy.common.more }: StepperProps) {
  return (
    <div role="group" aria-label={label} className={styles.stepper}>
      <button type="button" className={styles.step} aria-label={fewerLabel} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <span className={styles.value} aria-live="polite">{value}</span>
      <button type="button" className={styles.step} aria-label={moreLabel} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  );
}
