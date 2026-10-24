// A store trip: which lists are in it, how many copies of each card are found (per list), and which binders were finished
// or reopened. The plan is not stored: it is rebuilt from the cards and these events, so it always agrees with them.
// Pure: ids and times come in as arguments.
import { buildPlan, finishStop, reopenStop } from '../engine/engine';
import type { NeededCard, Plan, Printing, StoreProfile } from '../engine/engine';
import { DEFAULT_GAME } from '../games';
import type { GameId } from '../games';
import { lockedPrintings } from '../cards/printingArt';
import type { CardRecord } from '../cards/types';
import { mergeNeeded } from '../lists';
import type { CardList, NeededAcrossLists } from '../lists';

export interface TripEvent {
  type: 'finish' | 'reopen';
  stopId: string;
  found: string[];            // card keys fully found at that moment (the engine needs them to move the rest)
}

export interface Trip {
  id: string;
  startedAt: string;          // ISO
  endedAt?: string;           // set when the trip is ended
  listIds: string[];          // lists in this trip, in the order found copies fill them (top to bottom)
  found: Record<string, Record<string, number>>;   // card key -> list id -> copies found
  notAvailable: string[];     // card keys marked Not available at a counter stop
  events: TripEvent[];
  game?: GameId;              // absent means Magic
}

export const startTrip = (id: string, now: Date, listIds: readonly string[], game: GameId = DEFAULT_GAME): Trip => (
  { id, startedAt: now.toISOString(), listIds: [...listIds], found: {}, notAvailable: [], events: [], ...(game !== DEFAULT_GAME ? { game } : {}) }
);

export const endTrip = (trip: Trip, now: Date): Trip => (trip.endedAt ? trip : { ...trip, endedAt: now.toISOString() });

// Turning a list on or off for the trip. What was found on it stays remembered, but only lists that are on count.
export function setListOn(trip: Trip, listId: string, on: boolean, order: readonly string[]): Trip {
  const has = trip.listIds.includes(listId);
  if (on === has) return trip;
  const ids = on ? [...trip.listIds, listId] : trip.listIds.filter(id => id !== listId);
  return { ...trip, listIds: order.filter(id => ids.includes(id)).concat(ids.filter(id => !order.includes(id))) };
}

export interface TripCards {
  needed: NeededCard[];                          // what the engine plans, in list order
  parts: Map<string, NeededAcrossLists>;         // per card: copies wanted on each list that is on
}

// The cards this trip is looking for: needed cards on the trip's lists, each once with every copy, as far as card data is in.
export function tripCards(lists: readonly CardList[], trip: Trip, records: ReadonlyMap<string, CardRecord>): TripCards {
  const inTrip = lists.filter(l => trip.listIds.includes(l.id)).map(l => ({ ...l, inNextDive: true }));
  const needed: NeededCard[] = [];
  const parts = new Map<string, NeededAcrossLists>();
  for (const merged of mergeNeeded(inTrip)) {
    const record = records.get(merged.cardKey);
    if (!record) continue;
    parts.set(merged.cardKey, merged);
    needed.push({ key: merged.cardKey, copies: merged.copies, card: { name: record.summary.name, typeLine: record.summary.typeLine, printings: lockedPrintings(record.printings, merged.lock) as Printing[] } });
  }
  return { needed, parts };
}

const foundOn = (trip: Trip, key: string, listId: string): number => trip.found[key]?.[listId] ?? 0;

export const foundCopies = (trip: Trip, part: NeededAcrossLists): number =>
  part.parts.reduce((n, p) => n + Math.min(foundOn(trip, part.cardKey, p.listId), p.quantity), 0);

export const remainingCopies = (trip: Trip, part: NeededAcrossLists): number => part.copies - foundCopies(trip, part);

// Found +1 fills the lists top to bottom. Nothing happens once every wanted copy is found.
export function markFound(trip: Trip, part: NeededAcrossLists): Trip {
  const target = part.parts.find(p => foundOn(trip, part.cardKey, p.listId) < p.quantity);
  if (!target) return trip;
  const byList = { ...trip.found[part.cardKey], [target.listId]: foundOn(trip, part.cardKey, target.listId) + 1 };
  return { ...trip, found: { ...trip.found, [part.cardKey]: byList }, notAvailable: trip.notAvailable.filter(k => k !== part.cardKey) };
}

// Undo takes back the copy that was found last: the bottom-most list with a copy found.
export function undoFound(trip: Trip, part: NeededAcrossLists): Trip {
  const target = [...part.parts].reverse().find(p => foundOn(trip, part.cardKey, p.listId) > 0);
  if (!target) return trip;
  const byList = { ...trip.found[part.cardKey], [target.listId]: foundOn(trip, part.cardKey, target.listId) - 1 };
  return { ...trip, found: { ...trip.found, [part.cardKey]: byList } };
}

// Card detail can put a copy on a specific list. Nothing happens when that list's copies are all found.
export function markFoundOn(trip: Trip, part: NeededAcrossLists, listId: string): Trip {
  const target = part.parts.find(p => p.listId === listId);
  if (!target || foundOn(trip, part.cardKey, listId) >= target.quantity) return trip;
  const byList = { ...trip.found[part.cardKey], [listId]: foundOn(trip, part.cardKey, listId) + 1 };
  return { ...trip, found: { ...trip.found, [part.cardKey]: byList }, notAvailable: trip.notAvailable.filter(k => k !== part.cardKey) };
}

