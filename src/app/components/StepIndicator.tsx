import { copy } from '../copy/en';
import { cx } from '../cx';
import { useLayout } from '../layout/useLayout';
import styles from './StepIndicator.module.css';

interface StepIndicatorProps {
  steps: readonly string[];
  // Zero-based index of the step the player is on.
  current: number;
  label: string;
}

// The import steps. Done, current and coming-up steps differ in words and shape, not only color.
// On a phone only the current step shows its name; the others are numbered circles (screen readers still get every step).
export function StepIndicator({ steps, current, label }: StepIndicatorProps) {
  const phone = useLayout() === 'phone';
  return (
    <ol aria-label={label} className={styles.steps}>
      {steps.map((name, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        const compact = phone && state !== 'current';
        return (
          <li key={name} className={cx(styles.step, styles[state], compact && styles.compact)} aria-current={state === 'current' ? 'step' : undefined}>
            <span aria-hidden="true" className={styles.marker}>{state === 'done' ? '✓' : i + 1}</span>
            <span className={cx(styles.name, compact && styles.srOnly)}>{name}</span>
            <span className={styles.srOnly}>{copy.steps.stepOf(i + 1, steps.length, state)}</span>
            {i < steps.length - 1 && <span aria-hidden="true" className={styles.line} />}
          </li>
        );
      })}
    </ol>
  );
}
