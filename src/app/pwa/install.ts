// "Install Binder Diver": the browser tells the page once, early, that the app can be installed, and the page may keep that
// offer and show it later (the plan: once, after the first trip). This keeps the offer and lets screens read it.
import { useSyncExternalStore } from 'react';

interface InstallOffer extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let offer: InstallOffer | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

// Call once at start-up, before anything else can miss the event.
export function captureInstallOffer(): void {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    offer = event as InstallOffer;
    notify();
  });
  window.addEventListener('appinstalled', () => { offer = null; notify(); });
}

const subscribe = (callback: () => void): (() => void) => { listeners.add(callback); return () => { listeners.delete(callback); }; };

export function useInstallOffer(): { canInstall: boolean; install: () => Promise<'accepted' | 'dismissed' | 'unavailable'> } {
  const current = useSyncExternalStore(subscribe, () => offer, () => null);
  return {
    canInstall: current !== null,
    async install() {
      if (!offer) return 'unavailable';
      const asked = offer;
      await asked.prompt();
      const { outcome } = await asked.userChoice;
      offer = null;
      notify();
      return outcome;
    },
  };
}
