import { describe, expect, it } from 'vitest';
import { buildHandoff, fromWire, toWire } from '../handoff';
import { addEntries, createList } from '../lists';
import { DEFAULT_STORE_SETTINGS } from '../store';
import { startTrip } from '../trip';
import { isGameId, isLiveGame } from './index';

const NOW = new Date('2026-10-23T12:00:00Z');
const list = addEntries(createList({ id: 'a', kind: 'deck', name: 'Deck' }, NOW), [{ cardKey: 'sol ring', name: 'Sol Ring', quantity: 1 }], NOW).list;

describe('which games are known and live', () => {
  it('knows the four, and only Magic is live', () => {
    expect(['magic', 'pokemon', 'lorcana', 'yugioh'].every(isGameId)).toBe(true);
    expect(isGameId('chess')).toBe(false);
    expect(isLiveGame('magic')).toBe(true);
    expect(isLiveGame('pokemon')).toBe(false);
  });
});

describe('the game on lists and trips', () => {
  it('leaves Magic lists and trips exactly as they were (no game field)', () => {
    expect(createList({ id: 'a', kind: 'deck', name: 'Deck', game: 'magic' }, NOW)).not.toHaveProperty('game');
    expect(startTrip('t', NOW, ['a'])).not.toHaveProperty('game');
  });

  it('records another game on a list and a trip', () => {
    expect(createList({ id: 'a', kind: 'deck', name: 'Deck', game: 'pokemon' }, NOW).game).toBe('pokemon');
    expect(startTrip('t', NOW, ['a'], 'pokemon').game).toBe('pokemon');
  });
});

describe('the game in the hand-off link', () => {
  it('writes nothing for Magic, so a Magic link is the same text as before', () => {
    const wire = toWire(buildHandoff([list], DEFAULT_STORE_SETTINGS));
    expect(wire).not.toContain('"g"');
    expect(fromWire(wire)?.game).toBeUndefined();
    expect(fromWire(toWire(buildHandoff([list], DEFAULT_STORE_SETTINGS, 'magic')))?.game).toBeUndefined();
  });

  it('carries another game, in both link forms, with and without store settings', () => {
    const handoff = buildHandoff([list], DEFAULT_STORE_SETTINGS, 'lorcana');
    expect(fromWire(toWire(handoff))?.game).toBe('lorcana');
    expect(fromWire(toWire(handoff, true))?.game).toBe('lorcana');
    expect(fromWire(toWire({ ...handoff, settings: undefined }))?.game).toBe('lorcana');
  });

  it('refuses a link naming a game this app does not know', () => {
    const wire = JSON.parse(toWire(buildHandoff([list], DEFAULT_STORE_SETTINGS)));
    expect(fromWire(JSON.stringify({ ...wire, g: 'chess' }))).toBeNull();
    expect(fromWire(JSON.stringify({ ...wire, g: 7 }))).toBeNull();
  });
});
