// Binder Diver routing engine (v1 reference). Pure: pass `now` in, no I/O.

export type Finish = 'nonfoil' | 'foil' | 'etched';
export type Location = 'set_binder' | 'commander_box' | 'value_binder' | 'display_case' | 'bulk';
export type StopKind = 'set_binder' | 'commander_box' | 'value_binder' | 'display_case' | 'ask_associate';

export interface Printing {
  setCode: string; setName: string; setType: string; releasedAt: string;
  rarity: string; collectorNumber: string; finishes: Finish[];
  prices: { usd: string | null; usd_foil: string | null; usd_etched: string | null };
  promo: boolean; promoTypes: string[]; frameEffects: string[];
  borderColor: string; fullArt: boolean; digital: boolean; games: string[];
}
export interface CardInput { name: string; typeLine: string; printings: Printing[]; }
export interface BinderGroup { id: string; name: string; setCodes: string[]; }
export interface StoreProfile {
  usesDisplayCase: boolean; displayCaseMin: number;
  hasCommanderSection: boolean;
  usesSetBinders: boolean; setBinderMaxAgeYears: number;
  usesValueBinders: boolean; valueBinderMin: number;
  binderGroups: BinderGroup[]; notCarried: string[];
  includeBasicLands: boolean; acceptFinishes: Finish[];
}

export const V1_STORE: StoreProfile = {
  usesDisplayCase: true, displayCaseMin: 15,
  hasCommanderSection: true,
  usesSetBinders: true, setBinderMaxAgeYears: 3,
  usesValueBinders: false, valueBinderMin: 5,
  binderGroups: [], notCarried: [],
  includeBasicLands: false, acceptFinishes: ['nonfoil', 'foil', 'etched'],
};

export const WEIGHTS = {
  base: { display_case: 0.85, commander_box: 0.8, set_binder: 0.75, value_binder: 0.6, bulk: 0.55 } as Record<Location, number>,
  rarity: { common: 1, uncommon: 1, rare: 0.9, mythic: 0.8, special: 0.6, bonus: 0.6 } as Record<string, number>,
  finish: { nonfoil: 1, foil: 0.7, etched: 0.5 } as Record<Finish, number>,
  special: 0.5, frame: 0.7, unknownPrice: 0.8,
  ageFloor: 0.6, ageSpanYears: 7.5, priceFitExp: 0.25, priceFloor: 0.01,
  nearTie: 0.1,
};

const MAIN_SET_TYPES = new Set(['core', 'expansion', 'draft_innovation', 'masters']);
const SPECIAL_SET_TYPES = new Set(['box', 'masterpiece', 'promo', 'memorabilia', 'funny', 'token']);
const SPECIAL_FRAMES = new Set(['showcase', 'extendedart', 'inverted']);
const STOP_ORDER: Record<StopKind, number> = { set_binder: 0, commander_box: 1, value_binder: 2, display_case: 3, ask_associate: 4 };
const YEAR_MS = 365.25 * 24 * 3600 * 1000;

export interface Stop { id: string; kind: StopKind; label: string; releasedAt?: string; }
export interface Candidate {
  printing: Printing; finish: Finish; price: number | null;
  location: Location; stop: Stop; hint?: 'value binders' | 'bulk boxes'; score: number;
}
export interface RankedStop { stop: Stop; score: number; best: Candidate; }
export type CardRoute =
  | { status: 'routed'; ranked: RankedStop[] }
  | { status: 'skipped_basic' }
  | { status: 'no_stop' };

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

function isBasicLand(typeLine: string): boolean {
  const front = typeLine.split(' // ')[0];
  return /\bBasic\b/.test(front) && /\bLand\b/.test(front);
}

function isSpecial(p: Printing): boolean {
  return p.promo || p.promoTypes.length > 0 || SPECIAL_SET_TYPES.has(p.setType) || p.setCode.toLowerCase() === 'plst';
}

function hasSpecialFrame(p: Printing): boolean {
  return p.fullArt || p.borderColor === 'borderless' || p.frameEffects.some(e => SPECIAL_FRAMES.has(e));
}

