import { useSyncExternalStore } from 'react';
import { Banner } from '../components';
import { copy } from '../copy/en';
import styles from './OfflineBanner.module.css';

function subscribe(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

const isOnline = (): boolean => navigator.onLine;

// Shown across the top while the device has no connection. What is saved on the device keeps working.
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, isOnline, () => true);
  if (online) return null;
  return <div className={styles.bar}><Banner tone="warning" title={copy.offline.title}>{copy.offline.text}</Banner></div>;
}
