// Loads the slimmed card catalog (docs/DATA-PLAN.md): fetches manifest.json, then only the files whose hash changed,
// and keeps the file text on the device so a repeat visit downloads almost nothing and the app works offline.
// Anything that goes wrong becomes CatalogUnavailableError, which the bulk connector answers by using the live API.
import { CatalogFormatError, FORMAT_VERSION, MANIFEST_FILE, decodeCatalog } from '../../core/catalog';
import type { Catalog, Manifest } from '../../core/catalog';
import type { AppStorage } from '../../storage';
import type { FetchLike } from '../scryfall/client';

export class CatalogUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogUnavailableError';
  }
}

export interface LoadedCatalog {
  catalog: Catalog;
  manifest: Manifest;
  offline: boolean;   // the saved copy was used because the site could not be reached
}

export interface CatalogLoaderOptions {
  storage: AppStorage;
  base?: string;      // where the data files live, with a trailing slash
  fetch?: FetchLike;
}

export const CATALOG_BASE = '/data/';
const KEY = { manifest: 'catalog:manifest', cards: 'catalog:cards', prices: 'catalog:prices' } as const;

interface SavedFile { file: string; text: string }
interface Saved { manifest?: Manifest; cards?: SavedFile; prices?: SavedFile }

function isManifest(value: unknown): value is Manifest {
  const m = value as Partial<Manifest> | null;
  return typeof m === 'object' && m !== null && m.format === FORMAT_VERSION && typeof m.builtAt === 'string'
    && typeof m.scryfallUpdatedAt === 'string' && typeof m.files?.cards === 'string' && typeof m.files?.prices === 'string';
}

// The saved copy is only usable when both files are there and match the saved manifest.
function usable(saved: Saved): saved is Required<Saved> {
  return !!saved.manifest && saved.cards?.file === saved.manifest.files.cards && saved.prices?.file === saved.manifest.files.prices;
}

export async function loadCatalog(options: CatalogLoaderOptions, retried = false): Promise<LoadedCatalog> {
  const { storage } = options;
  const base = options.base ?? CATALOG_BASE;
  const doFetch: FetchLike = options.fetch ?? ((url, init) => globalThis.fetch(url, init));

  const saved: Saved = {
    manifest: await storage.get<Manifest>('cache', KEY.manifest),
    cards: await storage.get<SavedFile>('cache', KEY.cards),
    prices: await storage.get<SavedFile>('cache', KEY.prices),
  };

  const decode = (cards: SavedFile, prices: SavedFile, manifest: Manifest, offline: boolean): LoadedCatalog => ({
    catalog: decodeCatalog(JSON.parse(cards.text), JSON.parse(prices.text)),
    manifest,
    offline,
  });

  // What is saved is fallible too: if it will not decode, throw it away and start from the site once.
  const decodeSaved = async (s: Required<Saved>, offline: boolean): Promise<LoadedCatalog> => {
    try {
      return decode(s.cards, s.prices, s.manifest, offline);
    } catch {
      await Promise.all(Object.values(KEY).map(k => storage.delete('cache', k)));
      if (retried) throw new CatalogUnavailableError('The saved card data could not be read.');
      return loadCatalog(options, true);
    }
  };

  const text = async (url: string, init?: RequestInit): Promise<string> => {
    const res = await doFetch(url, init);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  };

  // 1. The manifest says which files are current. Always revalidated; a missing or odd answer is "no catalog".
  let manifest: Manifest | null = null;
  try {
    const parsed: unknown = JSON.parse(await text(base + MANIFEST_FILE, { cache: 'no-cache' }));
    if (isManifest(parsed)) manifest = parsed;
  } catch {
    manifest = null;
  }

  const offlineCopy = async (reason: string): Promise<LoadedCatalog> => {
    if (usable(saved)) return decodeSaved(saved, true);
    throw new CatalogUnavailableError(reason);
  };

  if (!manifest) return offlineCopy('The card data could not be reached.');

  // 2. Fetch only what changed. A hashed file never changes, so a matching name means the saved text is right.
  let cards = saved.cards?.file === manifest.files.cards ? saved.cards : undefined;
  let prices = saved.prices?.file === manifest.files.prices ? saved.prices : undefined;
  const downloaded = !cards || !prices;
  try {
    if (!cards) cards = { file: manifest.files.cards, text: await text(base + manifest.files.cards) };
    if (!prices) prices = { file: manifest.files.prices, text: await text(base + manifest.files.prices) };
  } catch {
    return offlineCopy('The card data files could not be downloaded.');
  }

  let loaded: LoadedCatalog;
  try {
    loaded = decode(cards, prices, manifest, false);
  } catch (error) {
    if (!downloaded) {
      await Promise.all(Object.values(KEY).map(k => storage.delete('cache', k)));
      if (!retried) return loadCatalog(options, true);
    }
    const detail = error instanceof CatalogFormatError ? error.message : 'It could not be read.';
    throw new CatalogUnavailableError(`The card data is not usable. ${detail}`);
  }

  // 3. Keep it, only after it decoded, so a bad download is never saved.
  if (downloaded) {
    await storage.put('cache', KEY.manifest, manifest);
    await storage.put('cache', KEY.cards, cards);
    await storage.put('cache', KEY.prices, prices);
  } else if (saved.manifest?.builtAt !== manifest.builtAt) {
    await storage.put('cache', KEY.manifest, manifest);
  }
  return loaded;
}
