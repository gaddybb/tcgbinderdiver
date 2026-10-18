import type { InputHTMLAttributes } from 'react';
import styles from './Choice.module.css';

type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'type'> & { label: string };

export function Radio({ label, ...native }: RadioProps) {
  return (
    <label className={styles.choice}>
      <input {...native} type="radio" className={styles.input} />
      {label}
    </label>
  );
}
