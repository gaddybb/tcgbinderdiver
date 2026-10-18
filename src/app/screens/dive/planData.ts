import type { CardRecord } from '../../../core/cards';
import type { StoreProfile } from '../../../core/engine/engine';
import type { CardList } from '../../../core/lists';
import { planLists } from '../../../core/plan';
import type { ListPlan } from '../../../core/plan';

// The cards still needed on these lists, once each, as `{ cardKey, name }` for loading their data.
export function neededCards(lists: readonly CardList[]): { cardKey: string; name: string }[] {
  const byKey = new Map<string, { cardKey: string; name: string }>();
  for (const list of lists) for (const e of list.entries) if (e.status === 'needed' && !byKey.has(e.cardKey)) byKey.set(e.cardKey, { cardKey: e.cardKey, name: e.name });
  return [...byKey.values()];
}

export interface DivePlanData {
  listPlan: ListPlan;
  needed: CardRecord[];      // card data for each needed card, as far as it has loaded
}

// The plan for the lists turned on for the next dive, from the card data that is in.
export function divePlanFor(next: readonly CardList[], records: ReadonlyMap<string, CardRecord>, profile: StoreProfile, now: Date): DivePlanData {
  return {
    listPlan: planLists(next, records, profile, now),
    needed: neededCards(next).map(c => records.get(c.cardKey)).filter((r): r is CardRecord => r !== undefined),
  };
}