// Takes back one copy found for that list.
export function undoFoundOn(trip: Trip, part: NeededAcrossLists, listId: string): Trip {
  if (!part.parts.some(p => p.listId === listId) || foundOn(trip, part.cardKey, listId) <= 0) return trip;
  const byList = { ...trip.found[part.cardKey], [listId]: foundOn(trip, part.cardKey, listId) - 1 };
  return { ...trip, found: { ...trip.found, [part.cardKey]: byList } };
}

// Copies found for one list (never more than it wants).
export const foundOnList = (trip: Trip, part: NeededAcrossLists, listId: string): number =>
  Math.min(foundOn(trip, part.cardKey, listId), part.parts.find(p => p.listId === listId)?.quantity ?? 0);

// At a counter stop one tap finds every copy the staff have.
export function markAllFound(trip: Trip, part: NeededAcrossLists): Trip {
  let next = trip;
  for (let i = 0; i < part.copies; i++) next = markFound(next, part);
  return next;
}

export const undoAllFound = (trip: Trip, part: NeededAcrossLists): Trip => {
  let next = trip;
  for (let i = 0; i < part.copies; i++) next = undoFound(next, part);
  return next;
};

export const markNotAvailable = (trip: Trip, cardKey: string): Trip =>
  trip.notAvailable.includes(cardKey) ? trip : { ...trip, notAvailable: [...trip.notAvailable, cardKey] };

export const clearNotAvailable = (trip: Trip, cardKey: string): Trip => ({ ...trip, notAvailable: trip.notAvailable.filter(k => k !== cardKey) });

// Cards with every wanted copy found.
export function fullyFound(trip: Trip, parts: ReadonlyMap<string, NeededAcrossLists>): Set<string> {
  const keys = new Set<string>();
  for (const [key, part] of parts) if (remainingCopies(trip, part) <= 0) keys.add(key);
  return keys;
}

// Finish binder: the copies not found here move to each card's next binder; the order of binders stays as it was.
export const finishBinder = (trip: Trip, stopId: string, parts: ReadonlyMap<string, NeededAcrossLists>): Trip =>
  ({ ...trip, events: [...trip.events, { type: 'finish', stopId, found: [...fullyFound(trip, parts)] }] });

// Reopen a finished binder: the copies that left it unfound come back to it.
export const reopenBinder = (trip: Trip, stopId: string, parts: ReadonlyMap<string, NeededAcrossLists>): Trip =>
  ({ ...trip, events: [...trip.events, { type: 'reopen', stopId, found: [...fullyFound(trip, parts)] }] });

// The binders finished and not reopened, in the order they were finished.
export function finishedStops(trip: Trip): string[] {
  const done: string[] = [];
  for (const e of trip.events) {
    const at = done.indexOf(e.stopId);
    if (e.type === 'finish' && at === -1) done.push(e.stopId);
    if (e.type === 'reopen' && at !== -1) done.splice(at, 1);
  }
  return done;
}

// The plan as the trip stands: the routing engine's plan with each finish and reopen applied in order.
export function tripPlan(needed: NeededCard[], store: StoreProfile, now: Date, trip: Trip): Plan {
  let plan = buildPlan(needed, store, now);
  const finished = new Set<string>();
  for (const e of trip.events) {
    const found = new Set(e.found);
    if (e.type === 'finish') {
      plan = finishStop(plan, needed, e.stopId, finished, found);
      finished.add(e.stopId);
    } else {
      plan = reopenStop(plan, needed, e.stopId, finished, found);
      finished.delete(e.stopId);
    }
  }
  return plan;
}

// A binder's name, even after it has left the plan because it was finished.
export function stopLabel(plan: Plan, stopId: string): string | undefined {
  for (const route of plan.routes.values()) {
    if (route.status !== 'routed') continue;
    const hit = route.ranked.find(r => r.stop.id === stopId);
    if (hit) return hit.stop.label;
  }
  return undefined;
}

export interface TripSummary {
  foundCopies: number;
  searched: number;             // places finished, plus places not finished that still hold something found
  stops: number;                // every binder that ever held a card this trip
  left: { cardKey: string; name: string; copies: number }[];   // copies still wanted, in list order
  leftCopies: number;
}

export function tripSummary(trip: Trip, plan: Plan, parts: ReadonlyMap<string, NeededAcrossLists>): TripSummary {
  let found = 0;
  const left: TripSummary['left'] = [];
  const offTheHunt = new Set(plan.skipped);   // basic lands, while they are off the hunt
  for (const part of parts.values()) {
    if (offTheHunt.has(part.cardKey)) continue;
    found += foundCopies(trip, part);
    const remaining = remainingCopies(trip, part);
    if (remaining > 0) left.push({ cardKey: part.cardKey, name: part.name, copies: remaining });
  }
  // A place counts once the player has been through it: finished, or at least one card found there.
  const visited = new Set(finishedStops(trip));
  for (const stop of plan.stops) {
    // A card that has already left a place unfound was found (if at all) in the place it left, not in this one.
    const foundHere = (key: string) => { const part = parts.get(key); return part !== undefined && foundCopies(trip, part) > 0 && !(plan.left.get(key)?.length); };
    if (stop.cards.some(c => foundHere(c.key))) visited.add(stop.stop.id);
  }
  return { foundCopies: found, searched: visited.size, stops: plan.order.length, left, leftCopies: left.reduce((n, l) => n + l.copies, 0) };
}

// TCGplayer Mass Entry reads one "quantity name" line per card.
export const massEntryText = (left: readonly { name: string; copies: number }[]): string => left.map(l => `${l.copies} ${l.name}`).join('\n');
