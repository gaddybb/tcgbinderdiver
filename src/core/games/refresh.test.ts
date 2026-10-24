import { describe, expect, it } from 'vitest';
import { MAGIC } from './magic';
import { buildAll } from './refresh';
import type { GameDefinition } from './types';

const other: GameDefinition = { ...MAGIC, id: 'pokemon' };
const third: GameDefinition = { ...MAGIC, id: 'lorcana' };
const failing = (...ids: string[]) => async (g: GameDefinition) => { if (ids.includes(g.id)) throw new Error(`${g.id} broke`); };

describe('the nightly refresh', () => {
  it('builds every game when nothing fails', async () => {
    expect(await buildAll([MAGIC, other], failing(), 'magic')).toEqual({ built: ['magic', 'pokemon'], failures: [], stop: false });
  });

  it('lets the other games go on when one of them fails, and reports it without stopping the deploy', async () => {
    const outcome = await buildAll([MAGIC, other, third], failing('pokemon'), 'magic');
    expect(outcome.built).toEqual(['magic', 'lorcana']);
    expect(outcome.failures).toEqual([{ game: 'pokemon', message: 'pokemon broke' }]);
    expect(outcome.stop).toBe(false);
  });

  it('stops the deploy when Magic fails, but still builds the rest', async () => {
    const outcome = await buildAll([MAGIC, other], failing('magic'), 'magic');
    expect(outcome.stop).toBe(true);
    expect(outcome.built).toEqual(['pokemon']);
  });

  it('keeps the message of a failure that is not an Error', async () => {
    const outcome = await buildAll([other], async () => { throw 'plain text'; }, 'magic');
    expect(outcome.failures[0].message).toBe('plain text');
  });
});
