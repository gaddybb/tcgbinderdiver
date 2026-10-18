// The dive plan as the screen shows it: stops with counts, value and verdict, grouped by stop type in walking order.
import { pullVerdict } from '../engine/engine';
import type { Plan, PullSettings, PullVerdict, StopKind } from '../engine/engine';

export interface DiveStopView {
  id: string;
  kind: StopKind;
  label: string;
  cards: number;      // copies to find here
  value: number;      // dollars, from the best price of each card
  verdict: PullVerdict;
}

export interface DiveGroup { kind: StopKind; stops: DiveStopView[] }

export function diveStops(plan: Plan, pull: PullSettings): DiveStopView[] {
  return plan.stops.map(s => ({
    id: s.stop.id, kind: s.stop.kind, label: s.stop.label, cards: s.copies, value: s.value, verdict: pullVerdict(s, pull),
  }));
}

// Walking order is kept: set binders (most copies first), Commander box, Display case, Ask an associate.
export function groupByKind(stops: readonly DiveStopView[]): DiveGroup[] {
  const groups: DiveGroup[] = [];
  for (const stop of stops) {
    const last = groups[groups.length - 1];
    if (last && last.kind === stop.kind) last.stops.push(stop);
    else groups.push({ kind: stop.kind, stops: [stop] });
  }
  return groups;
}

// "With these settings: 2 binders worth a pull, 2 marked Buy online."
export function verdictPreview(stops: readonly DiveStopView[]): { worth: number; buyOnline: number } {
  return {
    worth: stops.filter(s => s.verdict === 'worth_a_pull').length,
    buyOnline: stops.filter(s => s.verdict === 'buy_online').length,
  };
}

export const totalCards = (stops: readonly DiveStopView[]): number => stops.reduce((n, s) => n + s.cards, 0);
