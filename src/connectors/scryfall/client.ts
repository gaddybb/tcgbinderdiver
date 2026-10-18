// Low-level Scryfall HTTP client: paced requests, retry with backoff, and the headers Scryfall asks for.
// Everything that touches the network or the clock is injectable, so tests run instantly with a mock fetch.
// Rules: reference/engine/scryfall-integration.md and reference/policy/constraints.md.

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type ScryfallErrorKind = 'rate_limited' | 'server' | 'network' | 'bad_request' | 'bad_response' | 'aborted';

export class ScryfallError extends Error {
  constructor(readonly kind: ScryfallErrorKind, message: string, readonly status?: number) {
    super(message);
    this.name = 'ScryfallError';
  }
}

export interface ClientOptions {
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  baseUrl?: string;
  userAgent?: string;
  minIntervalMs?: number;    // gap between request starts: about 100 ms, at most ~10 a second
  maxRetries?: number;       // retries after the first try, for 429, 5xx and network failures
  backoffBaseMs?: number;    // 1st retry waits this long, then double
  maxRetryAfterMs?: number;  // cap on a Retry-After header
}

export const SCRYFALL_BASE_URL = 'https://api.scryfall.com';

export interface ApiResponse {
  status: number;
  body: unknown;
}

const DEFAULTS = {
  baseUrl: SCRYFALL_BASE_URL,
  userAgent: 'BinderDiver/0.1',
  minIntervalMs: 100,
  maxRetries: 3,
  backoffBaseMs: 1000,
  maxRetryAfterMs: 30_000,
} as const;

export class ScryfallClient {
  private readonly opts: Required<Omit<ClientOptions, 'fetch' | 'sleep' | 'now'>>;
  private readonly fetchFn: FetchLike;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly nowFn: () => number;
  private nextSlot = Number.NEGATIVE_INFINITY;

  constructor(options: ClientOptions = {}) {
    this.opts = {
      baseUrl: options.baseUrl ?? DEFAULTS.baseUrl,
      userAgent: options.userAgent ?? DEFAULTS.userAgent,
      minIntervalMs: options.minIntervalMs ?? DEFAULTS.minIntervalMs,
      maxRetries: options.maxRetries ?? DEFAULTS.maxRetries,
      backoffBaseMs: options.backoffBaseMs ?? DEFAULTS.backoffBaseMs,
      maxRetryAfterMs: options.maxRetryAfterMs ?? DEFAULTS.maxRetryAfterMs,
    };
    this.fetchFn = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
    this.sleepFn = options.sleep ?? ((ms) => new Promise(resolve => setTimeout(resolve, ms)));
    this.nowFn = options.now ?? (() => Date.now());
  }

  // `pathOrUrl` is a path like "/cards/named?fuzzy=x" or a full Scryfall URL (next_page, prints_search_uri).
  get(pathOrUrl: string, signal?: AbortSignal): Promise<ApiResponse> {
    return this.request('GET', pathOrUrl, undefined, signal);
  }

  post(pathOrUrl: string, body: unknown, signal?: AbortSignal): Promise<ApiResponse> {
    return this.request('POST', pathOrUrl, body, signal);
  }

  private url(pathOrUrl: string): string {
    if (pathOrUrl.startsWith('/')) return this.opts.baseUrl + pathOrUrl;
    if (pathOrUrl.startsWith(this.opts.baseUrl + '/')) return pathOrUrl;
    throw new ScryfallError('bad_request', `Refusing to call a URL outside Scryfall: ${pathOrUrl}`);
  }

  // Reserve the next start time synchronously, so concurrent callers still end up at least minIntervalMs apart.
  private async pace(): Promise<void> {
    const now = this.nowFn();
    const start = Math.max(now, this.nextSlot);
    this.nextSlot = start + this.opts.minIntervalMs;
    if (start > now) await this.sleepFn(start - now);
  }

  private async request(method: 'GET' | 'POST', pathOrUrl: string, body: unknown, signal?: AbortSignal): Promise<ApiResponse> {
    const url = this.url(pathOrUrl);
    const headers: Record<string, string> = { Accept: 'application/json;q=0.9,*/*;q=0.8', 'User-Agent': this.opts.userAgent };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const init: RequestInit = { method, headers, signal, body: body === undefined ? undefined : JSON.stringify(body) };

    for (let attempt = 0; ; attempt++) {
      if (signal?.aborted) throw new ScryfallError('aborted', 'Request was cancelled.');
      await this.pace();
      if (signal?.aborted) throw new ScryfallError('aborted', 'Request was cancelled.');

      let response: Response | undefined;
      let failure: ScryfallError | undefined;
      try {
        response = await this.fetchFn(url, init);
      } catch (error) {
        if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
          throw new ScryfallError('aborted', 'Request was cancelled.');
        }
        failure = new ScryfallError('network', 'Could not reach Scryfall.');
      }

      if (response) {
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable) return this.read(response);
        failure = new ScryfallError(response.status === 429 ? 'rate_limited' : 'server', `Scryfall answered ${response.status}.`, response.status);
      }

      if (attempt >= this.opts.maxRetries) throw failure!;
      await this.sleepFn(this.retryDelay(attempt, response));
    }
  }

  private retryDelay(attempt: number, response?: Response): number {
    const backoff = this.opts.backoffBaseMs * 2 ** attempt;
    const retryAfter = Number(response?.headers.get('Retry-After'));
    if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(Math.max(retryAfter * 1000, backoff), this.opts.maxRetryAfterMs);
    return backoff;
  }

  private async read(response: Response): Promise<ApiResponse> {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ScryfallError('bad_response', 'Scryfall sent something that was not JSON.', response.status);
    }
    // 404 is a normal answer here ("no such card"); other client errors mean we sent a bad request.
    if (response.status >= 400 && response.status !== 404) {
      throw new ScryfallError('bad_request', `Scryfall rejected the request (${response.status}).`, response.status);
    }
    return { status: response.status, body };
  }
}
