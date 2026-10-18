// Pull settings: when a flip stop is worth walking to. They label stops and never route cards.
// Starting values from reference/engine/routing-engine-spec.md: worth a pull at 2+ copies or $10+.
import type { PullSettings } from './types';

export const DEFAULT_PULL_SETTINGS: PullSettings = { worthPullMinCards: 2, worthPullMinUsd: 10 };
