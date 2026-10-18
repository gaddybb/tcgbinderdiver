// Per-card status on a list. Only Needed counts toward a dive (see reference/product/v1-scope-and-decisions.md).
export const CARD_STATUSES = ['needed', 'in_collection', 'ordered', 'proxy', 'out_of_deck'] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];