export function classify(p: Printing, price: number | null, store: StoreProfile, now: Date):
    { location: Location; groupId?: string; viaAge: boolean } {
  const code = p.setCode.toLowerCase();
  if (store.usesDisplayCase && price !== null && price >= store.displayCaseMin) return { location: 'display_case', viaAge: false };
  if (store.hasCommanderSection && p.setType === 'commander') return { location: 'commander_box', viaAge: false };
  if (store.usesSetBinders) {
    const group = store.binderGroups.find(g => g.setCodes.map(c => c.toLowerCase()).includes(code));
    if (group) return { location: 'set_binder', groupId: group.id, viaAge: false };
    if (MAIN_SET_TYPES.has(p.setType) && ageYears(p.releasedAt, now) <= store.setBinderMaxAgeYears)
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

export function routeCard(card: CardInput, store: StoreProfile, now: Date): CardRoute {
  if (!store.includeBasicLands && isBasicLand(card.typeLine)) return { status: 'skipped_basic' };
  const notCarried = new Set(store.notCarried.map(c => c.toLowerCase()));
  const raw: Omit<Candidate, 'score'>[] = [];
  const meta = new Map<Omit<Candidate, 'score'>, boolean>();   // viaAge per candidate
  for (const p of card.printings) {
    if (p.digital || !p.games.includes('paper') || notCarried.has(p.setCode.toLowerCase())) continue;
    for (const f of p.finishes) {
      if (!store.acceptFinishes.includes(f)) continue;
      const price = priceFor(p, f);
      const c = classify(p, price, store, now);
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
    if (isSpecial(p)) s *= WEIGHTS.special;
    if (hasSpecialFrame(p)) s *= WEIGHTS.frame;
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
    b.score - a.score || STOP_ORDER[a.stop.kind] - STOP_ORDER[b.stop.kind] || a.stop.id.localeCompare(b.stop.id));
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
export interface NeededCard { key: string; card: CardInput; copies: number; }
export interface PlanStop { stop: Stop; cards: { key: string; copies: number; candidate: Candidate }[]; copies: number; value: number; }
export interface Plan { stops: PlanStop[]; assignment: Map<string, string>; noStop: string[]; skipped: string[]; routes: Map<string, CardRoute>; }

export function buildPlan(needed: NeededCard[], store: StoreProfile, now: Date, finished: Set<string> = new Set()): Plan {
  const routes = new Map<string, CardRoute>();
  const noStop: string[] = [], skipped: string[] = [];
  const first = new Map<string, RankedStop>();
  for (const n of needed) {
    const r = routeCard(n.card, store, now); routes.set(n.key, r);
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
      if (finished.has(x.stop.id) || x === f || x.score < f.score - WEIGHTS.nearTie) continue;
      const px = pop.get(x.stop.id) ?? 0, pp = pop.get(pick.stop.id) ?? 0;
      if (px > pp || (px === pp && x.score > pick.score)) pick = x;
    }
    chosen.set(n.key, pick);
  }
  return assemble(needed, chosen, routes, noStop, skipped);
}

function assemble(needed: NeededCard[], chosen: Map<string, RankedStop>, routes: Map<string, CardRoute>, noStop: string[], skipped: string[], frozenOrder?: string[]): Plan {
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
    list.sort((a, b) => idx(a.stop.id) - idx(b.stop.id) || STOP_ORDER[a.stop.kind] - STOP_ORDER[b.stop.kind]);
  } else {
    list.sort((a, b) =>
      STOP_ORDER[a.stop.kind] - STOP_ORDER[b.stop.kind] ||
      (a.stop.kind === 'set_binder' ? (b.copies - a.copies) || (Date.parse(b.stop.releasedAt ?? '') || 0) - (Date.parse(a.stop.releasedAt ?? '') || 0) : 0) ||
      a.stop.label.localeCompare(b.stop.label));
  }
  return { stops: list, assignment, noStop, skipped, routes };
}

// Finish a stop mid-trip: only that stop's cards move, to their next unfinished stop. Order stays frozen.
export function finishStop(plan: Plan, needed: NeededCard[], stopId: string, finished: Set<string>, found: Set<string>): Plan {
  const nowFinished = new Set(finished); nowFinished.add(stopId);
  const frozen = plan.stops.map(s => s.stop.id);
  const chosen = new Map<string, RankedStop>();
  const noStop = [...plan.noStop];
  for (const n of needed) {
    const cur = plan.assignment.get(n.key);
    if (!cur) continue;
    const r = plan.routes.get(n.key) as { status: 'routed'; ranked: RankedStop[] };
    if (cur !== stopId || found.has(n.key)) { chosen.set(n.key, r.ranked.find(x => x.stop.id === cur)!); continue; }
    const next = r.ranked.find(x => !nowFinished.has(x.stop.id));
    if (next) chosen.set(n.key, next); else noStop.push(n.key);
  }
  for (const n of needed) if (found.has(n.key) && plan.assignment.get(n.key) === stopId) chosen.delete(n.key);   // found cards leave the plan
  return assemble(needed.filter(n => chosen.has(n.key)), chosen, plan.routes, noStop, plan.skipped, frozen);
}
