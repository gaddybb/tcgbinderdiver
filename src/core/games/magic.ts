import type { GameDefinition } from './types.ts';

// Magic, exactly as the card data is built and read today (format 1).
export const MAGIC: GameDefinition = {
  id: 'magic',
  live: true,
  dataBase: '/data/magic/',
  variants: ['nonfoil', 'foil', 'etched'],
  details: ['borderColor', 'promoTypes', 'frameEffects', 'games'],
};
