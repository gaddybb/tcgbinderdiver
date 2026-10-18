import { useMemo } from 'react';
import type { Plan } from '../../../core/engine/engine';
import type { CardList } from '../../../core/lists';
import { tripCards, tripPlan } from '../../../core/trip';
import type { Trip, TripCards } from '../../../core/trip';
import { useCardData } from '../../data/CardDataProvider';
import type { CardData } from '../../data/CardDataProvider';
import { useLists } from '../../data/ListsProvider';
import { useStoreSettings } from '../../data/StoreSettingsProvider';
import { useTrip } from '../../data/TripProvider';

export interface TripPlanState {
  ready: boolean;
  trip: Trip | null;
  lists: CardList[];
  data: CardData;
  cards: TripCards | null;
  plan: Plan | null;
  update: (change: (trip: Trip) => Trip) => void;
  now: () => Date;
}

// The trip in progress with its card data and the plan the engine makes for it. The plan is rebuilt from the trip's lists,
// found copies and finished binders, so a refresh or a changed setting always lands on the right stops.
export function useTripPlan(): TripPlanState {
  const lists = useLists();
  const store = useStoreSettings();
  const tripApi = useTrip();
  const trip = tripApi.trip;

  const wanted = useMemo(() => {
    const byKey = new Map<string, { cardKey: string; name: string }>();
    if (trip) {
      for (const list of lists.lists) {
        if (!trip.listIds.includes(list.id)) continue;
        for (const e of list.entries) if (e.status === 'needed' && !byKey.has(e.cardKey)) byKey.set(e.cardKey, { cardKey: e.cardKey, name: e.name });
      }
    }
    return [...byKey.values()];
  }, [lists.lists, trip]);
  const data = useCardData(wanted, lists.now);

  const cards = useMemo(() => (trip ? tripCards(lists.lists, trip, data.records) : null), [lists.lists, trip, data.records]);
  const plan = useMemo(
    () => (trip && cards ? tripPlan(cards.needed, store.profile, lists.now(), trip) : null),
    [trip, cards, store.profile, lists],
  );

  return { ready: lists.ready && store.ready && tripApi.ready, trip, lists: lists.lists, data, cards, plan, update: tripApi.update, now: lists.now };
}
