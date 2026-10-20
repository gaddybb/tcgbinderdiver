// The game connector seam. The core and the app never import Scryfall (or any game's data source) directly:
// they talk to a GameConnector, so Lorcana and Pokemon can be added later with their own connector.
// Types only: no fetch, no clock reads, so this stays inside src/core.
import type { Printing } from './engine/engine';

export interface CardSummary {
  id: string;             // the source's id for the printing that was returned
  oracleId: string;       // the same for every printing of a card
  name: string;           // the source's spelling, for example "Fire // Ice"
  typeLine: string;
  colors: string[];       // front face
  imageSmall: string | null;
  imageNormal: string | null;
  sourceUri: string;      // page for the card at the data source
  printingsUri: string;   // where every printing of the card is listed
  // Set when the card came from the local catalog: the time of that data (prices included). Such a card is read from
  // the catalog each time rather than saved, so it is never older than the catalog.
  dataTime?: string;
}

export interface SetInfo {
  code: string;           // lowercase
  name: string;
  releasedAt: string | null;
  setType: string;
  digital: boolean;       // online-only sets have no paper printings, so screens can leave them out
}

export interface FoundName { requested: string; card: CardSummary; }

export interface NameLookup {
  found: FoundName[];
  notFound: string[];     // requested names, as given
}

export interface LookupOptions {
  signal?: AbortSignal;
  // Called after each batch, so progress can be shown and saved. A later failure keeps what was already reported.
  onBatch?: (batch: NameLookup) => void | Promise<void>;
}

export type FuzzyResult =
  | { status: 'match'; card: CardSummary }
  | { status: 'ambiguous'; candidates: CardSummary[] }   // several cards match: the player picks
  | { status: 'none' };

export interface GameConnector {
  readonly game: string;
  // Exact names for many cards at once, in as few requests as the source allows.
  lookupNames(names: string[], options?: LookupOptions): Promise<NameLookup>;
  // Typo-tolerant lookup for one name that was not found exactly.
  fuzzy(name: string, signal?: AbortSignal): Promise<FuzzyResult>;
  // Card names that start like the query, for the "not found" autocomplete.
  autocomplete(query: string, signal?: AbortSignal): Promise<string[]>;
  // Every paper printing of a card, with a price per finish.
  printings(card: CardSummary, signal?: AbortSignal): Promise<Printing[]>;
  // Sets with release dates, cached by the connector.
  sets(now: Date): Promise<SetInfo[]>;
  // Store order: the category a card is filed under, and the order of categories (Magic: color).
  readonly sortOrder: readonly string[];
  sortCategory(card: CardSummary): string;
  // Card names by fingerprint, for the compact phone link. Only a connector with the whole card catalog on the device has it;
  // null (or no method) means the link has to carry names.
  fingerprintIndex?(): Promise<ReadonlyMap<number, string> | null>;
}
