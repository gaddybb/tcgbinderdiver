import { useId } from 'react';
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cx } from '../cx';
import styles from './Field.module.css';

interface Shared {
  label: string;
  error?: string;
  hint?: string;
  narrow?: boolean;
}
type InputProps = Shared & Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'id'> & { multiline?: false };
type TextareaProps = Shared & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'id'> & { multiline: true };

// Text, search, number and multi-line fields. A problem shows right under the field, in words.
export function Input(props: InputProps | TextareaProps) {
  const id = useId();
  const { label, error, hint, narrow, multiline, ...native } = props;
  const noteId = error || hint ? `${id}-note` : undefined;
  const common = { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': noteId, className: cx(styles.control, narrow && styles.narrow) };
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      {multiline
        ? <textarea {...(native as TextareaHTMLAttributes<HTMLTextAreaElement>)} {...common} />
        : <input {...(native as InputHTMLAttributes<HTMLInputElement>)} {...common} />}
      {error ? <span id={noteId} className={styles.error} role="alert">{error}</span>
        : hint ? <span id={noteId} className={styles.hint}>{hint}</span> : null}
    </div>
  );
}
