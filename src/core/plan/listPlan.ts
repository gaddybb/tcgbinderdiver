// Runs the routing engine over the cards on a set of lists, using the card data the app has saved.
// This is the one place card data becomes engine input, so the list review, the dive plan and the store all agree.
import { buildPlan } from '../engine/engine';
import type { Finish, NeededCard, Plan, Printing, StopKind, StoreProfile } from '../engine/engine';
import { mergeNeeded } from '../lists';
import type { CardList } from '../lists';
import type { CardRecord } from '../cards/types';
import { lockedPrintings } from '../cards/printingArt';

export type CardTarget =
  | { kind: 'stop'; stopId: string; stopLabel: string; stopKind: StopKind; setCode: string; collectorNumber: string; finish: Finish; price: number | null }
  | { kind: 'no_binder' }       // no paper printing anywhere the store carries
  | { kind: 'skipped_basic' };  // a basic land, left off the hunt

export interface ListPlan {
  plan: Plan;
  // By card key. A card has no entry while its data is missing, or when it is not needed or its list is off.
  targets: Map<string, CardTarget>;
}

// `lists` should be the lists to plan for: the ones in the next dive (the caller turns a viewed list on if it is off).
// Only needed cards on lists that are on are planned, and a card on several lists is planned once with all its copies.
export function planLists(lists: readonly CardList[], records: ReadonlyMap<string, CardRecord>, store: StoreProfile, now: Date): ListPlan {
  const needed: NeededCard[] = [];
  for (const merged of mergeNeeded(lists)) {
    const record = records.get(merged.cardKey);
    if (!record) continue;
    needed.push({
      key: merged.cardKey,
      copies: merged.copies,
      card: { name: record.summary.name, typeLine: record.summary.typeLine, printings: lockedPrintings(record.printings, merged.lock) as Printing[] },
    });
  }

  const plan = buildPlan(needed, store, now);
  const targets = new Map<string, CardTarget>();

  for (const planStop of plan.stops) {
    for (const placed of planStop.cards) {
      const { candidate } = placed;
      targets.set(placed.key, {
        kind: 'stop',
        stopId: planStop.stop.id,
        stopLabel: planStop.stop.label,
        stopKind: planStop.stop.kind,
        setCode: candidate.printing.setCode,
        collectorNumber: candidate.printing.collectorNumber,
        finish: candidate.finish,
        price: candidate.price,
      });
    }
  }
  for (const key of plan.skipped) targets.set(key, { kind: 'skipped_basic' });
  for (const key of plan.noStop) targets.set(key, { kind: 'no_binder' });

  return { plan, targets };
}
