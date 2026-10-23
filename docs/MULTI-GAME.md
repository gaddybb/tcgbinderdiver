# More games: the design

Issue 85 (game-neutral card data and connectors). This is a design only: no code changes with it. It says how Pokémon, Lorcana and
Yu-Gi-Oh! can be added without rebuilding the app, and how Magic stays exactly as it is while that happens.

Related issues: 85 (this), 86 Pokémon, 87 Lorcana, 88 Yu-Gi-Oh!, 89 what a "binder" is in each game, 90 a look per game, 91 nightly data
per game, 92 licences and policies, 93 stores publishing their own setup.

## 1. What has to hold

1. **Magic does not change for the player.** The content of its data files, the routing result for every card and what a player sees stay
   the same at every step. This is checked, not hoped (section 8). The one visible-to-the-machine change is deliberate (owner decision,
   2026-10-23): every game, Magic included, keeps its data in its own folder, so Magic's files move from `/data/` to `/data/magic/`.
   A returning Magic player downloads the card data once more (about 3 MB gzip) after that step.
2. **A game is a first-class thing, chosen once.** One list belongs to one game. Everything a screen shows (cards, prices, binders,
   copy, accent) comes from the chosen game's definition.
3. **Data for a game is loaded only when that game is chosen.** The first load for a Magic player does not grow.
4. **Nothing promotes another game on a game's pages** (`CLAUDE.md`). The game choice may show "coming" games, as it does now.
5. **Each game has its own rules spec** for the routing engine, written from what store staff say (issue 89). Magic's spec stays as is.
6. **A source that fails never takes a game away.** The previous good data stays live (section 6).
7. **Only the seams in `CLAUDE.md` are used**: `GameConnector` for card data, the storage interface, the theme file per game, feature flags.
   No new dependency is needed.

## 2. Where the code assumes Magic today

| Place | What it assumes | What it becomes |
| --- | --- | --- |
| `src/core/catalog/types.ts`, `encode.ts`, `decode.ts` | Scryfall card fields; finishes are nonfoil, foil, etched; prices are USD triples; `colors`; `borderColor` and `frameEffects` in the details table | Rows are mostly neutral already (section 3). The Scryfall mapping moves into a source module; the meaning of each column moves into a per-game schema |
| `scripts/build-card-data.mjs` | Downloads Scryfall's Default Cards | Takes `--game`; the Scryfall part becomes one source among several (section 5) |
| `src/connectors/bulk/*`, `catalogLoader.ts` | Files at `/data/`, storage keys `catalog:*` | Take a game definition for the base path and the keys: `/data/<game>/` and `catalog:<game>:*`, Magic included |
| `src/connectors/scryfall/*` | The live fallback for names the catalog does not know | Stays Magic's fallback. Each game names its own fallback, or none |
| `src/core/connector.ts` (`GameConnector`) | Already per game (`game`, `sortOrder`, `sortCategory`) | Gains nothing but a contract written down (section 4) |
| `src/core/engine/*` | `Printing` has Magic fields; stops include the Commander box; weights and cutoffs are Magic's | Rules become a per-game object, Magic's is the default (section 7) |
| `src/core/cards/printingArt.ts`, `CardImage.tsx` | Picture and banner addresses are Scryfall's | Per-game `imageUrl` and `artUrl` on the definition |
| `src/core/buy/tcgplayer.ts` | `productline=Magic` | Per-game store link and Mass Entry line (to verify per game) |
| `src/core/parse/parseDecklist.ts` | Moxfield, Archidekt, MTGO text | Per-game line grammars (section 7) |
| `src/app/components/colors.ts` | Store-sort categories are the five colours, land, colorless, multicolour | Per-game categories and edge colours from the definition |
| `src/app/copy/en.ts` | "Magic", "Commander box", "card" wording in places | Per-game copy where it names the game |
| `public/sw.js`, `public/_headers`, `scripts/prebuild-data.mjs` | Hashed data files matched, cached and cleaned up at `/data/` | The same rules at `/data/<game>/` |
| `.github/workflows/refresh-data.yml` | One Scryfall build | One build per live game, with last-good data kept (section 6) |
| Lists, trips, store settings, hand-off link | No game on them | A `game` field, default `magic` (section 5) |

