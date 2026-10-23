// Names and shape of the manifest. The build script supplies hashes and times (this module reads no clock).
import { MAGIC } from '../games/magic.ts';
import type { GameDefinition } from '../games/types.ts';
import { FORMAT_VERSION, type Manifest } from './types.ts';

export const MANIFEST_FILE = 'manifest.json';

export type DataFileKind = 'cards' | 'prices';

// "cards.3fa9c01b2d.json": the hash changes whenever the content does, so the files can be cached forever.
export function dataFileName(kind: DataFileKind, hash: string): string {
  return `${kind}.${hash}.json`;
}

export function buildManifest(input: {
  builtAt: string;
  scryfallUpdatedAt: string;
  counts: Manifest['counts'];
  cardsHash: string;
  pricesHash: string;
  game?: GameDefinition;   // Magic unless the build says otherwise
}): Manifest {
  const game = input.game ?? MAGIC;
  return {
    format: FORMAT_VERSION,
    game: game.id,
    variants: [...game.variants],
    details: [...game.details],
    builtAt: input.builtAt,
    scryfallUpdatedAt: input.scryfallUpdatedAt,
    counts: input.counts,
    files: { cards: dataFileName('cards', input.cardsHash), prices: dataFileName('prices', input.pricesHash) },
  };
}
