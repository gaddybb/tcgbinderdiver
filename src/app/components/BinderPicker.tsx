import { useId } from 'react';
import { copy } from '../copy/en';
import styles from './BinderPicker.module.css';

export interface BinderOption {
  value: string;
  label: string;
}

interface BinderPickerProps {
  label: string;
  options: readonly BinderOption[];
  value: string;
  onChange: (value: string) => void;
}

const Chevron = ({ d }: { d: string }) => (
  <svg aria-hidden="true" className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d={d} />
  </svg>
);

// The stop dropdown with Previous and Next, used at the top of the store dive.
export function BinderPicker({ label, options, value, onChange }: BinderPickerProps) {
  const id = useId();
  const index = options.findIndex(o => o.value === value);
  const go = (to: number) => { const next = options[to]; if (next) onChange(next.value); };
  return (
    <div className={styles.picker}>
      <button type="button" className={styles.step} aria-label={copy.picker.previous} disabled={index <= 0} onClick={() => go(index - 1)}>
        <Chevron d="M15 6l-6 6 6 6" />
      </button>
      <div className={`${styles.field} ${styles.column}`}>
        <label htmlFor={id} className={styles.label}>{label}</label>
        <select id={id} className={styles.select} value={value} onChange={e => onChange(e.target.value)}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <button type="button" className={styles.step} aria-label={copy.picker.next} disabled={index < 0 || index >= options.length - 1} onClick={() => go(index + 1)}>
        <Chevron d="M9 6l6 6-6 6" />
      </button>
    </div>
  );
}
