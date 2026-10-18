// Builds the slimmed card data (docs/DATA-PLAN.md) from Scryfall's daily Default Cards bulk file.
//
//   npm run data           real download (about 80 MB) -> public/data/
//   npm run data:fixture   small sample in src/core/catalog/fixtures, no network
//
// Options: --fixture, --out <dir> (default public/data), --cache <dir> (default .cache/scryfall; the download is kept
// there so a second run does not fetch it again).
// All the format work is in src/core/catalog (pure and tested). This script only talks to the network and the disk.
// It runs in Node, so it sends an accurate User-Agent, as reference/policy/constraints.md asks of build scripts.
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { brotliCompressSync, constants, createGunzip, gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { encodeCatalog, slimCard } from '../src/core/catalog/encode.ts';
import { MANIFEST_FILE, buildManifest } from '../src/core/catalog/manifest.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(root, 'src/core/catalog/fixtures/default-cards.sample.jsonl');
const FIXTURE_UPDATED_AT = '2026-10-18T00:00:00.000+00:00';
const BULK_LIST_URL = 'https://api.scryfall.com/bulk-data';
const ATTEMPTS = 3;

function parseArgs(argv) {
  const opts = { fixture: false, out: path.join(root, 'public/data'), cache: path.join(root, '.cache/scryfall') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--fixture') opts.fixture = true;
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

async function withRetries(label, fn) {
  for (let attempt = 1; ; attempt++) {
    try { return await fn(); } catch (err) {
      if (attempt >= ATTEMPTS) throw new Error(`${label} failed after ${ATTEMPTS} tries: ${err.message}`);
      console.warn(`${label} failed (${err.message}), trying again`);
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
}

async function exists(file) {
  try { await stat(file); return true; } catch { return false; }
}

// Scryfall's listing names the current Default Cards file; its address changes with every daily build.
async function findBulkFile(headers) {
  return withRetries('The bulk data listing', async () => {
    const res = await fetch(BULK_LIST_URL, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const entry = (body.data ?? []).find((d) => d.type === 'default_cards');
    if (!entry?.jsonl_download_uri) throw new Error('the listing has no default_cards file with a jsonl_download_uri');
    return { url: entry.jsonl_download_uri, updatedAt: entry.updated_at };
  });
}

async function download(url, file, headers) {
  await withRetries('The download', async () => {
    const res = await fetch(url, { headers });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const partial = `${file}.part`;
    await pipeline(Readable.fromWeb(res.body), createWriteStream(partial));
    await rename(partial, file);
  });
}

// The download in the cache folder, fetched only when it is not there yet. Older downloads are removed.
async function cachedDownload(opts, headers) {
  const { url, updatedAt } = await findBulkFile(headers);
  await mkdir(opts.cache, { recursive: true });
  const name = path.basename(new URL(url).pathname);
  const file = path.join(opts.cache, name);
  if (await exists(file)) {
    console.log(`Using the cached download ${name}`);
  } else {
    console.log(`Downloading ${url}`);
    await download(url, file, headers);
    for (const other of await readdir(opts.cache)) {
      if (other !== name && other.startsWith('default-cards-')) await rm(path.join(opts.cache, other), { force: true });
    }
  }
  return { file, updatedAt };
}

async function slimLines(lines) {
  const slims = [];
  let read = 0;
  for await (const line of lines) {
    if (!line.trim()) continue;
    read++;
    const slim = slimCard(JSON.parse(line));
    if (slim) slims.push(slim);
  }
  return { slims, read };
}

const hashOf = (text) => createHash('sha256').update(text).digest('hex').slice(0, 10);
const mb = (n) => (n < 100_000 ? `${(n / 1000).toFixed(1)} KB` : `${(n / 1_000_000).toFixed(2)} MB`);

async function main() {
  const started = Date.now();
  const opts = parseArgs(process.argv.slice(2));
  const headers = { Accept: 'application/json;q=0.9,*/*;q=0.8', 'User-Agent': await userAgent() };

  let input, updatedAt;
  if (opts.fixture) {
    input = createReadStream(FIXTURE);
    updatedAt = FIXTURE_UPDATED_AT;
  } else {
    const cached = await cachedDownload(opts, headers);
    input = createReadStream(cached.file).pipe(createGunzip());
    updatedAt = cached.updatedAt;
  }
  const { slims, read } = await slimLines(createInterface({ input, crlfDelay: Infinity }));
  const encoded = encodeCatalog(slims);
  const afterEncode = Date.now();

  const cardsText = JSON.stringify(encoded.cards);
  const pricesText = JSON.stringify(encoded.prices);
  const manifest = buildManifest({
    builtAt: new Date().toISOString(), scryfallUpdatedAt: updatedAt, counts: encoded.counts,
    cardsHash: hashOf(cardsText), pricesHash: hashOf(pricesText),
  });

  await mkdir(opts.out, { recursive: true });
  for (const old of await readdir(opts.out)) {
    if (/^(cards|prices)\.[0-9a-f]+\.json$/.test(old)) await rm(path.join(opts.out, old));
  }
  await writeFile(path.join(opts.out, manifest.files.cards), cardsText);
  await writeFile(path.join(opts.out, manifest.files.prices), pricesText);
  await writeFile(path.join(opts.out, MANIFEST_FILE), JSON.stringify(manifest, null, 2) + '\n');

  console.log(`\nRead ${read} lines, kept ${encoded.counts.printings} paper printings of ${encoded.counts.cards} cards in ${encoded.counts.sets} sets.`);
  console.log(`Scryfall updated_at ${updatedAt}\n`);
  console.log('file'.padEnd(26) + 'raw'.padStart(12) + 'gzip'.padStart(12) + 'brotli'.padStart(12));
  for (const [name, text] of [[manifest.files.cards, cardsText], [manifest.files.prices, pricesText]]) {
    const gz = gzipSync(text, { level: 9 }).length;
    const br = brotliCompressSync(text, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: text.length } }).length;
    console.log(name.padEnd(26) + mb(Buffer.byteLength(text)).padStart(12) + mb(gz).padStart(12) + mb(br).padStart(12));
  }
  console.log(`\nWrote ${path.relative(root, opts.out)}/ in ${((Date.now() - started) / 1000).toFixed(1)} s (encode ${((afterEncode - started) / 1000).toFixed(1)} s incl. read).`);
}

main().catch((err) => {
  console.error(`Card data build failed: ${err.message}`);
  process.exitCode = 1;
});
