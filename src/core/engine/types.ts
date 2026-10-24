// Engine types. Copied from reference/engine/engine.ts; pure data shapes, no logic.

export type Finish = 'nonfoil' | 'foil' | 'etched';
export type Location = 'set_binder' | 'commander_box' | 'value_binder' | 'display_case' | 'bulk';
export type StopKind = 'set_binder' | 'commander_box' | 'value_binder' | 'display_case' | 'ask_associate';

export interface Printing {
  setCode: string; setName: string; setType: string; releasedAt: string;
  rarity: string; collectorNumber: string; finishes: Finish[];
  prices: { usd: string | null; usd_foil: string | null; usd_etched: string | null };
  promo: boolean; promoTypes: string[]; frameEffects: string[];
  borderColor: string; fullArt: boolean; digital: boolean; games: string[];
}
export interface CardInput { name: string; typeLine: string; printings: Printing[]; }
export interface BinderGroup { id: string; name: string; setCodes: string[]; }
export interface StoreProfile {
  usesDisplayCase: boolean; displayCaseMin: number;
  hasCommanderSection: boolean;
  usesSetBinders: boolean; setBinderMaxAgeYears: number;
  usesValueBinders: boolean; valueBinderMin: number;
  binderGroups: BinderGroup[]; notCarried: string[];
  includeBasicLands: boolean; acceptFinishes: Finish[];
}

// The numbers behind the score of a candidate (see weights.ts for Magic's).
export interface Weights {
  base: Record<Location, number>;
  rarity: Record<string, number>;
  finish: Record<Finish, number>;
  special: number; frame: number; unknownPrice: number; altProduct: number;
  ageFloor: number; ageSpanYears: number; priceFitExp: number; priceFloor: number;
  nearTie: number;
}

// What the engine needs to know about a game (docs/MULTI-GAME.md, section 7). Magic's is MAGIC_RULES, the default everywhere.
export interface GameRules {
  weights: Weights;
  mainSetTypes: ReadonlySet<string>;       // set types that get a binder of their own while recent
  ordinarySetTypes: ReadonlySet<string>;   // set types whose prints look like the card everyone knows
  specialSetTypes: ReadonlySet<string>;    // set types that are special products
  specialSetCodes: ReadonlySet<string>;    // single sets that are special products
  specialFrames: ReadonlySet<string>;      // frame effects that make a print stand out
  commanderSetType: string | null;         // the set type kept in a Commander box; null when the game has none
  stopOrder: Record<StopKind, number>;     // the order stops are walked in
  isBasicLand: (typeLine: string) => boolean;
}

export interface Stop { id: string; kind: StopKind; label: string; releasedAt?: string; }
export interface Candidate {
  printing: Printing; finish: Finish; price: number | null;
  location: Location; stop: Stop; hint?: 'value binders' | 'bulk boxes'; score: number;
}
export interface RankedStop { stop: Stop; score: number; best: Candidate; }
export type CardRoute =
  | { status: 'routed'; ranked: RankedStop[] }
  | { status: 'skipped_basic' }
  | { status: 'no_stop' };

export interface NeededCard { key: string; card: CardInput; copies: number; }
export interface PlanStop { stop: Stop; cards: { key: string; copies: number; candidate: Candidate }[]; copies: number; value: number; }
export interface Plan {
  stops: PlanStop[]; assignment: Map<string, string>; noStop: string[]; skipped: string[]; routes: Map<string, CardRoute>;
  // Every stop that ever held a card, in walking order. Frozen for the trip, so a reopened stop returns to its place.
  order: string[];
  // Per card, the stops it left unfound when they were finished. Reopening a stop brings those cards back.
  left: Map<string, string[]>;
}

export type PullVerdict = 'worth_a_pull' | 'buy_online' | 'show_staff';
export interface PullSettings { worthPullMinCards: number; worthPullMinUsd: number; }