## 3. The card data format

The current format (`FORMAT_VERSION` 1) is almost game-neutral already. A card is
`[id, name, typeLine, colors, imageId, printings]`; a printing is `[setIndex, collectorNumber, rarity, finishMask, flags, extrasIndex]`;
prices are one row of cents per printing, aligned to the printings. Those columns fit every game below.

**Decision: keep format 1 and its files byte for byte; add what is missing to the manifest, not to the files.** Then Magic's
`cards.<hash>.json` and `prices.<hash>.json` cannot change by accident (only their folder does, section 5), and a golden test can prove it.

Manifest additions (all optional for old manifests, so a cached old manifest still loads):

```jsonc
{
  "format": 1,
  "game": "magic",                       // new; absent means "magic"
  "variants": ["nonfoil", "foil", "etched"],   // new; what the price slots and finish bits mean, in order
  "details": ["borderColor", "promoTypes", "frameEffects", "games"],   // new; what the details table columns are
  "builtAt": "...", "scryfallUpdatedAt": "...",   // the source's own timestamp; for another game its name differs ("sourceUpdatedAt")
  "counts": { "cards": 0, "printings": 0, "sets": 0 },
  "files": { "cards": "cards.<hash>.json", "prices": "prices.<hash>.json" }
}
```

How each column means something per game (a game's **schema** says it, and also says how a row becomes the engine's `Printing`):

| Column | Magic (today) | Pokémon | Lorcana | Yu-Gi-Oh! |
| --- | --- | --- | --- | --- |
| card id | oracle id | name plus dex or card group (one card, many sets) | card name (plus version) | card id |
| `typeLine` | type line | category and stage | type and subtypes | card type line |
| `colors` (a short store-sort facet) | colour letters | energy type | ink colour | monster type or card kind |
| printing | a set and collector number | a set and local number | a set and number | a set code such as `CT13-EN003` and its rarity |
| `rarity` | rarity | rarity | rarity | the set rarity (a value of its own) |
| variants (finish bits and price slots) | nonfoil, foil, etched | normal, reverse holo, holo | regular, foil | one slot (the rarity is the variant) |
| `flags` | promo, full art | promo | promo | none |
| details table | border, promo types, frame effects, games | regulation mark, variants | foil types | none (kept empty) |
| price unit | USD | USD (TCGplayer) and EUR (Cardmarket) | USD and USD foil (Lorcast), once a day | USD (TCGplayer, Cardmarket and others, per card and per set) |

Things this does **not** try to solve now: a second price currency. A game picks one price column (US dollars where a source has it), and
the manifest says which. Cardmarket euros for Pokémon wait for a real need.

**Fingerprints** for the phone link (`src/core/handoff`) hash the card name, so they work for any game; the receiver builds its index from
the chosen game's catalog.

## 4. The per-game contract

One object per game, in `src/core/games/<game>.ts`, registered in `src/core/games/index.ts`:

```ts
interface GameDefinition {
  id: 'magic' | 'pokemon' | 'lorcana' | 'yugioh';
  name: string;                 // 'Magic: The Gathering'; the header and copy use it
  live: boolean;                // false: shown as "coming", not choosable (today's behaviour for the three)
  dataBase: string;             // '/data/magic/', '/data/pokemon/' and so on: one folder per game
  variants: readonly string[];  // the same list the manifest carries
  schema: CatalogSchema;        // rows -> Printing, details meaning, set types
  facets: readonly string[];    // the store-sort categories in order, and their edge colour tokens
  imageUrl(printing, size): string | null;
  artUrl(name): string | null;  // the cropped art for deck banners, or null
  buy: { search(name): string; massEntry?(lines): string | null };
  decklist: DecklistGrammar;    // how a pasted line is read (section 7)
  rules: GameRules;             // the routing engine's rules (section 7)
  storeDefaults: StoreProfile;  // the fixed starting store for the game (v1: one store)
  liveFallback?: () => GameConnector;   // names the catalog does not know; Magic's is Scryfall's API
  sources: DataSource;          // used by the build script only
}
```

