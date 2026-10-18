// Sample decks: a small built-in set, one picked at random. Pure: the random number comes in as an argument.
export interface SampleDeck { name: string; text: string }

// Picks a deck with `random` (a number from 0 up to, not including, 1), avoiding `avoid` by name when there is another.
export function pickSample(decks: readonly SampleDeck[], random: number, avoid?: string): SampleDeck | undefined {
  const others = decks.filter(d => d.name !== avoid);
  const pool = others.length > 0 ? others : decks;
  if (pool.length === 0) return undefined;
  return pool[Math.min(pool.length - 1, Math.floor(random * pool.length))];
}
