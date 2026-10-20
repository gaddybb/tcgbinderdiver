// Steps 2 and 3 of the import: what the card lookup found for each pasted line, and the player's fixes. Pure: the screen
// does the lookups through the connector and hands the answers in.
import type { CardSummary, FoundName, FuzzyResult } from '../connector';
import type { CombinedEntry, PrintRef } from '../parse/parseDecklist';
import { nameKey } from '../parse/parseDecklist';

// exact: the name matched a card. fixed: not exact, but one clear match (a spelling was fixed for the player, with Undo).
// chosen: the player picked it. pick: several cards match, the player must choose. missing: nothing matched.
export type LineState = 'exact' | 'fixed' | 'chosen' | 'pick' | 'missing';

export interface ImportLine {
  key: string;                  // nameKey of the pasted name; stable while the player edits
  requested: string;            // the name as pasted
  quantity: number;
  tags: string[];
  print?: PrintRef;             // the printing the pasted line named
  state: LineState;
  card?: CardSummary;           // for exact, fixed and chosen
  candidates?: CardSummary[];   // for pick
}

// Builds one line per pasted entry from the exact lookup and the fuzzy answers for the names that were not found.
// `fuzzy` is keyed by the requested name; a name with no answer counts as missing.
export function resolveLines(entries: readonly CombinedEntry[], found: readonly FoundName[], fuzzy: ReadonlyMap<string, FuzzyResult>): ImportLine[] {
  const exact = new Map(found.map(f => [f.requested, f.card]));
  return entries.map((e): ImportLine => {
    const base = { key: e.key, requested: e.name, quantity: e.quantity, tags: e.tags, ...(e.print ? { print: e.print } : {}) };
    const card = exact.get(e.name);
    if (card) return { ...base, state: 'exact', card };
    const guess = fuzzy.get(e.name);
    if (guess?.status === 'match') return { ...base, state: 'fixed', card: guess.card };
    if (guess?.status === 'ambiguous' && guess.candidates.length > 0) return { ...base, state: 'pick', candidates: guess.candidates };
    return { ...base, state: 'missing' };
  });
}

const replace = (lines: readonly ImportLine[], key: string, change: (line: ImportLine) => ImportLine): ImportLine[] =>
  lines.map(l => (l.key === key ? change(l) : l));

// The player picked one of the matches for a name that matched several.
export function pickCandidate(lines: readonly ImportLine[], key: string, cardId: string): ImportLine[] {
  return replace(lines, key, l => {
    const card = l.candidates?.find(c => c.id === cardId);
    return card ? { ...l, state: 'chosen', card } : l;   // the candidates stay, so the player can change their mind
  });
}

// The player typed and chose a card for a name that was not found.
export function chooseCard(lines: readonly ImportLine[], key: string, card: CardSummary): ImportLine[] {
  return replace(lines, key, l => ({ key: l.key, requested: l.requested, quantity: l.quantity, tags: l.tags, state: 'chosen', card }));
}

// Undo on a spelling that was fixed, or on a card typed in for a name that was not found: back to the pasted name, which
// needs the player's help. (A pick among several matches is changed by picking again.)
export function undoFix(lines: readonly ImportLine[], key: string): ImportLine[] {
  return replace(lines, key, l => (l.state === 'fixed' || (l.state === 'chosen' && !l.candidates)
    ? { key: l.key, requested: l.requested, quantity: l.quantity, tags: l.tags, state: 'missing' }
    : l));
}

// "Remove from list" and skipping a name: it is left out.
export const removeLine = (lines: readonly ImportLine[], key: string): ImportLine[] => lines.filter(l => l.key !== key);

export interface ResolutionCounts { exact: number; fixed: number; chosen: number; pick: number; missing: number }

export function resolutionCounts(lines: readonly ImportLine[]): ResolutionCounts {
  const counts: ResolutionCounts = { exact: 0, fixed: 0, chosen: 0, pick: 0, missing: 0 };
  for (const l of lines) counts[l.state]++;
  return counts;
}

// Step 3 has nothing to show when every name matched.
export const needsFixing = (lines: readonly ImportLine[]): boolean => lines.some(l => l.state === 'fixed' || l.state === 'pick' || l.state === 'missing');

// The parser reads any line as a card name, so a paste of plain sentences is only discovered here: no name found a card.
export const noneMatched = (lines: readonly ImportLine[]): boolean => lines.length > 0 && lines.every(l => !l.card && l.state !== 'pick');

// One card of the finished import. Two pasted names that turn out to be one card ("Fire" and "Fire // Ice") become one entry.
export interface ResolvedEntry {
  cardKey: string;
  name: string;               // the source's spelling
  quantity: number;
  tags: string[];
  print?: PrintRef;
  card: CardSummary;
}

// What goes on the list: lines that still have no card (unpicked, not found) are left out, as step 3 says.
export function resolvedEntries(lines: readonly ImportLine[]): ResolvedEntry[] {
  const byKey = new Map<string, ResolvedEntry>();
  for (const l of lines) {
    if (!l.card) continue;
    const cardKey = nameKey(l.card.name);
    const seen = byKey.get(cardKey);
    if (seen) {
      seen.quantity += l.quantity;
      for (const t of l.tags) if (!seen.tags.includes(t)) seen.tags.push(t);
      if (!seen.print && l.print) seen.print = l.print;
    } else {
      byKey.set(cardKey, { cardKey, name: l.card.name, quantity: l.quantity, tags: [...l.tags], card: l.card, ...(l.print ? { print: l.print } : {}) });
    }
  }
  return [...byKey.values()];
}
