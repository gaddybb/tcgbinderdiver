import { describe, expect, it } from 'vitest';
import { combineEntries, nameKey, parseDecklist } from './parseDecklist';

const names = (text: string) => parseDecklist(text).entries.map(e => [e.quantity, e.name]);

describe('parseDecklist: counts and names', () => {
  it('reads "1 Sol Ring"', () => {
    expect(names('1 Sol Ring')).toEqual([[1, 'Sol Ring']]);
  });
  it('reads "2x Sol Ring" and "2 x Sol Ring"', () => {
    expect(names('2x Sol Ring')).toEqual([[2, 'Sol Ring']]);
    expect(names('2 x Sol Ring')).toEqual([[2, 'Sol Ring']]);
    expect(names('2X Sol Ring')).toEqual([[2, 'Sol Ring']]);
  });
  it('treats a bare name as one copy', () => {
    expect(names('Sol Ring')).toEqual([[1, 'Sol Ring']]);
  });
  it('does not mistake a name that starts with X for the "x" multiplier', () => {
    expect(names('2 Xenagos, God of Revels')).toEqual([[2, 'Xenagos, God of Revels']]);
  });
  it('keeps a name that starts with digits', () => {
    expect(names('1996 World Champion')).toEqual([[1, '1996 World Champion']]);
  });
  it('keeps split and double-faced names whole', () => {
    expect(names('1 Fire // Ice')).toEqual([[1, 'Fire // Ice']]);
  });
  it('keeps accents and apostrophes', () => {
    expect(names("1 Lim-Dûl's Vault")).toEqual([[1, "Lim-Dûl's Vault"]]);
  });
  it('accepts large counts for basic lands', () => {
    expect(names('24 Island')).toEqual([[24, 'Island']]);
  });
  it('collapses extra spaces and tabs', () => {
    expect(names('  3\t  Sol    Ring  ')).toEqual([[3, 'Sol Ring']]);
  });
  it('handles Windows line endings, a BOM and blank lines', () => {
    expect(names('﻿1 Sol Ring\r\n\r\n2 Arcane Signet\r\n')).toEqual([[1, 'Sol Ring'], [2, 'Arcane Signet']]);
  });
  it('skips a count of 0 and reports it', () => {
    const r = parseDecklist('0 Sol Ring\n1 Arcane Signet');
    expect(r.entries.map(e => e.name)).toEqual(['Arcane Signet']);
    expect(r.skippedLines).toBe(1);
  });
  it('returns nothing for empty or blank text', () => {
    expect(parseDecklist('').entries).toEqual([]);
    expect(parseDecklist('  \n \r\n\t').entries).toEqual([]);
  });
});

describe('parseDecklist: set codes, collector numbers, foil tags and tags', () => {
  it('drops a set code and collector number', () => {
    expect(names('1 Sol Ring (CMM) 400')).toEqual([[1, 'Sol Ring']]);
    expect(names('1 Sol Ring (cmm) 400a')).toEqual([[1, 'Sol Ring']]);
    expect(names('1 Sol Ring (CMM)')).toEqual([[1, 'Sol Ring']]);
  });
  it('drops *F* and *E* foil tags', () => {
    expect(names('1 Sol Ring *F*')).toEqual([[1, 'Sol Ring']]);
    expect(names('1 Sol Ring (CMM) 400 *E*')).toEqual([[1, 'Sol Ring']]);
  });
  it('handles the full example from the scope doc', () => {
    const r = parseDecklist('2x Sol Ring (CMM) 400 *F* #tag');
    expect(r.entries).toEqual([{ name: 'Sol Ring', quantity: 2, section: 'main', tags: ['tag'] }]);
  });
  it('collects Moxfield #tags and drops the ! prefix', () => {
    const r = parseDecklist('1 Sol Ring (CMM) 400 #ramp #!Commander');
    expect(r.entries[0].name).toBe('Sol Ring');
    expect(r.entries[0].tags).toEqual(['ramp', 'Commander']);
  });
  it('drops Archidekt category and colour groups', () => {
    expect(names('1x Sol Ring (cmm) 400 [Ramp{top}] ^Have,#37d67a^')).toEqual([[1, 'Sol Ring']]);
  });
  it('does not strip words that only look like a set code', () => {
    expect(names('1 Wear // Tear')).toEqual([[1, 'Wear // Tear']]);
  });
  it('keeps a parenthesis that is part of the name', () => {
    expect(names('1 B.F.M. (Big Furry Monster)')).toEqual([[1, 'B.F.M. (Big Furry Monster)']]);
  });
});

