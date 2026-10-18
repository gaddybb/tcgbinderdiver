import { describe, expect, it } from 'vitest';
import { MAX_CARDS_PER_LIST } from '../../core/lists';
import { combineEntries, parseDecklist } from '../../core/parse/parseDecklist';
import { SAMPLE_DECKS } from './sampleDecks';

// A guard for the owner's sample decks: a typo in this file should fail here, not on the home page.
describe('the sample decks', () => {
  it('have a name each, and no two share one', () => {
    for (const deck of SAMPLE_DECKS) expect(deck.name.trim()).not.toBe('');
    expect(new Set(SAMPLE_DECKS.map(d => d.name)).size).toBe(SAMPLE_DECKS.length);
  });

  it.each(SAMPLE_DECKS.map(d => [d.name, d] as const))('%s reads as a decklist, every line a card, within the list limit', (_name, deck) => {
    const parsed = parseDecklist(deck.text);
    expect(parsed.skippedLines).toBe(0);
    const entries = combineEntries(parsed.entries, { sideboard: false, maybeboard: false });
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.length).toBeLessThanOrEqual(MAX_CARDS_PER_LIST);
  });
});
