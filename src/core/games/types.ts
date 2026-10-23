// What the app knows about a game (docs/MULTI-GAME.md). Pure data with no imports, so the card data build script can run it in Node.
// Fields arrive as the steps of the design need them: this step has the ones the card data files already depend on.

export type GameId = 'magic' | 'pokemon' | 'lorcana' | 'yugioh';

export interface GameDefinition {
  id: GameId;
  live: boolean;                  // false: shown as "coming", not choosable
  dataBase: string;               // where the game's card data files are served, with a trailing slash
  variants: readonly string[];    // what each price slot and finish bit means, in order (bit i is 1 << i)
  details: readonly string[];     // what each column of the data's details table is
}
