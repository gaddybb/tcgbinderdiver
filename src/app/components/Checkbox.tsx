import type { InputHTMLAttributes } from 'react';
import styles from './Choice.module.css';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'type'> & { label: string };

export function Checkbox({ label, ...native }: CheckboxProps) {
  return (
    <label className={styles.choice}>
      <input {...native} type="checkbox" className={styles.input} />
      {label}
    </label>
  );
}
