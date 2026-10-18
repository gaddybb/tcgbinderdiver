import { useSyncExternalStore } from 'react';
import { layoutFor } from './breakpoints';
import type { Layout } from './breakpoints';

// The current layout (phone, tablet or desktop), from the one set of breakpoints. Prefer this to CSS media queries.
function subscribe(callback: () => void): () => void {
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
}

export function useLayout(): Layout {
  return useSyncExternalStore(subscribe, () => layoutFor(window.innerWidth), () => 'desktop');
}