`GameConnector` (what the screens talk to) does not change. `BulkConnector` takes a `GameDefinition` and loads
`${dataBase}manifest.json`; its saved copy lives under `catalog:<game>:*` (Magic keeps `catalog:*`). A game with no live fallback answers
"not found" for names the catalog lacks, and the import's Fix names step handles it as it does today.

The theme is separate and already per game: a file in `src/app/theme/themes/<game>.css` sets `--game-accent` and the hero picture.

## 5. The build script and where the data goes

```
node scripts/build-card-data.mjs --game magic            # default; the same files as today, in public/data/magic/
node scripts/build-card-data.mjs --game pokemon          # public/data/pokemon/
npm run data                                             # every live game, one after another
```

- `scripts/sources/<game>.mjs` is the only per-game part of the script. It takes `{ headers, cacheDir, fixture }` and yields **slim
  printings** (the neutral shape `encodeCatalog` already takes), plus a source timestamp. It sends the accurate `BinderDiver/<version>`
  User-Agent and keeps downloads in `.cache/<source>/`.
- The pure part (mapping a source record to a slim printing) lives in `src/core/catalog/sources/<game>.ts`, with a small fixture and tests,
  so nothing needs the network to be checked. Magic's `slimCard` moves there unchanged.
- `encodeCatalog` and the manifest builder gain the game and its variants; the encoding itself is the same code.
- Output: every game writes to `public/data/<game>/`. Nothing is committed to the repo.
- **Moving Magic into its folder** (step 3) is the one change to a live path. Old clients are safe: a stale tab that asks for
  `/data/manifest.json` gets a 404, and the loader already answers that with its saved copy or the live API; the next page load gets the new
  build. The old saved copy (`catalog:*`) is deleted on first load, and the new one is downloaded once. No legacy copy of the files is kept.

**What each source gives** (checked 2026-10-21 and 2026-10-23, against the live services and their own documentation):

| Game | Source | Shape | Prices | Rules and notes |
| --- | --- | --- | --- | --- |
| Pokémon | TCGdex, `api.tcgdex.net/v2`, free JSON. The repo `tcgdex/cards-database` (MIT) is the fallback | A set lists its cards briefly; **detail and prices are one call per card**. The bulk GraphQL has no price field. The repo's `data/` is **TypeScript**, so it needs a build step | Per card: Cardmarket (EUR) and TCGplayer (USD) | About 24,000 cards in 220 English sets, so a full crawl is about 24,000 calls (about 40 minutes at 10 a second). The rate limit is not published: ask them before the first nightly run, and see "Crawl budget" below |
| Lorcana | **Lorcast**, `api.lorcast.com/v0` (REST, beta, free). LorcanaJSON (MIT, one 9.5 MB file, no prices) is the fallback | 26 sets; `/sets/{id}/cards` returns a whole set in one call (216 cards for set 1). Card fields look like Scryfall's: `prices.usd` and `usd_foil`, `rarity`, `collector_number`, `tcgplayer_id`, `released_at`, `image_uris` | Per card, USD and USD foil, **updated once a day** | About 30 calls a night. They ask for 50 to 100 ms between calls and caching for at least 24 hours; pictures come from `*.lorcast.io`, which has no rate limit. v0 is beta ("safe for production", breaking changes are announced on their Discord). Content is used under Ravensburger's Community Code Policy, which forbids charging for it: Binder Diver is free |
| Yu-Gi-Oh! | YGOPRODeck v7, `db.ygoprodeck.com/api/v7/cardinfo.php` | One call returns every card: its sets (set code, rarity, a price per set printing), per-card prices and picture links | Per card (Cardmarket, TCGplayer, eBay, Amazon, CoolStuffInc) and per set printing | **20 requests a second, and a one-hour block if exceeded.** They require data to be stored locally. **They forbid hotlinking pictures ("download and re-host the images yourself", or an IP blacklist).** Re-hosting about 13,000 cards' pictures needs somewhere to host them (Cloudflare R2 is the likely place), a sync job for new and changed pictures, and a licence check, because the pictures are Konami's |

