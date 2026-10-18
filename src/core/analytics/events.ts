// The analytics events (reference/product/v1-scope-and-decisions.md), and a check that nothing but counts and labels can
// ever be sent: never a card name, a list name or the contents of a list. Pure.
export const EVENTS = ['list_pasted', 'plan_viewed', 'stop_finished', 'card_found', 'buy_rest_tapped'] as const;
export type AnalyticsEvent = (typeof EVENTS)[number];

export type EventParams = Record<string, string | number | boolean>;

// Which details each event may carry. Anything else is dropped.
const ALLOWED: Record<AnalyticsEvent, readonly string[]> = {
  list_pasted: ['cards', 'target'],
  plan_viewed: ['cards', 'stops'],
  stop_finished: ['stop_type', 'found', 'unfound'],
  card_found: ['stop_type'],
  buy_rest_tapped: ['cards'],
};

// A label is one of a few fixed words, so free text such as a card name cannot get through as one.
const LABELS = new Set(['set_binder', 'commander_box', 'value_binder', 'display_case', 'ask_associate', 'deck', 'wishlist']);

export function cleanParams(event: AnalyticsEvent, params: Record<string, unknown>): EventParams {
  const out: EventParams = {};
  for (const key of ALLOWED[event]) {
    const value = params[key];
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = Math.round(value);
    else if (typeof value === 'string' && LABELS.has(value)) out[key] = value;
  }
  return out;
}
