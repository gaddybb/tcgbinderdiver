// The store-sort categories (the same words the Scryfall connector files cards under) and their colour edges.
import edges from './Edge.module.css';

export const COLOR_CATEGORIES = ['White', 'Blue', 'Black', 'Red', 'Green', 'Multicolor', 'Colorless', 'Land'] as const;
export type ColorCategory = (typeof COLOR_CATEGORIES)[number];

// Each class sets --edge to that category's colour token.
export const edgeClass: Record<ColorCategory, string> = {
  White: edges.white,
  Blue: edges.blue,
  Black: edges.black,
  Red: edges.red,
  Green: edges.green,
  Multicolor: edges.multicolor,
  Colorless: edges.colorless,
  Land: edges.land,
};

export function isColorCategory(value: string): value is ColorCategory {
  return (COLOR_CATEGORIES as readonly string[]).includes(value);
}
