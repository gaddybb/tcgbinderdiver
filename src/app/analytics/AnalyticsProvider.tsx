// Analytics through Google Tag Manager, only with the player's consent, and only counts and labels (see
// src/core/analytics): never a card name or the contents of a list. Nothing is loaded and nothing is sent before the player
// says yes, and none of it exists at all while the feature is off or there is no container id.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cleanParams } from '../../core/analytics/events';
import type { AnalyticsEvent } from '../../core/analytics/events';
import { isOn } from '../flags';
import { useStorage } from '../data/StorageProvider';
import { GTM_ID } from './config';

export type Consent = 'unknown' | 'granted' | 'denied';

export interface AnalyticsConfig {
  enabled: boolean;
  gtmId: string;
  loadTagManager?: (id: string) => void;                            // tests replace the script loader
  send?: (entry: Record<string, string | number | boolean>) => void;   // and where events go
}

interface AnalyticsApi {
  available: boolean;                   // the feature is on and has a container id
  consent: Consent;
  choosing: boolean;                    // the consent banner should be showing
  choose: (answer: 'granted' | 'denied') => void;
  reopen: () => void;                   // Change cookie choice
  track: (event: AnalyticsEvent, params?: Record<string, unknown>) => void;
}

const Context = createContext<AnalyticsApi | null>(null);
const KEY = 'consent';

declare global {
  interface Window { dataLayer?: unknown[] }
}

function defaultLoad(id: string): void {
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
}

function defaultSend(entry: Record<string, string | number | boolean>): void {
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(entry);
}

const DEFAULT_CONFIG: AnalyticsConfig = { enabled: isOn('analytics'), gtmId: GTM_ID };

export function AnalyticsProvider({ config = DEFAULT_CONFIG, children }: { config?: AnalyticsConfig; children: ReactNode }) {
  const storage = useStorage();
  const available = config.enabled && config.gtmId !== '';
  const [consent, setConsent] = useState<Consent>('unknown');
  const [loaded, setLoaded] = useState(false);
  const [reopened, setReopened] = useState(false);
  const loadedScript = useRef(false);

  useEffect(() => {
    let current = true;
    void storage.get<Consent>('settings', KEY).then(saved => {
      if (!current) return;
      if (saved === 'granted' || saved === 'denied') setConsent(saved);
      setLoaded(true);
    });
    return () => { current = false; };
  }, [storage]);

  useEffect(() => {
    if (!available || consent !== 'granted' || loadedScript.current) return;
    loadedScript.current = true;
    (config.loadTagManager ?? defaultLoad)(config.gtmId);
  }, [available, consent, config]);

  const choose = useCallback((answer: 'granted' | 'denied') => {
    setConsent(answer);
    setReopened(false);
    void storage.put('settings', KEY, answer);
  }, [storage]);

  const track = useCallback((event: AnalyticsEvent, params: Record<string, unknown> = {}) => {
    if (!available || consent !== 'granted') return;
    (config.send ?? defaultSend)({ event, ...cleanParams(event, params) });
  }, [available, consent, config]);

  const value = useMemo<AnalyticsApi>(() => ({
    available,
    consent,
    choosing: available && loaded && (consent === 'unknown' || reopened),
    choose,
    reopen: () => setReopened(true),
    track,
  }), [available, consent, loaded, reopened, choose, track]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAnalytics(): AnalyticsApi {
  const api = useContext(Context);
  if (!api) throw new Error('useAnalytics needs an AnalyticsProvider above it.');
  return api;
}
