import type { InputHTMLAttributes } from 'react';
import styles from './Switch.module.css';

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'type' | 'role' | 'onChange'> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
  // The words beside the switch. Without them, pass an aria-label that names what it turns on.
  label?: string;
};

export function Switch({ label, checked, onChange, ...native }: SwitchProps) {
  return (
    <label className={styles.switch}>
      <input {...native} type="checkbox" role="switch" className={styles.input} checked={checked} onChange={e => onChange(e.target.checked)} />
      <span aria-hidden="true" className={styles.track}><span className={styles.knob} /></span>
      {label && <span className={styles.text}>{label}</span>}
    </label>
  );
}
