// Builds the slimmed card data (docs/DATA-PLAN.md, docs/MULTI-GAME.md) for a game from its source.
//
//   npm run data           every live game, real download (Magic: about 80 MB) -> public/data/<game>/
//   npm run data:fixture   small sample in src/core/catalog/fixtures, no network
//
// With no --game, one game failing does not stop the others (its folder keeps what was there, which the nightly workflow restores
// from its cache), and only a Magic failure fails the script; every failure is listed in .cache/data-failures.json for the workflow
// to report. With --game, any failure fails the script.
// Options: --game <id> (default: every live game), --fixture, --out <dir> (default public/data/<game>), --cache <dir> (default
// .cache/<source>; the download is kept there so a second run does not fetch it again).
// All the format work is in src/core/catalog (pure and tested). A game's source (scripts/sources/<name>.mjs) talks to the
// network and the disk and hands back slim printings; this script encodes and writes them. It runs in Node, so it sends an
// accurate User-Agent, as reference/policy/constraints.md asks of build scripts.
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { encodeCatalog } from '../src/core/catalog/encode.ts';
import { MANIFEST_FILE, buildManifest } from '../src/core/catalog/manifest.ts';
import { DEFAULT_GAME, GAMES } from '../src/core/games/index.ts';
import { buildAll } from '../src/core/games/refresh.ts';
import { scryfall } from './sources/scryfall.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// One source per game. A game with no source here cannot be built, which is the right failure for a game that is not live yet.
const SOURCES = { magic: scryfall };
const FAILURES_FILE = path.join(root, '.cache/data-failures.json');

function parseArgs(argv) {
  const opts = { game: null, fixture: false, out: null, cache: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--game') opts.game = argv[++i];
    else if (argv[i] === '--fixture') opts.fixture = true;
    else if (argv[i] === '--out') opts.out = path.resolve(argv[++i]);
    else if (argv[i] === '--cache') opts.cache = path.resolve(argv[++i]);
    else throw new Error(`Unknown option ${argv[i]}`);
  }
  return opts;
}

async function userAgent() {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  return `BinderDiver/${pkg.version}`;
}

const hashOf = (text) => createHash('sha256').update(text).digest('hex').slice(0, 10);
const mb = (n) => (n < 100_000 ? `${(n / 1000).toFixed(1)} KB` : `${(n / 1_000_000).toFixed(2)} MB`);

async function buildGame(game, opts, headers) {
  const source = SOURCES[game.id];
  if (!source) throw new Error(`There is no card data source for ${game.id} yet`);
  const started = Date.now();
  const outDir = opts.out ?? path.join(root, 'public/data', game.id);
  const cacheDir = opts.cache ?? path.join(root, '.cache', source.cacheName);
  const { slims, read, updatedAt } = await source.load({ headers, cacheDir, fixture: opts.fixture });
  const encoded = encodeCatalog(slims);
  const afterEncode = Date.now();

  const cardsText = JSON.stringify(encoded.cards);
  const pricesText = JSON.stringify(encoded.prices);
  const manifest = buildManifest({
    builtAt: new Date().toISOString(), scryfallUpdatedAt: updatedAt, counts: encoded.counts,
    cardsHash: hashOf(cardsText), pricesHash: hashOf(pricesText), game,
  });

  await mkdir(outDir, { recursive: true });
  for (const old of await readdir(outDir)) {
    if (/^(cards|prices)\.[0-9a-f]+\.json$/.test(old)) await rm(path.join(outDir, old));
  }
  await writeFile(path.join(outDir, manifest.files.cards), cardsText);
  await writeFile(path.join(outDir, manifest.files.prices), pricesText);
  await writeFile(path.join(outDir, MANIFEST_FILE), JSON.stringify(manifest, null, 2) + '\n');

  console.log(`\n${game.id}: read ${read} lines, kept ${encoded.counts.printings} paper printings of ${encoded.counts.cards} cards in ${encoded.counts.sets} sets.`);
  console.log(`Source updated_at ${updatedAt}\n`);
  console.log('file'.padEnd(26) + 'raw'.padStart(12) + 'gzip'.padStart(12) + 'brotli'.padStart(12));
  for (const [name, text] of [[manifest.files.cards, cardsText], [manifest.files.prices, pricesText]]) {
    const gz = gzipSync(text, { level: 9 }).length;
    const br = brotliCompressSync(text, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: text.length } }).length;
    console.log(name.padEnd(26) + mb(Buffer.byteLength(text)).padStart(12) + mb(gz).padStart(12) + mb(br).padStart(12));
  }
  console.log(`\nWrote ${path.relative(root, outDir)}/ in ${((Date.now() - started) / 1000).toFixed(1)} s (encode ${((afterEncode - started) / 1000).toFixed(1)} s incl. read).`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const headers = { Accept: 'application/json;q=0.9,*/*;q=0.8', 'User-Agent': await userAgent() };
  let games = Object.values(GAMES).filter((g) => g.live);
  if (opts.game) {
    const one = GAMES[opts.game];
    if (!one) throw new Error(`Unknown game ${opts.game}; the games are ${Object.keys(GAMES).join(', ')}`);
    games = [one];
  }
  if (opts.game) return buildGame(games[0], opts, headers);

  await mkdir(path.dirname(FAILURES_FILE), { recursive: true });
  await rm(FAILURES_FILE, { force: true });
  const outcome = await buildAll(games, (game) => buildGame(game, opts, headers), DEFAULT_GAME);
  if (outcome.failures.length > 0) {
    await writeFile(FAILURES_FILE, JSON.stringify(outcome.failures, null, 2) + '\n');
    for (const f of outcome.failures) console.error(`${f.game}: card data build failed: ${f.message}`);
  }
  if (outcome.stop) throw new Error(`${DEFAULT_GAME} failed, so there is nothing safe to deploy`);
}

main().catch((err) => {
  console.error(`Card data build failed: ${err.message}`);
  process.exitCode = 1;
});
