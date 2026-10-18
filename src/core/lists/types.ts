import type { CardStatus } from '../status';

// A card is one line of a list; its quantity says how many copies. Counts shown to players are counts of lines.
export interface ListEntry {
  cardKey: string;      // identifies the card across lists (the oracle id once looked up)
  name: string;         // the source's spelling
  quantity: number;     // copies wanted, at least 1
  status: CardStatus;
  tags: string[];
}

export type ListKind = 'deck' | 'wishlist';

export interface CardList {
  id: string;
  kind: ListKind;
  name: string;
  entries: ListEntry[];
  inNextDive: boolean;
  createdAt: string;    // ISO
  updatedAt: string;    // ISO; changes when the contents or name change, not when the dive switch moves
}

// What a player pastes in: one line per card, after sections and duplicates are settled.
export interface IncomingEntry {
  cardKey: string;
  name: string;
  quantity: number;
  tags?: string[];
  status?: CardStatus;
}
