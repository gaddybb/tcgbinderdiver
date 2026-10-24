// How the nightly refresh treats a failure (docs/MULTI-GAME.md, section 6). Pure: the build itself is passed in. Uses `.ts` import
// extensions so the card data build script can run it in Node.
import type { GameDefinition, GameId } from './types.ts';

export interface BuildFailure { game: GameId; message: string }

export interface BuildOutcome {
  built: GameId[];
  failures: BuildFailure[];
  stop: boolean;   // the required game failed: do not deploy
}

// Builds each game in turn. One game failing does not stop the others (it keeps the last good build in its folder, which the
// workflow restores before the build), and only the required game, Magic, failing says to stop the deploy.
export async function buildAll(games: readonly GameDefinition[], build: (game: GameDefinition) => Promise<void>, required: GameId): Promise<BuildOutcome> {
  const built: GameId[] = [];
  const failures: BuildFailure[] = [];
  for (const game of games) {
    try {
      await build(game);
      built.push(game.id);
    } catch (error) {
      failures.push({ game: game.id, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return { built, failures, stop: failures.some(f => f.game === required) };
}
