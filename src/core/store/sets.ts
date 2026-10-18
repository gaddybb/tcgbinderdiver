// The sets the player's needed cards are printed in, for the binder groups editor. Pure.
import type { Printing } from '../engine/engine';

export interface SetUsage {
  code: string;         // lowercase
  name: string;
  setType: string;
  neededCards: number;  // needed cards with a printing in this set
}

interface HasPrintings { printings: readonly Printing[] }

// Every paper set any needed card was printed in, with how many needed cards could be found there. Most cards first.
export function setsUsed(cards: readonly HasPrintings[]): SetUsage[] {
  const bySet = new Map<string, SetUsage>();
  for (const card of cards) {
    const seen = new Set<string>();
    for (const p of card.printings) {
      if (p.digital) continue;
      const code = p.setCode.toLowerCase();
      if (seen.has(code)) continue;
      seen.add(code);
      const usage = bySet.get(code);
      if (usage) usage.neededCards++;
      else bySet.set(code, { code, name: p.setName, setType: p.setType, neededCards: 1 });
    }
  }
  return [...bySet.values()].sort((a, b) => b.neededCards - a.neededCards || a.name.localeCompare(b.name));
}

// How many needed cards a binder (a group of sets) could hold: cards counted once, however many of its sets they are in.
export function cardsInSets(cards: readonly HasPrintings[], setCodes: readonly string[]): number {
  const codes = new Set(setCodes.map(c => c.toLowerCase()));
  if (codes.size === 0) return 0;
  return cards.filter(card => card.printings.some(p => !p.digital && codes.has(p.setCode.toLowerCase()))).length;
}

export const commanderSets = (usage: readonly SetUsage[]): SetUsage[] => usage.filter(u => u.setType === 'commander');

export const setTypes = (usage: readonly SetUsage[]): string[] => [...new Set(usage.map(u => u.setType))].sort();
