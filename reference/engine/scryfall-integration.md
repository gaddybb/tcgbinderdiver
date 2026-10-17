# Scryfall integration

Verify these against the current docs at https://scryfall.com/docs/api before building; they are from our design work.

## Calls
| Need | Call |
| --- | --- |
| Look up many names | `POST /cards/collection` with `{ identifiers: [{ name }] }`, up to 75 per request; use the front-face name for `A // B` cards |
| Names not matched | `GET /cards/named?fuzzy=NAME`; correct the stored name to Scryfall's spelling |
| Several matches (Needs your pick) | `GET /cards/search?q=...` or fuzzy errors that list candidates |
| Not found autocomplete | `GET /cards/autocomplete?q=...` |
| Every printing of a card | follow the card's `prints_search_uri`, paginate with `next_page` while `has_more` |
| Set dates and types | `GET /sets` once, cache 7 days (`name`, `code`, `released_at`, `set_type`) |

## Rules
- Pace requests about 100 ms apart (at most ~10 per second); retry 429 and 5xx with backoff; send `Accept` and a `User-Agent`.
- Cache in the browser (IndexedDB). A list's lookup must survive leaving the page and resume.
- Ignore printings with `digital: true`, `games` lacking `paper`, or `set_type: memorabilia`.
- Skip printing lookups for basic lands unless the include-basics switch is on.
- Double-faced cards: colors, type_line and images come from `card_faces[0]` when the top-level field is missing.
- Store per card: name, type_line, colors (front face), small image URL, scryfall_uri, and per printing: set, set_name, set_type, released_at, rarity, collector_number, finishes, prices, promo flags, frame data.
- Show Scryfall's images unmodified and credit Scryfall on every page (see `policy/constraints.md`).
- Collector numbers differ for every printing; always show the number for the printing at the stop.

## Connector interface (so other games can be added later)
Each game connector answers: find a card by name (typo tolerant), list paper printings with price per finish, return a sort category for store order (Magic: color), return an image URL. The core never imports Scryfall directly.
