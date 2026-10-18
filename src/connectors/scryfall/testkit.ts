// Test helpers for the Scryfall connector: a fake clock, a scripted fetch and raw Scryfall card fixtures.
// Not imported by app code.
import type { FetchLike } from './client';

export function makeClock() {
  let t = 0;
  return {
    now: () => t,
    sleep: async (ms: number) => { t += ms; },
    get time() { return t; },
  };
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

export interface Call { url: string; method: string; body: unknown; headers: Record<string, string>; at: number }

// A fetch that answers from `handler` and records every call with the fake clock's time.
export function scripted(handler: (call: Call) => Response | Promise<Response>, now: () => number = () => 0) {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    const call: Call = {
      url,
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      headers: (init?.headers ?? {}) as Record<string, string>,
      at: now(),
    };
    calls.push(call);
    return handler(call);
  };
  return { fetch, calls };
}

export function rawCard(over: Record<string, unknown> = {}) {
  return {
    object: 'card', id: 'id-1', oracle_id: 'oracle-1', name: 'Sol Ring', type_line: 'Artifact', colors: [],
    image_uris: { small: 'https://img.example/s.jpg', normal: 'https://img.example/n.jpg' },
    scryfall_uri: 'https://scryfall.com/card/cmm/400/sol-ring?utm_source=api',
    prints_search_uri: 'https://api.scryfall.com/cards/search?order=released&q=oracleid%3Aoracle-1&unique=prints',
    set: 'CMM', set_name: 'Commander Masters', set_type: 'masters', released_at: '2023-08-04', rarity: 'uncommon',
    collector_number: '400', finishes: ['nonfoil', 'foil'], prices: { usd: '1.50', usd_foil: '2.00', usd_etched: null },
    promo: false, border_color: 'black', full_art: false, digital: false, games: ['paper', 'mtgo'],
    ...over,
  };
}

export const list = (data: unknown[], extra: Record<string, unknown> = {}) => ({ object: 'list', has_more: false, data, ...extra });
export const notFound = (extra: Record<string, unknown> = {}) => ({ object: 'error', code: 'not_found', status: 404, ...extra });
