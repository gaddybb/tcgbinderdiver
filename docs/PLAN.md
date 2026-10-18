# Binder Diver v1: build plan

Approved by the owner on 2026-10-17. Source documents: `reference/` (see `reference/README.md`).

## Folder structure

```
.github/workflows/ci.yml      lint, test, build on every PR
public/                       _redirects (SPA fallback), _headers, icons, manifest
docs/PLAN.md                  this file
src/
  core/                       pure, game-agnostic: no React, no fetch, no clock reads
    engine/                   engine.ts (from reference), weights.ts (WEIGHTS), storeProfile.ts (V1_STORE),
                              reopen.ts, pullVerdict.ts, *.test.ts
    parse/                    decklist parser (counts, set codes, foil tags, #tags, headers, sections, duplicates)
    lists/                    statuses, quantities, merging one card across lists, Found +1 allocation
    trip/                     trip reducer: frozen order, finish, reopen, found copies, end trip
    sort/                     binder order (color, then collector number), A to Z
    export/                   copy as text, TCGplayer Mass Entry text
    connector.ts              GameConnector interface (types only)
  connectors/scryfall/        the only GameConnector: paced client, collection, fuzzy, autocomplete,
                              printings, sets cache, mapping to core types, resumable lookup job
  storage/                    Storage interface, IndexedDB implementation, in-memory implementation for tests
  app/
    copy/en.ts                every user-facing string, keyed by screen
    theme/                    tokens.css (shared), themes/magic.css
    layout/breakpoints.ts     phone < 640, tablet 640 to 1100, desktop above
    flags.ts                  v2 and v3 features, all off in v1
    components/               one per UI-kit item
    screens/                  Home, Import, Lists, ListReview, CardDetail, Plan, PullSettings, Groups,
                              NoBinder, Dive, TripEnd, Walkthrough, About, Support, Privacy, Kit (/kit)
    router.ts                 small hand-rolled router
    sw.ts                     hand-written service worker (offline)
```

## Core types (sketch)

```ts
type CardStatus = 'needed' | 'in_collection' | 'ordered' | 'proxy' | 'out_of_deck';   // only needed counts
interface ListEntry { cardKey: string; name: string; quantity: number; status: CardStatus;
  section: 'main' | 'sideboard' | 'maybeboard'; tags: string[] }
interface CardList { id: string; kind: 'deck' | 'wishlist'; name: string; entries: ListEntry[];
  inNextDive: boolean; createdAt: string; updatedAt: string; lookup?: LookupProgress }
interface CardRecord { key: string; name: string; typeLine: string; colors: string[]; imageSmall: string | null;
  scryfallUri: string; printings: Printing[]; fetchedAt: string }        // Printing comes from the engine
interface Trip { id: string; startedAt: string; listIds: string[]; frozenOrder: string[]; finished: string[];
  found: Record<string, Record<string, number>>; notAvailable: string[]; endedAt?: string }
interface PullSettings { worthPullMinCards: number; worthPullMinUsd: number; includeBasicLands: boolean }
interface GameConnector { lookupNames; fuzzy; search; autocomplete; printings; sets; sortCategory; imageUrl }
interface Storage { get; put; delete; list }   // per collection; IndexedDB now, Supabase in v3
```

## PRs

1. Scaffold: Vite, React, TypeScript (strict), Vitest, ESLint, CI, MIT license, CHANGELOG, design tokens, copy module,
   feature flags, breakpoints, verbatim Fan Content disclaimer footer with Scryfall credit, Cloudflare Pages config.
2. Engine into `src/core` verbatim, Vitest port one for one, add the missing 21c check, split `WEIGHTS` and `V1_STORE`
   into their own modules.
3. Engine additions from the spec: reopen a stop, pull verdict labels (Worth a pull / Buy online / Show staff).
4. Decklist parser with tests.
5. Storage interface, IndexedDB and in-memory implementations.
6. Scryfall connector with mocked-fetch tests (batch 75, fuzzy fallback, pagination, sets cache, pacing, resume).
7. UI kit components and the `/kit` gallery (may split in two).
8. Lists core (statuses, quantities, several lists) and My lists.
9. Card data and list review (split from the original step 9, because the review screen needs real card data first):
   card records saved on the device, loading with progress and retry, the engine run over a list to give each card its
   target binder, and the review table with images, prices, sort, search and per-card status change.
10. Bulk actions and filters on the review (select mode, set status, copy to list, remove, price and color filters), and
    card detail (needs the "odds" levels, which the spec does not define yet). Also from the owner: on the list review,
    desktop rows show a larger card image on hover (and on keyboard focus); phone shows larger thumbnails, with
    tap-to-enlarge if needed. Function over form for now.
11. Import flow (4 steps, wishlist variant, fix names, problem states). Replaces the temporary paste box.
12. Dive plan, pull settings, binder groups, no-binder cards.
13. Trip core and store dive: flip stops (Found +1, Finish binder, frozen order, Reopen).
14. Show-staff stops, big-text view, end trip, trip summary, Buy the rest.
15. Pages: Home, walkthrough and tour, About, Support, Privacy, app states.
16. Offline service worker, install prompt, consent banner and GA4.
17. QR hand-off and sample decks.

## Decisions taken with the owner
- Pull order: keep the spec's single order (set binders by copies, then newest, then name). The Balanced / Most cards /
  Newest sets choice in v1 scope is not built until the spec defines it.
- Engine tests: port as-is (24 cases, 28 checks) and add the missing 21c check.
- Dev dependencies approved: ESLint (+ typescript-eslint, react-hooks plugin, globals), `idb`, Testing Library, jsdom,
  fake-indexeddb.
- Router and service worker are hand-rolled.
- MIT copyright holder: Benjamin LaPorte.

## Open items for the owner
- Connect the repo to Cloudflare Pages (build `npm run build`, output `dist`) to get preview deploys.
- Sample deck lists and `[SAMPLE DECK NAME]`.
- Nearby-store map needs a Google Maps key and `[STORE NAME n]` placeholders.
- QR code generation will need a small dependency (ask at PR 16). Mana font: ask at PR 7.
