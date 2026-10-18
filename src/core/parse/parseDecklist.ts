// Decklist parser for pasted Moxfield, Archidekt, EDHREC, MTGO and plain text lists. Pure: text in, entries out.
// Takes the count and name from each line and drops set codes, collector numbers, foil tags and #tags.
// Behavior follows the legacy sheet's cfParseLine_ (reference/legacy-sheet) and v1-scope-and-decisions.md.

export type Section = 'main' | 'sideboard' | 'maybeboard';

export interface ParsedEntry {
  name: string;
  quantity: number;
  section: Section;
  tags: string[];
}

export interface ParseResult {
  entries: ParsedEntry[];
  // Copies per section, so the import screen can offer a toggle only when a section exists.
  sectionCounts: Record<Section, number>;
  // Non-blank lines that were neither a header nor a card (for example a count of 0).
  skippedLines: number;
}

export interface IncludeSections { sideboard: boolean; maybeboard: boolean; }

export interface CombinedEntry {
  key: string;
  name: string;
  quantity: number;
  tags: string[];
}

const SIDEBOARD_HEADERS = new Set(['sideboard', 'side board', 'side', 'sb']);
const MAYBEBOARD_HEADERS = new Set(['maybeboard', 'maybe board', 'maybe', 'considering']);
const MAIN_HEADERS = new Set(['deck', 'main', 'main deck', 'mainboard', 'main board', 'commander', 'commanders', 'companion']);

const COUNT_PREFIX = /^(\d{1,3})\s*x?\s+(.+)$/i;
const HAS_COUNT = /^\d{1,3}\s*x?\s+\S/i;

// A section header, a comment or a category title ("Creatures (12)"). Returns the section it switches to,
// 'ignore' for a header that changes nothing, or null when the line is not a header at all.
function headerKind(line: string): Section | 'ignore' | null {
  if (HAS_COUNT.test(line)) return null;
  const bare = line
    .replace(/^(\/\/+|#+|\*+)\s*/, '')
    .replace(/\*+$/, '')
    .replace(/\s*:\s*$/, '')
    .replace(/\s*[([]\d+[)\]]\s*$/, '')
    .trim()
    .toLowerCase();
  if (SIDEBOARD_HEADERS.has(bare)) return 'sideboard';
  if (MAYBEBOARD_HEADERS.has(bare)) return 'maybeboard';
  if (MAIN_HEADERS.has(bare)) return 'main';
  if (/^(\/\/|#)/.test(line)) return 'ignore';
  if (/:$/.test(line) || /^[^()[\]]+\s[([]\d+[)\]]$/.test(line)) return 'ignore';
  return null;
}

// Strip trailing noise, repeatedly, so any order of foil flag, tag group and set code comes off.
function stripSuffixes(name: string): string {
  let s = name;
  for (let i = 0; i < 4; i++) {
    const before = s;
    s = s
      .replace(/\s+\*[A-Za-z]+\*\s*$/, '')                                          // *F* or *E*
      .replace(/\s+\^[^^]*\^\s*$/, '')                                               // Archidekt ^Have,#37d67a^
      .replace(/\s+\[[^\]]*\]\s*$/, '')                                              // Archidekt [Ramp{top}]
      .replace(/\s+\([A-Za-z0-9]{2,6}\)(\s+[A-Za-z]{0,3}[★†]?\d+[A-Za-z★†]*)?\s*$/, '') // (CMM) 400
      .trim();
    if (s === before) break;
  }
  return s;
}

export function parseDecklist(text: string): ParseResult {
  const entries: ParsedEntry[] = [];
  const sectionCounts: Record<Section, number> = { main: 0, sideboard: 0, maybeboard: 0 };
  let skippedLines = 0;
  let section: Section = 'main';

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/[\u200b\ufeff]/g, '').replace(/\s+/g, ' ').trim().normalize('NFC');
    if (!line) continue;

    const header = headerKind(line);
    if (header) {
      if (header !== 'ignore') section = header;
      continue;
    }

    let lineSection = section;
    let rest = line;
    const sbPrefix = rest.match(/^SB:\s*(.+)$/i);   // MTGO style "SB: 2 Negate"
    if (sbPrefix) { lineSection = 'sideboard'; rest = sbPrefix[1]; }

    let quantity = 1;
    const counted = rest.match(COUNT_PREFIX);
    if (counted) { quantity = Number(counted[1]); rest = counted[2]; }
    if (quantity < 1) { skippedLines++; continue; }

    const tags: string[] = [];
    rest = rest.replace(/\s+#\S.*$/, (tail) => {
      for (const t of tail.match(/#[^\s#]+/g) ?? []) tags.push(t.slice(1).replace(/^!/, ''));
      return '';
    });
    const name = stripSuffixes(rest);
    if (!name) { skippedLines++; continue; }

    entries.push({ name, quantity, section: lineSection, tags });
    sectionCounts[lineSection] += quantity;
  }
  return { entries, sectionCounts, skippedLines };
}

// Case, accents and apostrophe style do not make a different card.
export function nameKey(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
}

// Keep the sections the player turned on and combine duplicate lines into one entry with a total quantity.
// The first spelling wins. Tags are merged without repeats. Order is first appearance.
export function combineEntries(entries: ParsedEntry[], include: IncludeSections): CombinedEntry[] {
  const byKey = new Map<string, CombinedEntry>();
  for (const e of entries) {
    if (e.section === 'sideboard' && !include.sideboard) continue;
    if (e.section === 'maybeboard' && !include.maybeboard) continue;
    const key = nameKey(e.name);
    const cur = byKey.get(key);
    if (cur) {
      cur.quantity += e.quantity;
      for (const t of e.tags) if (!cur.tags.includes(t)) cur.tags.push(t);
    } else {
      byKey.set(key, { key, name: e.name, quantity: e.quantity, tags: [...e.tags] });
    }
  }
  return [...byKey.values()];
}
