import { useEffect, useRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cx } from '../cx';
import styles from './Choice.module.css';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'type'> & {
  label: string;
  hideLabel?: boolean;        // for a checkbox in a table row or beside a card: the label is still read aloud
  indeterminate?: boolean;    // "some are selected" on a select-all box
};

export function Checkbox({ label, hideLabel = false, indeterminate = false, ...native }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
  return (
    <label className={cx(styles.choice, hideLabel && styles.bare)}>
      <input {...native} ref={ref} type="checkbox" className={styles.input} aria-label={hideLabel ? label : undefined} />
      {!hideLabel && label}
    </label>
  );
}
