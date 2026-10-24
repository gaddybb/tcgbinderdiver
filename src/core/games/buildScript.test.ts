// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// Runs the real build script on the committed fixture. The file names carry the content hashes, so these names are the same golden
// proof as games.test.ts, but through the script, the source module and the file writing.
const out = mkdtempSync(path.join(tmpdir(), 'bd-data-'));
afterAll(() => rmSync(out, { recursive: true, force: true }));
const run = (...args: string[]) => spawnSync('node', ['scripts/build-card-data.mjs', ...args], { encoding: 'utf8' });

describe('the card data build script', () => {
  it('writes the same files for Magic whether or not the game is named', () => {
    for (const args of [['--game', 'magic'], []]) {
      execFileSync('node', ['scripts/build-card-data.mjs', '--fixture', '--out', out, ...args], { stdio: 'ignore' });
      expect(readdirSync(out).sort()).toEqual(['cards.3a1a6faee2.json', 'manifest.json', 'prices.908ab7d87f.json']);
      const manifest = JSON.parse(readFileSync(path.join(out, 'manifest.json'), 'utf8'));
      expect(manifest).toMatchObject({ game: 'magic', counts: { cards: 15, printings: 36, sets: 21 } });
    }
  });

  // Skipped when real data is already there: this would overwrite it with the fixture.
  it.skipIf(existsSync('public/data/magic'))('writes into public/data/<game> when no --out is given', () => {
    try {
      execFileSync('node', ['scripts/build-card-data.mjs', '--fixture', '--game', 'magic'], { stdio: 'ignore' });
      expect(readdirSync('public/data/magic')).toContain('manifest.json');
    } finally {
      rmSync('public/data/magic', { recursive: true, force: true });
    }
  });

  it('refuses a game it does not know', () => {
    const result = run('--fixture', '--out', out, '--game', 'nope');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Unknown game nope');
  });
});
