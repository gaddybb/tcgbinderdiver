import { artKind } from '../core/cards';
import type { Printing } from '../core/engine/engine';
import { copy } from './copy/en';

// "FDN 141", or "FDN 298 · Borderless" when the print looks different from the usual one, so a special-art card is never
// mistaken for the ordinary one.
export function printingLabel(p: Printing): string {
  const base = `${p.setCode.toUpperCase()} ${p.collectorNumber}`;
  const kind = artKind(p);
  return kind ? `${base} · ${copy.art[kind]}` : base;
}
