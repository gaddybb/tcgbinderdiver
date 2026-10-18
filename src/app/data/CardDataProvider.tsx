import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { loadCards } from '../../connectors/loadCards';
import type { LoadProgress, WantedCard } from '../../connectors/loadCards';
import { createBulkConnector, loadCatalog } from '../../connectors/bulk';
import type { BulkConnector, CatalogInfo } from '../../connectors/bulk';
import { ScryfallConnector } from '../../connectors/scryfall';
import type { CardRecord } from '../../core/cards';
import type { GameConnector } from '../../core/connector';
import { CardsRepository } from '../../storage';
import { useStorage } from './StorageProvider';
import { useStoreSettings } from './StoreSettingsProvider';

interface CardDataContext {
  connector: GameConnector;
  repo: CardsRepository;
}

const Context = createContext<CardDataContext | null>(null);

interface CardDataProviderProps {
  // Tests pass a fake. The app reads the local card catalog and asks Scryfall live only for what it does not have,
  // or for everything while the catalog is not available.
  connector?: GameConnector;
  children: ReactNode;
}

// The card data source and the saved card data, shared by every screen that shows cards.
export function CardDataProvider({ connector: given, children }: CardDataProviderProps) {
  const storage = useStorage();
  const value = useMemo<CardDataContext>(
    () => ({
      connector: given ?? createBulkConnector({ load: () => loadCatalog({ storage }), fallback: new ScryfallConnector({ cache: storage }) }),
      repo: new CardsRepository(storage),
    }),
    [given, storage],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useConnector(): GameConnector {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useConnector needs a CardDataProvider above it.');
  return ctx.connector;
}

const isBulk = (c: GameConnector): c is GameConnector & Pick<BulkConnector, 'catalogInfo'> => 'catalogInfo' in c;

// Which card catalog the prices come from, when the app is using one (null while loading, or when the live API is in use).
export function useCatalogInfo(): CatalogInfo | null {
  const connector = useConnector();
  const [state, setState] = useState<{ source: GameConnector; info: CatalogInfo | null } | null>(null);
  useEffect(() => {
    let current = true;
    if (isBulk(connector)) void connector.catalogInfo().then(info => { if (current) setState({ source: connector, info }); });
    return () => { current = false; };
  }, [connector]);
  return state?.source === connector ? state.info : null;
}

export type CardDataStatus = 'loading' | 'ready' | 'error';

export interface CardData {
  records: ReadonlyMap<string, CardRecord>;
  status: CardDataStatus;            // 'error' means the data source could not be reached; saved data is still in `records`
  progress: LoadProgress;
  notFound: ReadonlySet<string>;     // card keys the data source does not know
  retry: () => void;
  refresh: () => void;               // forget what is saved for these cards and fetch it again
}

const NONE: ReadonlyMap<string, CardRecord> = new Map();
const FIELD = '\u0000';
const LINE = '\n';

// Loads the card data for some cards: saved data shows at once, missing or old data is fetched with progress.
// Opening the same cards again costs nothing while the saved data is fresh.
export function useCardData(cards: readonly WantedCard[], now: () => Date): CardData {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useCardData needs a CardDataProvider above it.');
  const { connector, repo } = ctx;
  const includeBasics = useStoreSettings().settings.includeBasicLands;

  const [records, setRecords] = useState<ReadonlyMap<string, CardRecord>>(NONE);
  const [progress, setProgress] = useState<LoadProgress>({ total: 0, done: 0 });
  const [finished, setFinished] = useState<{ id: string; status: 'ready' | 'error'; notFound: ReadonlySet<string> } | null>(null);
  const [attempt, setAttempt] = useState(0);

  // The run starts again only when the set of cards changes (or on Retry), not on every render.
  const signature = useMemo(() => cards.map(c => c.cardKey + FIELD + c.name).sort().join(LINE), [cards]);
  const id = attempt + ':' + signature + ':' + includeBasics;

  useEffect(() => {
    const controller = new AbortController();
    const wanted: WantedCard[] = signature === '' ? [] : signature.split(LINE).map(line => {
      const [cardKey, name] = line.split(FIELD);
      return { cardKey, name };
    });
    loadCards({
      connector, repo, cards: wanted, now: now(), signal: controller.signal, includeBasics,
      onCached: cached => { if (!controller.signal.aborted) setRecords(new Map(cached)); },
      onRecord: record => { if (!controller.signal.aborted) setRecords(prev => new Map(prev).set(record.key, record)); },
      onProgress: p => { if (!controller.signal.aborted) setProgress(p); },
    }).then(result => {
      if (controller.signal.aborted || result.aborted) return;
      setRecords(new Map(result.records));
      setFinished({ id: attempt + ':' + signature + ':' + includeBasics, status: result.failed ? 'error' : 'ready', notFound: new Set(result.notFound) });
    });
    return () => controller.abort();
  }, [connector, repo, signature, now, attempt, includeBasics]);

  // Until the run for these cards finishes, the status is loading.
  const done = finished?.id === id ? finished : null;
  const retry = useCallback(() => setAttempt(n => n + 1), []);
  const refresh = useCallback(() => {
    const keys = signature === '' ? [] : signature.split(LINE).map(line => line.split(FIELD)[0]);
    void repo.deleteMany(keys).then(() => setAttempt(n => n + 1));
  }, [repo, signature]);
  return { records, status: done?.status ?? 'loading', progress, notFound: done?.notFound ?? new Set(), retry, refresh };
}
