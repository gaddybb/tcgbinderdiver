import { useMemo } from 'react';
import type { CardRecord } from '../../../core/cards';
import { planLists } from '../../../core/plan';
import type { ListPlan } from '../../../core/plan';
import type { CardList } from '../../../core/lists';
import { useCardData } from '../../data/CardDataProvider';
import type { CardData } from '../../data/CardDataProvider';
import { useLists } from '../../data/ListsProvider';
import { useStoreSettings } from '../../data/StoreSettingsProvider';

export interface Dive {
  ready: boolean;                        // the saved lists and settings are in
  lists: CardList[];                     // the lists turned on for the next dive
  needed: CardRecord[];                  // card data for each card still needed, as far as it has loaded
  neededCount: number;                   // cards still needed on those lists, loaded or not
  data: CardData;
  listPlan: ListPlan;
}

// Everything the dive plan and the binder groups editor need: the next-dive lists, their card data, and the plan the
// routing engine makes from them with the player's store settings.
export function useDive(): Dive {
  const lists = useLists();
  const store = useStoreSettings();
  const next = useMemo(() => lists.lists.filter(l => l.inNextDive), [lists.lists]);
  const wanted = useMemo(() => {
    const byKey = new Map<string, { cardKey: string; name: string }>();
    for (const list of next) for (const e of list.entries) if (e.status === 'needed' && !byKey.has(e.cardKey)) byKey.set(e.cardKey, { cardKey: e.cardKey, name: e.name });
    return [...byKey.values()];
  }, [next]);
  const data = useCardData(wanted, lists.now);
  const listPlan = useMemo(() => planLists(next, data.records, store.profile, lists.now()), [next, data.records, store.profile, lists]);
  const needed = useMemo(
    () => wanted.map(w => data.records.get(w.cardKey)).filter((r): r is CardRecord => r !== undefined),
    [wanted, data.records],
  );
  return { ready: lists.ready && store.ready, lists: next, needed, neededCount: wanted.length, data, listPlan };
}
