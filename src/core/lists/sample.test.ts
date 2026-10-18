import { describe, expect, it } from 'vitest';
import { pickSample } from './sample';

const A = { name: 'A', text: '1 Sol Ring' };
const B = { name: 'B', text: '1 Cultivate' };
const C = { name: 'C', text: '1 Command Tower' };

describe('pickSample', () => {
  it('picks by the random number, from the first to the last deck', () => {
    expect(pickSample([A, B, C], 0)?.name).toBe('A');
    expect(pickSample([A, B, C], 0.5)?.name).toBe('B');
    expect(pickSample([A, B, C], 0.999)?.name).toBe('C');
  });

  it('never goes past the end, even for a random number of 1', () => {
    expect(pickSample([A, B], 1)?.name).toBe('B');
  });

  it('avoids the deck it was told to when there is another', () => {
    expect(pickSample([A, B], 0, 'A')?.name).toBe('B');
    expect(pickSample([A, B, C], 0, 'A')?.name).toBe('B');
  });

  it('gives the only deck back even if it was to be avoided', () => {
    expect(pickSample([A], 0.7, 'A')?.name).toBe('A');
  });

  it('gives nothing when there are no decks', () => {
    expect(pickSample([], 0.3)).toBeUndefined();
  });
});
