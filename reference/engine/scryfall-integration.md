# Scryfall integration

Verify these against the current docs at https://scryfall.com/docs/api before building; they are from our design work.

## Bulk data first (changed 2026-10-17, see `docs/DATA-PLAN.md`)
Card data comes from Scryfall's **Default Cards** bulk file (`GET /bulk-data`, the `default_cards` entry; gzipped JSONL,
about 80 MB, one object per printing, rebuilt every 12 to 24 hours). A build script slims it into static files our app
loads once and keeps in IndexedDB. The live API (below) is the fallback for what bulk data can't do.
- Measured on 2026-10-17: 118,773 lines; 103,774 paper printings after dropping digital and memorabilia; 35,172 unique cards; 898 sets; 3.0 printings per card on average (Forest has 800).
- Slimmed size, gzip: about 3.0 MB in one file with prices, or 2.7 MB static plus a 0.3 MB prices file; the name list for autocomplete is 0.2 MB.
- Every card image URL can be rebuilt from the printing's `id`: `https://cards.scryfall.io/{size}/front/{id[0]}/{id[1]}/{id}.jpg` (true for all 103,774 paper printings measured). Use `card_faces[0]` data for double-faced cards as before.
- Prices in bulk data are "dangerously stale after 24 hours": refresh daily and show the date.

## Calls (the live fallback)
| Need | Call |
| --- | --- |
| Look up many names | `POST /cards/collection` with `{ identifiers: [{ name }] }`, up to 75 per request; use the front-face name for `A // B` cards |
| Names not matched | `GET /cards/named?fuzzy=NAME`; correct the stored name to Scryfall's spelling |
| Several matches (Needs your pick) | `GET /cards/search?q=...` or fuzzy errors that list candidates |
| Not found autocomplete | `GET /cards/autocomplete?q=...` |
| Every printing of a card | follow the card's `prints_search_uri`, paginate with `next_page` while `has_more` |
| Set dates and types | `GET /sets` once, cache 7 days (`name`, `code`, `released_at`, `set_type`) |

## Rules
- Pace requests about 100 ms apart (at most ~10 per second); retry 429 and 5xx with backoff. Send `Accept`; from the browser keep the browser's own `User-Agent` (Scryfall requires this). Build scripts send an accurate `BinderDiver/<version>` User-Agent.
- Cache in the browser (IndexedDB). A list's lookup must survive leaving the page and resume.
- Ignore printings with `digital: true`, `games` lacking `paper`, or `set_type: memorabilia`.
- Skip printing lookups for basic lands unless the include-basics switch is on.
- Double-faced cards: colors, type_line and images come from `card_faces[0]` when the top-level field is missing.
- Store per card: name, type_line, colors (front face), small image URL, scryfall_uri, and per printing: set, set_name, set_type, released_at, rarity, collector_number, finishes, prices, promo flags, frame data.
- Show Scryfall's images unmodified and credit Scryfall on every page (see `policy/constraints.md`).
- Collector numbers differ for every printing; always show the number for the printing at the stop.

## Connector interface (so other games can be added later)
Each game connector answers: find a card by name (typo tolerant), list paper printings with price per finish, return a sort category for store order (Magic: color), return an image URL. The core never imports Scryfall directly.
