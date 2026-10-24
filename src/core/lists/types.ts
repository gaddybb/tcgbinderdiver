import type { PrintRef } from '../parse/parseDecklist';
import type { GameId } from '../games';
import type { CardStatus } from '../status';

export type { PrintRef };

// A card is one line of a list; its quantity says how many copies. Counts shown to players are counts of lines.
export interface ListEntry {
  cardKey: string;      // identifies the card across lists (the oracle id once looked up)
  name: string;         // the source's spelling
  quantity: number;     // copies wanted, at least 1
  status: CardStatus;
  tags: string[];
  listed?: PrintRef;    // the printing the pasted line named, kept as information; it does not change where to look
  print?: PrintRef;     // the version the player chose for this card
  locked?: boolean;     // look only for that version; unlocked, the choice is remembered but any version will do
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
  banner?: string;      // the name of a card whose art heads the list; without it, the first card is used
  game?: GameId;        // absent means Magic: only other games' lists say so
  sample?: boolean;     // a sample deck the player is trying out: removed when they paste their own list or try another
}

// What a player pastes in: one line per card, after sections and duplicates are settled.
export interface IncomingEntry {
  cardKey: string;
  name: string;
  quantity: number;
  tags?: string[];
  status?: CardStatus;
  listed?: PrintRef;
  print?: PrintRef;
  locked?: boolean;
}
