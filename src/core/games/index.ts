import { MAGIC } from './magic.ts';
import type { GameDefinition, GameId } from './types.ts';

export type { GameDefinition, GameId } from './types.ts';
export { MAGIC } from './magic.ts';

// Every game the app knows about. A game is added here when its definition exists; it is choosable once it is live.
export const GAMES: Readonly<Record<'magic', GameDefinition>> = { magic: MAGIC };
export const DEFAULT_GAME: GameId = 'magic';

// Every game id the app has a name for, live or not (a hand-off link or a saved choice may carry any of them).
export const GAME_IDS: readonly GameId[] = ['magic', 'pokemon', 'lorcana', 'yugioh'];
export const isGameId = (v: unknown): v is GameId => GAME_IDS.includes(v as GameId);
export const isLiveGame = (v: unknown): v is GameId => isGameId(v) && (GAMES as Readonly<Partial<Record<GameId, GameDefinition>>>)[v]?.live === true;
