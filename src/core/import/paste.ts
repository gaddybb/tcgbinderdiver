// Step 1 of the import: what the pasted text contains, before anything is looked up. Pure.
import { combineEntries, nameKey, parseDecklist } from '../parse/parseDecklist';
import type { CombinedEntry, IncludeSections, Section } from '../parse/parseDecklist';

// A card that was listed more than once and became one entry ("Cultivate was listed twice ... a quantity of 2").
export interface CombinedNote { name: string; times: number; quantity: number }

export type PasteCheck =
  | { status: 'empty' }                                     // nothing but blanks
  | { status: 'no_names' }                                  // text, but no line looks like a card
  | { status: 'nothing_included'; sections: Record<Section, number> }   // cards only in a section that is switched off
  | {
      status: 'ready';
      entries: CombinedEntry[];                             // one per card, first-appearance order
      sections: Record<Section, number>;                    // copies in each section, to offer a toggle only where one exists
      combined: CombinedNote[];
      skippedLines: number;
    };

export function checkPaste(text: string, include: IncludeSections): PasteCheck {
  if (text.trim() === '') return { status: 'empty' };
  const parsed = parseDecklist(text);
  if (parsed.entries.length === 0) return { status: 'no_names' };

  const entries = combineEntries(parsed.entries, include);
  if (entries.length === 0) return { status: 'nothing_included', sections: parsed.sectionCounts };

  const lines = new Map<string, { name: string; times: number; quantity: number }>();
  for (const e of parsed.entries) {
    if (e.section === 'sideboard' && !include.sideboard) continue;
    if (e.section === 'maybeboard' && !include.maybeboard) continue;
    const key = nameKey(e.name);
    const seen = lines.get(key);
    if (seen) { seen.times++; seen.quantity += e.quantity; } else lines.set(key, { name: e.name, times: 1, quantity: e.quantity });
  }
  const combined = [...lines.values()].filter(l => l.times > 1);
  return { status: 'ready', entries, sections: parsed.sectionCounts, combined, skippedLines: parsed.skippedLines };
}
