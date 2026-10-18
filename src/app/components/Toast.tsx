import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { copy } from '../copy/en';
import styles from './Toast.module.css';

// A toast with Undo stays for 5 seconds after Found, a status change or a delete (reference/design).
export const TOAST_DURATION_MS = 5000;

interface ToastViewProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ToastView({ message, actionLabel = copy.common.undo, onAction }: ToastViewProps) {
  return (
    <div role="status" className={styles.toast}>
      <span className={styles.message}>{message}</span>
      {onAction && <button type="button" className={styles.action} onClick={onAction}>{actionLabel}</button>}
    </div>
  );
}

export interface ToastInput {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface ToastApi { show: (toast: ToastInput) => void; dismiss: () => void }
const ToastContext = createContext<ToastApi | null>(null);

// One toast at a time: a new one replaces the old one.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<(ToastInput & { id: number }) | null>(null);
  const dismiss = useCallback(() => setCurrent(null), []);
  const show = useCallback((toast: ToastInput) => setCurrent({ ...toast, id: Date.now() + Math.random() }), []);

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(dismiss, current.durationMs ?? TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [current, dismiss]);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      {current && (
        <div className={styles.host}>
          <ToastView
            message={current.message}
            actionLabel={current.actionLabel}
            onAction={current.onAction && (() => { current.onAction?.(); dismiss(); })}
          />
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast needs a ToastProvider above it.');
  return api;
}
