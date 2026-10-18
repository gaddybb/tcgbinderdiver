// The label on a plan stop. It is a label, never a button, and it never changes where a card is routed.
// Flip stops (set binders, Commander box): "Worth a pull" at N or more copies OR at least $X, else "Buy online".
// Counter stops (Display case, Ask an associate, Value binders): always "Show staff".
import type { PlanStop, PullSettings, PullVerdict } from './types';
import { DEFAULT_PULL_SETTINGS } from './pullSettings';

export function pullVerdict(stop: PlanStop, settings: PullSettings = DEFAULT_PULL_SETTINGS): PullVerdict {
  const kind = stop.stop.kind;
  if (kind !== 'set_binder' && kind !== 'commander_box') return 'show_staff';
  return stop.copies >= settings.worthPullMinCards || stop.value >= settings.worthPullMinUsd ? 'worth_a_pull' : 'buy_online';
}
