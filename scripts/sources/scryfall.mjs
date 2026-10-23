// Magic's card data source: Scryfall's daily Default Cards bulk file. The mapping from a Scryfall card to a slim printing is pure and
// lives in src/core/catalog/sources/scryfall.ts (tested with a fixture); this file only talks to the network and the disk.
// A source gives the build script { cacheName, load({ headers, cacheDir, fixture }) -> { slims, read, updatedAt } }.
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { slimCard } from '../../src/core/catalog/sources/scryfall.ts';
import { exists, withRetries } from './shared.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FIXTURE = path.join(root, 'src/core/catalog/fixtures/default-cards.sample.jsonl');
const FIXTURE_UPDATED_AT = '2026-10-18T00:00:00.000+00:00';
const BULK_LIST_URL = 'https://api.scryfall.com/bulk-data';

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
async function cachedDownload(cacheDir, headers) {
  const { url, updatedAt } = await findBulkFile(headers);
  await mkdir(cacheDir, { recursive: true });
  const name = path.basename(new URL(url).pathname);
  const file = path.join(cacheDir, name);
  if (await exists(file)) {
    console.log(`Using the cached download ${name}`);
  } else {
    console.log(`Downloading ${url}`);
    await download(url, file, headers);
    for (const other of await readdir(cacheDir)) {
      if (other !== name && other.startsWith('default-cards-')) await rm(path.join(cacheDir, other), { force: true });
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

export const scryfall = {
  cacheName: 'scryfall',
  async load({ headers, cacheDir, fixture }) {
    let input, updatedAt;
    if (fixture) {
      input = createReadStream(FIXTURE);
      updatedAt = FIXTURE_UPDATED_AT;
    } else {
      const cached = await cachedDownload(cacheDir, headers);
      input = createReadStream(cached.file).pipe(createGunzip());
      updatedAt = cached.updatedAt;
    }
    const { slims, read } = await slimLines(createInterface({ input, crlfDelay: Infinity }));
    return { slims, read, updatedAt };
  },
};