**Crawl budget (Pokémon).** The one-call-per-card shape decides how it is refreshed. A weekly full crawl of the card data, and a nightly
price refresh for the sets of the last few years (the ones with set binders) plus any card whose last price was over the display-case
cutoff, keeps each night to a few thousand calls. The split is settled in step 7 after measuring, and after asking TCGdex what rate they
allow. The job runs in chunks and keeps what it has fetched in the Actions cache, so a failed night resumes instead of starting over.

An unconfirmed claim in the research note, "PokéWallet" covering twelve games on a free key, could not be checked (its site redirects). It is
not part of this design; revisit if a single price source for all games is wanted.

**Per-game identity of things the app stores** (so two games never mix):

- **Lists** gain `game` (absent means `magic`). A list's cards are looked up in that game's catalog.
- **Card keys** (`cardKey`, used by the saved card cache and trips) stay as they are for Magic. Other games' keys are prefixed `game:`; the
  `cards` and `trips` collections need nothing else, and no existing Magic data moves.
- **Store settings** are saved per game (the binder groups of one game mean nothing in another). Magic's keeps its key.
- **The hand-off link** carries the game as one more small field (absent means `magic`); an old link still opens.
- **The chosen game** is a per-device preference (the same hook the tours use), shown in the header select. Today the select shows Magic and
  the three "coming" games; a game becomes choosable when its definition has `live: true`.

## 6. Refreshing every night without losing a game

Today one job rebuilds and deploys, and a failed Scryfall download stops the deploy so the old site stays live. With more games a failure in
one must not take the others, or its own data, away. Design:

1. One job builds the live games one after another. Each build writes into a temporary folder.
2. A game whose build succeeds replaces its folder. A game whose build **fails** keeps its **last good build**, restored from a GitHub
   Actions cache saved after every success (key per game).
3. If a game has never had a good build, it is left out of that deploy and the app treats it as not live (its definition's `live` stays
   true but the manifest 404s, which the loader already turns into "use the live fallback or say the data is unavailable").
4. Any failure opens (or comments on) a GitHub issue labelled `data`, so the owner hears about it. Magic's rule does not change: a Magic
   failure still stops the deploy.
5. The job stays within each source's limits (paced requests, conditional download where the source offers one, nothing when the source's
   timestamp is unchanged).

## 7. Rules, decklists and the engine

**Engine.** `routeCard`, `buildPlan` and the verdicts take a `GameRules` object. Magic's, `MAGIC_RULES`, is exactly today's: stop kinds, the
weights, the cutoffs, the Commander box. It is the default argument, so every current call is unchanged, and the engine tests keep passing
untouched. A game's rules say: which stops exist (set binders, a display case, ask an associate, and only Magic has the Commander box), how
set age counts, which printings are special, how a printing's price and rarity weigh. Another game's first rules are conservative (recent
sets get a binder each, high value goes to the display case, the rest to ask an associate) and are rewritten from what store staff say
(issue 89) before that game is switched on.

`Printing` keeps its Magic-named fields (`borderColor`, `frameEffects`, `fullArt`, `promoTypes`); a game that has no such thing fills the
defaults. Renaming them is not worth the churn.

**Decklists.** `parseDecklist(text)` becomes `parseDecklist(text, grammar)`; Magic's grammar is today's and stays the default. The others:
Pokémon TCG Live export (`4 Pikachu ex SVI 57`), Lorcana's Dreamborn style (`4 Mickey Mouse - Brave Little Tailor`), Yu-Gi-Oh! (YDK card ids
and `3x Name` text). A print named on a line becomes a `PrintRef`, whose set and number mean what the game's schema says.

## 8. Proving Magic did not change

1. **Golden data test.** Build the committed fixture with the current script and keep the SHA of `cards.<hash>.json` and
   `prices.<hash>.json` and the manifest minus its three new fields. Every step must reproduce them. A real build is compared once, by hand,
   before the step that moves the Scryfall code.
