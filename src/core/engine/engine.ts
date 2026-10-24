// Binder Diver routing engine (v1). Pure: pass `now` in, no I/O.
// Logic is copied unchanged from reference/engine/engine.ts; types, WEIGHTS and V1_STORE live in their own modules.
import type {
  BinderGroup, Candidate, CardInput, CardRoute, Finish, Location, NeededCard, Plan, PlanStop,
  GameRules, Printing, RankedStop, Stop, StopKind, StoreProfile,
} from './types';
import { MAGIC_RULES } from './rules';

export type {
  BinderGroup, Candidate, CardInput, CardRoute, Finish, Location, NeededCard, Plan, PlanStop,
  GameRules, Printing, RankedStop, Stop, StopKind, StoreProfile,
};
export { WEIGHTS } from './weights';
export { MAGIC_RULES, isBasicLand } from './rules';
export { V1_STORE } from './storeProfile';
export { DEFAULT_PULL_SETTINGS } from './pullSettings';
export { pullVerdict } from './pullVerdict';
export type { PullSettings, PullVerdict } from './types';

const YEAR_MS = 365.25 * 24 * 3600 * 1000;

export function priceFor(p: Printing, f: Finish): number | null {
  const raw = f === 'nonfoil' ? p.prices.usd : f === 'foil' ? p.prices.usd_foil : p.prices.usd_etched;
  if (raw == null) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

export function ageYears(releasedAt: string, now: Date): number {
  const t = Date.parse(releasedAt);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;   // unknown date: treat as old
  return Math.max(0, (now.getTime() - t) / YEAR_MS);
}

function isSpecial(p: Printing, rules: GameRules): boolean {
  return p.promo || p.promoTypes.length > 0 || rules.specialSetTypes.has(p.setType) || rules.specialSetCodes.has(p.setCode.toLowerCase());
}

function hasSpecialFrame(p: Printing, rules: GameRules): boolean {
  return p.fullArt || p.borderColor === 'borderless' || p.frameEffects.some(e => rules.specialFrames.has(e));
}

export function classify(p: Printing, price: number | null, store: StoreProfile, now: Date, rules: GameRules = MAGIC_RULES):
    { location: Location; groupId?: string; viaAge: boolean } {
  const code = p.setCode.toLowerCase();
  if (store.usesDisplayCase && price !== null && price >= store.displayCaseMin) return { location: 'display_case', viaAge: false };
  if (store.hasCommanderSection && rules.commanderSetType !== null && p.setType === rules.commanderSetType) return { location: 'commander_box', viaAge: false };
  // With no combined Commander library, a recent Commander set is a binder of its own, like any other set.
  if (store.usesSetBinders) {
    const group = store.binderGroups.find(g => g.setCodes.map(c => c.toLowerCase()).includes(code));
    if (group) return { location: 'set_binder', groupId: group.id, viaAge: false };
    const bindered = rules.mainSetTypes.has(p.setType) || (!store.hasCommanderSection && rules.commanderSetType !== null && p.setType === rules.commanderSetType);
    if (bindered && ageYears(p.releasedAt, now) <= store.setBinderMaxAgeYears)
      return { location: 'set_binder', viaAge: true };
  }
  if (price !== null && price >= store.valueBinderMin) return { location: 'value_binder', viaAge: false };
  return { location: 'bulk', viaAge: false };
}

function stopFor(loc: Location, p: Printing, groupId: string | undefined, store: StoreProfile):
    { stop: Stop; hint?: 'value binders' | 'bulk boxes' } {
  switch (loc) {
    case 'set_binder': {
      if (groupId) {
        const g = store.binderGroups.find(x => x.id === groupId)!;
        return { stop: { id: `group:${g.id}`, kind: 'set_binder', label: g.name } };
      }
      const code = p.setCode.toLowerCase();
      return { stop: { id: `set:${code}`, kind: 'set_binder', label: p.setName, releasedAt: p.releasedAt } };
    }
    case 'commander_box': return { stop: { id: 'commander', kind: 'commander_box', label: 'Commander box' } };
    case 'display_case': return { stop: { id: 'case', kind: 'display_case', label: 'Display case' } };
    case 'value_binder':
      if (store.usesValueBinders) return { stop: { id: 'value', kind: 'value_binder', label: 'Value binders' } };
      return { stop: { id: 'ask', kind: 'ask_associate', label: 'Ask an associate' }, hint: 'value binders' };
    case 'bulk':
      return { stop: { id: 'ask', kind: 'ask_associate', label: 'Ask an associate' }, hint: 'bulk boxes' };
  }
}

export function routeCard(card: CardInput, store: StoreProfile, now: Date, rules: GameRules = MAGIC_RULES): CardRoute {
  const WEIGHTS = rules.weights;
  if (!store.includeBasicLands && rules.isBasicLand(card.typeLine)) return { status: 'skipped_basic' };
  const notCarried = new Set(store.notCarried.map(c => c.toLowerCase()));
  const raw: Omit<Candidate, 'score'>[] = [];
  const meta = new Map<Omit<Candidate, 'score'>, boolean>();   // viaAge per candidate
  for (const p of card.printings) {
    if (p.digital || !p.games.includes('paper') || notCarried.has(p.setCode.toLowerCase())) continue;
    for (const f of p.finishes) {
      if (!store.acceptFinishes.includes(f)) continue;
      const price = priceFor(p, f);
      const c = classify(p, price, store, now, rules);
      const { stop, hint } = stopFor(c.location, p, c.groupId, store);
      const cand = { printing: p, finish: f, price, location: c.location, stop, hint };
      raw.push(cand); meta.set(cand, c.viaAge);
    }
  }
  if (raw.length === 0) return { status: 'no_stop' };

  const priced = raw.map(c => c.price).filter((x): x is number => x !== null);
  const cheapest = priced.length ? Math.max(Math.min(...priced), WEIGHTS.priceFloor) : null;

  const scored: Candidate[] = raw.map(c => {
    const p = c.printing;
    let s = WEIGHTS.base[c.location];
    if (c.location !== 'display_case') s *= WEIGHTS.rarity[p.rarity] ?? WEIGHTS.rarity.special;
    s *= WEIGHTS.finish[c.finish];
    if (isSpecial(p, rules)) s *= WEIGHTS.special;
    else if (!rules.ordinarySetTypes.has(p.setType) && p.setType !== rules.commanderSetType) s *= WEIGHTS.altProduct;
    if (hasSpecialFrame(p, rules)) s *= WEIGHTS.frame;
    if (c.price === null) s *= WEIGHTS.unknownPrice;
    if (meta.get(c)) {
      const yrs = ageYears(p.releasedAt, now);
      s *= Math.max(WEIGHTS.ageFloor, 1 - yrs / WEIGHTS.ageSpanYears);
    }
    if (c.price !== null && cheapest !== null) s *= Math.pow(cheapest / Math.max(c.price, WEIGHTS.priceFloor), WEIGHTS.priceFitExp);
    return { ...c, score: Math.min(1, Math.max(0, s)) };
  });

  const byStop = new Map<string, RankedStop>();
  for (const c of scored) {
    const cur = byStop.get(c.stop.id);
    if (!cur || better(c, cur.best)) byStop.set(c.stop.id, { stop: c.stop, score: c.score, best: c });
  }
  const ranked = [...byStop.values()].sort((a, b) =>
    b.score - a.score || rules.stopOrder[a.stop.kind] - rules.stopOrder[b.stop.kind] || a.stop.id.localeCompare(b.stop.id));
  return { status: 'routed', ranked };
}

// within one stop: higher score, then lower price, then nonfoil
function better(a: Candidate, b: Candidate): boolean {
  if (a.score !== b.score) return a.score > b.score;
  const pa = a.price ?? Number.POSITIVE_INFINITY, pb = b.price ?? Number.POSITIVE_INFINITY;
  if (pa !== pb) return pa < pb;
  return a.finish === 'nonfoil' && b.finish !== 'nonfoil';
}

// ---------------- plan ----------------
export function buildPlan(needed: NeededCard[], store: StoreProfile, now: Date, finished: Set<string> = new Set(), rules: GameRules = MAGIC_RULES): Plan {
  const routes = new Map<string, CardRoute>();
  const noStop: string[] = [], skipped: string[] = [];
  const first = new Map<string, RankedStop>();
  for (const n of needed) {
    const r = routeCard(n.card, store, now, rules); routes.set(n.key, r);
    if (r.status === 'skipped_basic') { skipped.push(n.key); continue; }
    const open = r.status === 'routed' ? r.ranked.filter(x => !finished.has(x.stop.id)) : [];
    if (open.length === 0) { noStop.push(n.key); continue; }
    first.set(n.key, open[0]);
  }
  // near ties go to the busier stop (one pass, based on first-choice popularity)
  const pop = new Map<string, number>();
  for (const n of needed) { const f = first.get(n.key); if (f) pop.set(f.stop.id, (pop.get(f.stop.id) ?? 0) + n.copies); }
  const chosen = new Map<string, RankedStop>();
  for (const n of needed) {
    const f = first.get(n.key); if (!f) continue;
    const r = routes.get(n.key) as { status: 'routed'; ranked: RankedStop[] };
    let pick = f;
    for (const x of r.ranked) {
      if (finished.has(x.stop.id) || x === f || x.score < f.score - rules.weights.nearTie) continue;
      const px = pop.get(x.stop.id) ?? 0, pp = pop.get(pick.stop.id) ?? 0;
      if (px > pp || (px === pp && x.score > pick.score)) pick = x;
    }
    chosen.set(n.key, pick);
  }
  return assemble(needed, chosen, routes, noStop, skipped, rules);
}

function assemble(needed: NeededCard[], chosen: Map<string, RankedStop>, routes: Map<string, CardRoute>, noStop: string[], skipped: string[], rules: GameRules, frozenOrder?: string[], left: Map<string, string[]> = new Map()): Plan {
  const stops = new Map<string, PlanStop>();
  const assignment = new Map<string, string>();
  for (const n of needed) {
    const c = chosen.get(n.key); if (!c) continue;
    assignment.set(n.key, c.stop.id);
    const s = stops.get(c.stop.id) ?? { stop: c.stop, cards: [], copies: 0, value: 0 };
    s.cards.push({ key: n.key, copies: n.copies, candidate: c.best });
    s.copies += n.copies; s.value += (c.best.price ?? 0) * n.copies;
    stops.set(c.stop.id, s);
  }
  const list = [...stops.values()];
  if (frozenOrder) {
    const idx = (id: string) => { const i = frozenOrder.indexOf(id); return i === -1 ? Number.MAX_SAFE_INTEGER : i; };
    list.sort((a, b) => idx(a.stop.id) - idx(b.stop.id) || rules.stopOrder[a.stop.kind] - rules.stopOrder[b.stop.kind]);
  } else {
    list.sort((a, b) =>
      rules.stopOrder[a.stop.kind] - rules.stopOrder[b.stop.kind] ||
      (a.stop.kind === 'set_binder' ? (b.copies - a.copies) || (Date.parse(b.stop.releasedAt ?? '') || 0) - (Date.parse(a.stop.releasedAt ?? '') || 0) : 0) ||
      a.stop.label.localeCompare(b.stop.label));
  }
  // A stop that gains cards later is appended, so it keeps its place for the rest of the trip.
  const order = [...(frozenOrder ?? []), ...list.map(s => s.stop.id).filter(id => !(frozenOrder ?? []).includes(id))];
  return { stops: list, assignment, noStop, skipped, routes, order, left };
}

// Finish a stop mid-trip: only that stop's cards move, to their next unfinished stop. Order stays frozen.
export function finishStop(plan: Plan, needed: NeededCard[], stopId: string, finished: Set<string>, found: Set<string>, rules: GameRules = MAGIC_RULES): Plan {
  const nowFinished = new Set(finished); nowFinished.add(stopId);
  const chosen = new Map<string, RankedStop>();
  const noStop = [...plan.noStop];
  const left = new Map(plan.left);
  for (const n of needed) {
    const cur = plan.assignment.get(n.key);
    if (!cur) continue;
    const r = plan.routes.get(n.key) as { status: 'routed'; ranked: RankedStop[] };
    if (cur !== stopId || found.has(n.key)) { chosen.set(n.key, r.ranked.find(x => x.stop.id === cur)!); continue; }
    left.set(n.key, [...(left.get(n.key) ?? []), stopId]);   // remembered so Reopen can bring it back
    const next = r.ranked.find(x => !nowFinished.has(x.stop.id));
    if (next) chosen.set(n.key, next); else noStop.push(n.key);
  }
  for (const n of needed) if (found.has(n.key) && plan.assignment.get(n.key) === stopId) chosen.delete(n.key);   // found cards leave the plan
  return assemble(needed.filter(n => chosen.has(n.key)), chosen, plan.routes, noStop, plan.skipped, rules, plan.order, left);
}

// Reopen a finished stop: the cards that left it unfound come back (from a later stop or from no_stop).
// Found cards stay found, other cards stay where they are, and stop order stays frozen.
export function reopenStop(plan: Plan, needed: NeededCard[], stopId: string, finished: Set<string>, found: Set<string>, rules: GameRules = MAGIC_RULES): Plan {
  if (!finished.has(stopId)) return plan;
  const stillFinished = new Set(finished); stillFinished.delete(stopId);
  const chosen = new Map<string, RankedStop>();
  const restored = new Set<string>();
  const left = new Map(plan.left);
  for (const n of needed) {
    const r = plan.routes.get(n.key);
    if (!r || r.status !== 'routed') continue;
    const cur = plan.assignment.get(n.key);
    const stops = left.get(n.key) ?? [];
    if (!found.has(n.key) && stops.includes(stopId)) {
      const next = r.ranked.find(x => !stillFinished.has(x.stop.id));
      if (next) {
        chosen.set(n.key, next); restored.add(n.key);
        left.set(n.key, stops.filter(id => id !== stopId));
        continue;
      }
    }
    if (cur) chosen.set(n.key, r.ranked.find(x => x.stop.id === cur)!);
  }
  const noStop = plan.noStop.filter(k => !restored.has(k));
  return assemble(needed.filter(n => chosen.has(n.key)), chosen, plan.routes, noStop, plan.skipped, rules, plan.order, left);
}