describe('parseDecklist: headers and sections', () => {
  it('skips headers and category titles', () => {
    const text = 'Commander\n1 Atraxa, Praetors\' Voice\n\nDeck\nCreatures (12)\n2 Sol Ring\nLands:\n// a comment\n## Notes\n1 Island';
    expect(names(text)).toEqual([[1, "Atraxa, Praetors' Voice"], [2, 'Sol Ring'], [1, 'Island']]);
  });
  it('puts cards after a Sideboard header in the sideboard', () => {
    const r = parseDecklist('1 Sol Ring\nSideboard\n2 Negate');
    expect(r.entries.map(e => e.section)).toEqual(['main', 'sideboard']);
    expect(r.sectionCounts).toEqual({ main: 1, sideboard: 2, maybeboard: 0 });
  });
  it('recognizes header spellings: SIDEBOARD:, // Sideboard, Sideboard (15)', () => {
    for (const header of ['SIDEBOARD:', '// Sideboard', 'Sideboard (15)', '## Sideboard', 'SB:']) {
      const r = parseDecklist(`${header}\n1 Negate`);
      expect(r.entries[0].section, header).toBe('sideboard');
    }
  });
  it('puts cards after a Maybeboard header in the maybeboard', () => {
    const r = parseDecklist('1 Sol Ring\nMaybeboard\n1 Mana Drain\nConsidering\n1 Force of Will');
    expect(r.entries.map(e => e.section)).toEqual(['main', 'maybeboard', 'maybeboard']);
  });
  it('reads MTGO style "SB: 2 Negate" for that line only', () => {
    const r = parseDecklist('1 Sol Ring\nSB: 2 Negate\n1 Arcane Signet');
    expect(r.entries.map(e => [e.name, e.section])).toEqual([['Sol Ring', 'main'], ['Negate', 'sideboard'], ['Arcane Signet', 'main']]);
  });
  it('goes back to the main deck on a Deck or Mainboard header', () => {
    const r = parseDecklist('Sideboard\n1 Negate\nMainboard\n1 Sol Ring');
    expect(r.entries.map(e => e.section)).toEqual(['sideboard', 'main']);
  });
  it('does not treat a category title as a section switch', () => {
    const r = parseDecklist('Maybeboard\nCreatures (3)\n1 Mana Drain');
    expect(r.entries[0].section).toBe('maybeboard');
  });
  it('does not mistake a card with a set code for a header', () => {
    expect(names('Sol Ring (CMM)')).toEqual([[1, 'Sol Ring']]);
  });
});

describe('combineEntries', () => {
  it('combines duplicate lines into one entry with a quantity', () => {
    const { entries } = parseDecklist('1 Sol Ring\n2x Sol Ring (CMM) 400 #ramp\n1 sol ring #ramp #staple');
    expect(combineEntries(entries, { sideboard: false, maybeboard: false })).toEqual([
      { key: 'sol ring', name: 'Sol Ring', quantity: 4, tags: ['ramp', 'staple'] },
    ]);
  });
  it('treats accents and curly apostrophes as the same card', () => {
    const { entries } = parseDecklist("1 Lim-Dûl's Vault\n1 Lim-Dul’s Vault");
    const out = combineEntries(entries, { sideboard: false, maybeboard: false });
    expect(out).toHaveLength(1);
    expect(out[0].quantity).toBe(2);
    expect(out[0].name).toBe("Lim-Dûl's Vault");
  });
  it('leaves sideboard and maybeboard out unless turned on', () => {
    const { entries } = parseDecklist('1 Sol Ring\nSideboard\n2 Negate\nMaybeboard\n1 Mana Drain');
    expect(combineEntries(entries, { sideboard: false, maybeboard: false }).map(e => e.name)).toEqual(['Sol Ring']);
    expect(combineEntries(entries, { sideboard: true, maybeboard: false }).map(e => e.name)).toEqual(['Sol Ring', 'Negate']);
    expect(combineEntries(entries, { sideboard: false, maybeboard: true }).map(e => e.name)).toEqual(['Sol Ring', 'Mana Drain']);
    expect(combineEntries(entries, { sideboard: true, maybeboard: true }).map(e => e.name)).toEqual(['Sol Ring', 'Negate', 'Mana Drain']);
  });
  it('adds a sideboard copy to the main copy when both sections are on', () => {
    const { entries } = parseDecklist('1 Negate\nSideboard\n2 Negate');
    expect(combineEntries(entries, { sideboard: true, maybeboard: false })[0].quantity).toBe(3);
    expect(combineEntries(entries, { sideboard: false, maybeboard: false })[0].quantity).toBe(1);
  });
  it('keeps first-appearance order', () => {
    const { entries } = parseDecklist('1 B\n1 A\n1 B');
    expect(combineEntries(entries, { sideboard: false, maybeboard: false }).map(e => e.name)).toEqual(['B', 'A']);
  });
  it('does not change the parsed entries', () => {
    const { entries } = parseDecklist('1 Sol Ring\n1 Sol Ring #x');
    combineEntries(entries, { sideboard: false, maybeboard: false });
    expect(entries[1].tags).toEqual(['x']);
    expect(entries).toHaveLength(2);
  });
});

describe('nameKey', () => {
  it('ignores case, accents, apostrophe style and spacing', () => {
    expect(nameKey("  Lim-Dûl’s   VAULT ")).toBe("lim-dul's vault");
  });
});

describe('real-world exports', () => {
  it('parses a Moxfield text export', () => {
    const text = [
      '1 Atraxa, Praetors\' Voice (C16) 28 *F* #!Commander',
      '1 Sol Ring (CMM) 400 #ramp',
      '1 Arcane Signet (ELD) 331',
      '',
      'SIDEBOARD:',
      '1 Negate (M21) 59',
    ].join('\n');
    const r = parseDecklist(text);
    expect(r.entries.map(e => [e.quantity, e.name, e.section])).toEqual([
      [1, "Atraxa, Praetors' Voice", 'main'],
      [1, 'Sol Ring', 'main'],
      [1, 'Arcane Signet', 'main'],
      [1, 'Negate', 'sideboard'],
    ]);
  });
  it('parses an EDHREC style list', () => {
    expect(names('1 Sol Ring\n1 Command Tower\n1 Arcane Signet')).toEqual([[1, 'Sol Ring'], [1, 'Command Tower'], [1, 'Arcane Signet']]);
  });
  it('parses an Archidekt text export', () => {
    const text = '1x Sol Ring (cmm) 400 [Ramp{top}]\n1x Command Tower (cmr) 350 [Land] ^Have,#37d67a^\n';
    expect(names(text)).toEqual([[1, 'Sol Ring'], [1, 'Command Tower']]);
  });
});
