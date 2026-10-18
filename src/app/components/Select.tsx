import { useId } from 'react';
import type { ReactNode, SelectHTMLAttributes } from 'react';
import styles from './Field.module.css';

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'id'> & { label: string; children: ReactNode };

export function Select({ label, children, ...native }: SelectProps) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <select {...native} id={id} className={styles.control}>{children}</select>
    </div>
  );
}
