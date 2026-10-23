import { MAGIC } from './magic.ts';
import type { GameDefinition, GameId } from './types.ts';

export type { GameDefinition, GameId } from './types.ts';
export { MAGIC } from './magic.ts';

// Every game the app knows about. A game is added here when its definition exists; it is choosable once it is live.
export const GAMES: Readonly<Record<'magic', GameDefinition>> = { magic: MAGIC };
export const DEFAULT_GAME: GameId = 'magic';
