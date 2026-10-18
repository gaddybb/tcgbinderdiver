// Test fixtures shared by the engine tests. Not imported by app code.
import { routeCard, V1_STORE } from './engine';
import type { Printing, CardInput, StoreProfile, Finish } from './engine';

export const NOW = new Date('2026-10-17T00:00:00Z');

export function pr(o: Partial<Printing> & { setCode: string; usd?: string | null; foil?: string | null; etched?: string | null }): Printing {
  return {
    setCode: o.setCode, setName: o.setName ?? o.setCode.toUpperCase(), setType: o.setType ?? 'expansion',
    releasedAt: o.releasedAt ?? '2025-11-14', rarity: o.rarity ?? 'common', collectorNumber: o.collectorNumber ?? '1',
    finishes: o.finishes ?? (['nonfoil'] as Finish[]),
    prices: { usd: o.usd === undefined ? '0.25' : o.usd, usd_foil: o.foil ?? null, usd_etched: o.etched ?? null },
    promo: o.promo ?? false, promoTypes: o.promoTypes ?? [], frameEffects: o.frameEffects ?? [],
    borderColor: o.borderColor ?? 'black', fullArt: o.fullArt ?? false, digital: o.digital ?? false, games: o.games ?? ['paper', 'mtgo'],
  };
}
export const card = (name: string, printings: Printing[], typeLine = 'Creature'): CardInput => ({ name, typeLine, printings });
export const top = (c: CardInput, s: StoreProfile = V1_STORE) => { const r = routeCard(c, s, NOW); return r.status === 'routed' ? r.ranked[0] : null; };
export const store = (o: Partial<StoreProfile>): StoreProfile => ({ ...V1_STORE, ...o });
