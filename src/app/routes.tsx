import type { ComponentType } from 'react';
import { BinderGroups } from './screens/dive/BinderGroups';
import { DivePlan } from './screens/dive/DivePlan';
import { StoreDive } from './screens/dive/StoreDive';
import { TripSummary } from './screens/dive/TripSummary';
import { Home } from './screens/Home';
import { ImportFlow } from './screens/import/ImportFlow';
import { Kit } from './screens/Kit';
import { ListReview } from './screens/ListReview';
import { MyLists } from './screens/MyLists';
import { NotFound } from './screens/NotFound';

export type Params = Record<string, string>;
export type Screen = ComponentType<{ params: Params }>;

// The paths the app knows. A ":name" part matches anything and is passed to the screen as a param.
const ROUTES: readonly { pattern: string; screen: Screen }[] = [
  { pattern: '/', screen: Home },
  { pattern: '/kit', screen: Kit },
  { pattern: '/lists', screen: MyLists },
  { pattern: '/import', screen: ImportFlow },
  { pattern: '/plan', screen: DivePlan },
  { pattern: '/groups', screen: BinderGroups },
  { pattern: '/dive', screen: StoreDive },
  { pattern: '/trip', screen: TripSummary },
  { pattern: '/lists/:id', screen: ListReview },
];

const segments = (path: string): string[] => path.split('/').filter(Boolean);

export function matchRoute(path: string): { screen: Screen; params: Params } {
  const parts = segments(path);
  for (const route of ROUTES) {
    const pattern = segments(route.pattern);
    if (pattern.length !== parts.length) continue;
    const params: Params = {};
    const matches = pattern.every((p, i) => {
      if (!p.startsWith(':')) return p === parts[i];
      try { params[p.slice(1)] = decodeURIComponent(parts[i]); } catch { return false; }
      return true;
    });
    if (matches) return { screen: route.screen, params };
  }
  return { screen: NotFound, params: {} };
}
