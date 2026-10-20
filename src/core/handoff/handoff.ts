// The hand-off from one device to another, until accounts exist: the lists in a dive (and the binder groups) travel inside a
// link, so no account and no server are needed. Pure: this builds and checks the data; turning it into a link is in the app.
import { DEFAULT_PULL_SETTINGS } from '../engine/engine';
import type { BinderGroup } from '../engine/engine';
import { MAX_CARDS_PER_LIST, MAX_LISTS } from '../lists/limits';
import type { CardList, IncomingEntry, ListKind, PrintRef } from '../lists';
import { nameKey } from '../parse/parseDecklist';
import type { StoreSettings } from '../store';

export interface HandoffList {
  name: string;
  kind: ListKind;
  entries: { name: string; quantity: number; lock?: PrintRef }[];   // only the cards still needed: that is all a dive uses; lock: the one version to look for
}

export interface Handoff {
  lists: HandoffList[];
  settings?: StoreSettings;
}

// The lists that are on for the next dive and have something to find, with their binder groups. A sample deck goes too: it
// is a real list to whoever is trying the app, and the phone gets it as an ordinary one.
export function buildHandoff(lists: readonly CardList[], settings: StoreSettings): Handoff {
  return {
    lists: lists
      .filter(l => l.inNextDive)
      .map(l => ({ name: l.name, kind: l.kind, entries: l.entries.filter(e => e.status === 'needed').map(e => ({ name: e.name, quantity: e.quantity, ...(e.locked && e.print ? { lock: e.print } : {}) })) }))
      .filter(l => l.entries.length > 0),
    settings,
  };
}

// The compact form that goes in the link: arrays instead of named fields, to keep it short.
export function toWire(handoff: Handoff): string {
  const s = handoff.settings;
  return JSON.stringify({
    v: 1,
    l: handoff.lists.map(l => [l.name, l.kind === 'wishlist' ? 1 : 0, l.entries.map(e => (e.lock ? [e.name, e.quantity, e.lock.setCode, e.lock.collectorNumber] : [e.name, e.quantity]))]),
    ...(s ? { s: [s.binderGroups.map(g => [g.id, g.name, g.setCodes]), s.notCarried, s.includeBasicLands ? 1 : 0, s.pull.worthPullMinCards, s.pull.worthPullMinUsd, s.combinedCommander ? 1 : 0] } : {}),
  });
}

const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200;
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 99;
const isCodes = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 500 && v.every(c => typeof c === 'string' && /^[a-z0-9]{2,10}$/i.test(c));

// Reads what toWire wrote. Anything that is not exactly that shape, or is over the app's limits, gives null: a link is
// from outside, so nothing in it is trusted.
export function fromWire(text: string): Handoff | null {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  const o = raw as { v?: unknown; l?: unknown; s?: unknown } | null;
  if (typeof o !== 'object' || o === null || o.v !== 1 || !Array.isArray(o.l) || o.l.length === 0 || o.l.length > MAX_LISTS) return null;

  const lists: HandoffList[] = [];
  for (const item of o.l as unknown[]) {
    if (!Array.isArray(item) || item.length !== 3) return null;
    const [name, kind, entries] = item as [unknown, unknown, unknown];
    if (!isText(name) || (kind !== 0 && kind !== 1) || !Array.isArray(entries) || entries.length > MAX_CARDS_PER_LIST) return null;
    const cleaned: HandoffList['entries'] = [];
    for (const e of entries as unknown[]) {
      if (!Array.isArray(e) || (e.length !== 2 && e.length !== 4) || !isText(e[0]) || !isCount(e[1])) return null;
      if (e.length === 4) {
        if (!isCodes([e[2]]) || !isText(e[3]) || (e[3] as string).length > 20) return null;
        cleaned.push({ name: e[0], quantity: e[1], lock: { setCode: (e[2] as string).toLowerCase(), collectorNumber: e[3] as string } });
      } else cleaned.push({ name: e[0], quantity: e[1] });
    }
    lists.push({ name, kind: kind === 1 ? 'wishlist' : 'deck', entries: cleaned });
  }

  if (o.s === undefined) return { lists };
  const s = o.s as unknown[];
  if (!Array.isArray(s) || (s.length !== 5 && s.length !== 6)) return null;   // 5: a link made before the Commander switch
  const [groups, notCarried, basics, minCards, minUsd, commander] = s;
  if (commander !== undefined && commander !== 0 && commander !== 1) return null;
  if (!Array.isArray(groups) || groups.length > 100 || !isCodes(notCarried) || (basics !== 0 && basics !== 1)) return null;
  if (typeof minCards !== 'number' || typeof minUsd !== 'number' || !Number.isFinite(minCards) || !Number.isFinite(minUsd)) return null;
  const binderGroups: BinderGroup[] = [];
  for (const g of groups as unknown[]) {
    if (!Array.isArray(g) || g.length !== 3 || !isText(g[0]) || !isText(g[1]) || !isCodes(g[2])) return null;
    binderGroups.push({ id: g[0], name: g[1], setCodes: g[2].map(c => c.toLowerCase()) });
  }
  return {
    lists,
    settings: {
      binderGroups, notCarried: notCarried.map(c => c.toLowerCase()), includeBasicLands: basics === 1, combinedCommander: commander === 1,
      pull: {
        worthPullMinCards: Math.min(99, Math.max(1, Math.round(minCards))) || DEFAULT_PULL_SETTINGS.worthPullMinCards,
        worthPullMinUsd: Math.min(999, Math.max(0, Math.round(minUsd))),
      },
    },
  };
}

export const handoffCards = (handoff: Handoff): number => handoff.lists.reduce((n, l) => n + l.entries.length, 0);

export const toIncoming = (list: HandoffList): IncomingEntry[] => list.entries.map(e => ({ cardKey: nameKey(e.name), name: e.name, quantity: e.quantity, ...(e.lock ? { print: e.lock, locked: true } : {}) }));
