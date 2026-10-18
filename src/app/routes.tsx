import type { ComponentType } from 'react';
import { Home } from './screens/Home';
import { Kit } from './screens/Kit';
import { ListView } from './screens/ListView';
import { MyLists } from './screens/MyLists';
import { NotFound } from './screens/NotFound';

export type Params = Record<string, string>;
export type Screen = ComponentType<{ params: Params }>;

// The paths the app knows. A ":name" part matches anything and is passed to the screen as a param.
const ROUTES: readonly { pattern: string; screen: Screen }[] = [
  { pattern: '/', screen: Home },
  { pattern: '/kit', screen: Kit },
  { pattern: '/lists', screen: MyLists },
  { pattern: '/lists/:id', screen: ListView },
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