2. **Golden routing test.** The two sample decks (real printings fetched once, saved as a test fixture) route to the same stops, printings
   and prices before and after the engine takes `rules`.
3. **The existing suite** (1,255 tests) passes unchanged at each step; a step that has to edit an existing test says why in its PR.
4. **Checked in a browser** at each step that touches the loader or the service worker, on a cold and a warm cache.

## 9. Steps (each its own PR, with tests; nothing here ships a second game)

1. **The game definition and the registry.** `src/core/games` with `GameDefinition` and Magic's definition built from what the code does
   today. No behaviour change. Adds `game`, `variants` and `details` to the manifest; the golden data test lands here.
2. **The build script takes `--game`.** Magic's source moves into `scripts/sources/scryfall.mjs` and `src/core/catalog/sources/scryfall.ts`.
   `npm run data` loops the live games (just Magic). Golden test proves identical files.
3. **The loader and connector take a definition, and Magic moves into `/data/magic/`.** Base path and storage keys come from the definition;
   the service worker, `_headers` and the build's clean-up use `/data/<game>/`; the old saved copy is deleted on first load. The card data
   is byte-identical, only its folder changes. Checked in a browser on a cold cache, a warm one with the old copy, and offline.
4. **The game on lists, trips, store settings and the hand-off link; the chosen game as a preference.** Default `magic`; old data and old
   links work. The header select drives the preference (only Magic is choosable still).
5. **`GameRules` for the engine.** Magic's extracted unchanged; golden routing test.
6. **Last-good data and failure issues** in the nightly workflow (needs the two Cloudflare secrets already in use; adds an Actions cache and an
   issue step).
7. **Pokémon, behind a flag** (issue 86): source (the TCGdex API with the crawl budget above), fixture, schema, grammar, connector, rules from
   step 5's defaults, theme file, per-game copy, no switch on in the header until staff research (89) and policy checks (92) are done.
8. **Lorcana** (87): the same shape from Lorcast, a small and cheap source. **Yu-Gi-Oh!** (88) is moved to a later version (v5): it needs
   picture hosting and a licence check first.
9. **A look per game and the live game choice** (90), then **stores publish their own setup** (93) when the earlier work is in.

Steps 1 to 6 change nothing a player sees. A game is first visible at step 7 and only when its flag is turned on.

## 10. Decisions

Answered by the owner on 2026-10-23:

- **Magic moves to `/data/magic/`** with every other game: tidiness is worth the one-time move (step 3, above).
- **Pokémon's source: the TCGdex API read nightly**, as Magic reads Scryfall. The repo stays the fallback if the API proves unstable or too
  slow to crawl.
- **Lorcana: use Lorcast** (it has prices and a Scryfall-like shape); LorcanaJSON stays the fallback.
- **Pokémon goes first.** Lorcana follows. **Yu-Gi-Oh! is tabled to a later version (v5)** until picture hosting has an answer.

Still open:

- **Yu-Gi-Oh! pictures:** host them ourselves (Cloudflare R2 and a sync job; needs the licence read), or launch Yu-Gi-Oh! with no pictures
  at first (name, set code and rarity on each tile). Both are workable; neither is chosen.
- **Pokémon crawl rate:** ask TCGdex what they allow before the first nightly run.
- **Prices in euros:** Pokémon has Cardmarket euro prices too; they are left out until there is a reason (one currency per game).

## 11. Risks

- **Store habits differ per game** and Magic's rules may not carry over; step 7 does not switch a game on before issue 89 is answered.
- **Licences and policies** differ per game and per data source (issue 92): a disclaimer per publisher, attribution, and image rules.
- **A beta API** (Lorcast v0) can change without much notice; the LorcanaJSON fallback and the source module's fixture test limit the damage.
- **Data size:** Magic is about 3.0 MB gzip. Another game is loaded only when chosen, but a very large source would need the same
  measuring Magic got (`docs/DATA-PLAN.md`) before it ships.
- **A source changes its format.** Each source module has a fixture and a test that fails on a changed shape, and a failure is
  caught by section 6 before it reaches players.
