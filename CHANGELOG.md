# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- List review bulk actions and filters: choose cards with checkboxes (table) or a Select button and long-press (phone), then Set status, Copy to another list or Remove, each with an Undo that restores the list exactly (including after Remove). Quick actions Mark all as owned, Mark all as needed and Select by binder; Select all selects what is shown. A Price filter (Any price, Under $1, $1 to $5, $5 and up) and the Color filter combine with search and sort. A card copied to a list that already has it adds its copies, and cards beyond the 250 limit are reported. Core: `setEntriesStatus`, `removeEntries`, `copyEntries`, `cardKeysInBinder`, `binderCounts` in `src/core/lists` and `filterCards` in `src/core/filter`. New SelectionBar and SelectHeader in the kit gallery; the checkbox, card table and list row can select. More filters (rarity, type, set) is not built yet.
- List review (`/lists/:id`): a list's cards with their picture, status, the binder to look in, the printing found there (set and number) and a typical online price, as a table on tablet and desktop and as rows on a phone. Change a card's status from a menu (a bottom sheet on a phone) with an Undo, sort by name, price, collector number or color, and search by name. Replaces the plain list view.
- Card data on the device: card names are looked up on Scryfall and every paper printing fetched (paced, with progress, Try again if Scryfall can not be reached, and a note for names it does not know). Saved cards open instantly and are refreshed after a week. `planLists` runs the routing engine over a list to give each card its target binder; `sortCards` sorts by name, price, collector number or color; `typicalOnline` is the median printing price.
- The menu can show a line under each choice in its popup, show a check on the current choice, and open from a button with words in it. New card table, status picker and thumbnail-with-picture components in the kit gallery.
- My lists (`/lists`): list cards with the In next dive switch, the next-dive summary, rename on the card, Duplicate, Copy as text and Delete with a confirmation (Clear wishlist for the wishlist, which always exists), an empty state, and the menu as a bottom sheet on a phone. Lists are saved on the device. Paste a new list is a temporary plain paste box until the import flow replaces it. Start store dive waits for the store dive.
- Lists core in `src/core/lists`: lists of cards with quantities and statuses, the 250-card and 25-list limits, add, rename, duplicate, status and quantity edits, "Updated" ages, the next-dive summary, one combined needed list across lists, and Copy as text. `ListsRepository` keeps them in storage and guarantees the single wishlist.
- Page header, next-dive bar and empty state components; the list card can rename in place; the menu shows a line under each choice. A list view stand-in at `/lists/:id`, and routes with parameters.
- UI kit: one component per kit item (Button, Chip, Switch, Input, Select, Stepper, Checkbox, Radio, ColorFilter, StatusLabel, PullVerdict, OddsLabel, QuantityBadge, ProgressBar, StepIndicator, CardTile, ListRow, ListCard, Skeleton, Banner, Toast, Menu, Sheet, Dialog, TourTip, TabBar, BinderPicker, Logo, GameAnchor), all built on design tokens and the copy module.
- Kit gallery at `/kit`: every component in every state, mirroring board 8 of the design reference.
- A small hand-rolled router (`usePath`, `navigate`, `Link`), the `useLayout` hook (phone, tablet, desktop from one set of breakpoints), and a Not found page.
- Tests that guard the rules: no hex colors, font names, pixel sizes or media queries in components, and every control size at the 44 px tap minimum.
- Scryfall connector in `src/connectors/scryfall` behind a `GameConnector` interface in `src/core/connector.ts`: name lookup in batches of 75 by front-face name, typo-tolerant fuzzy lookup with candidates for ambiguous names, autocomplete, paginated paper printings mapped to the engine's `Printing`, a sets list cached for 7 days, and the store sort category (Magic: color). Requests are paced about 100 ms apart, retry 429 and 5xx with backoff, and send Accept and User-Agent headers.
- `resumableLookup`: a name lookup that saves progress after every batch, so an interrupted import resumes with only the missing names.
- Storage seam in `src/storage`: an `AppStorage` interface with an IndexedDB implementation (via `idb`) and an in-memory one. `createStorage` falls back to memory when IndexedDB is unavailable, and `persistent` tells the UI which one it got. Both pass the same contract tests.
- Decklist parser in `src/core/parse`: `parseDecklist` reads Moxfield, Archidekt, EDHREC and MTGO text (counts, set codes, collector numbers, foil tags, `#tags`, headers, sideboard and maybeboard sections) and `combineEntries` merges duplicate lines under the section toggles.
- Engine: `reopenStop` brings a finished stop's unfound cards back and keeps the frozen stop order. `Plan` now carries `order` and `left` to support it.
- Engine: `pullVerdict` labels plan stops "Worth a pull", "Buy online" or "Show staff" from `PullSettings` (default 2 copies or $10, in `pullSettings.ts`). It never changes routing.
- Routing engine in `src/core/engine`, copied from `reference/engine`: per-printing routing, scoring, plan building and Finish stop. `WEIGHTS` and `V1_STORE` are in their own modules. 29 Vitest checks, ported one for one from the reference tests, plus the missing 21c.
- Project scaffold: Vite, React, TypeScript (strict), Vitest, ESLint, GitHub Actions CI (lint, test, build).
- Design tokens in one place with a Magic theme, shared breakpoints, feature flags (v2 and v3 off) and a copy module.
- Footer on every page with the verbatim Fan Content disclaimer and the Scryfall credit, with a test that guards the wording.
- Cloudflare Pages config (SPA fallback and headers), MIT license, build plan in `docs/PLAN.md`.
