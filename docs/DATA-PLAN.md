# Card data plan: Scryfall bulk data

Status: **proposed 2026-10-17, waiting for the owner's approval.** Nothing in this plan is built yet.
Approving means: merge this PR (it also updates `reference/policy/constraints.md` and `reference/engine/scryfall-integration.md`).

## Why change
Opening a list calls Scryfall's API once per card (plus pages for cards with many printings). From a browser those calls
carry an `Origin` header, and measured from the owner's machine on 2026-10-17 they were very slow: a GET without `Origin`
answered in 0.08 to 0.23 s, the same GET with one in 20 to 33 s, a CORS preflight in 27 s or a timeout, and the
75-name POST in 25 to 38 s (once a 503). The owner's spreadsheet is faster because Google's servers send no `Origin`.
Scryfall also publishes its whole card database as a free daily file, which removes the need for per-card calls.

## What was measured (Default Cards, 2026-10-17)
| | |
| --- | --- |
| Download | 79.7 MB gzipped, 10 s from the owner's machine (Scryfall's file server, not the API) |
| Lines / paper printings kept / unique cards / sets | 118,773 / 103,774 / 35,172 / 898 |
| Printings per card | 3.0 on average, most is Forest with 800 |
| Slimmed, one file with prices | 7.7 MB raw, **3.0 MB gzip**, 2.7 MB brotli |
| Slimmed, static data only | 6.4 MB raw, 2.7 MB gzip, 2.4 MB brotli |
| Prices only | 1.5 MB raw, **0.3 MB gzip** |
| Card names only (autocomplete) | 0.58 MB raw, 0.22 MB gzip |
| Image URLs | rebuildable from the printing id for all 103,774, so none are stored |

**Sharding is not worth it.** A random 100-card list would touch about 82 of 256 shards (1.1 MB in 82 requests), or 52 of
64 (2.5 MB), against 3.0 MB in one request. So: one static file, one prices file.

## Design
1. **Build script** `scripts/build-card-data.mjs` (Node, no new dependencies). Downloads the `default_cards` file named by
   `GET /bulk-data` with an accurate `BinderDiver/<version>` User-Agent, streams it, drops digital and memorabilia
   printings, and writes into the built site:
   - `data/cards.<hash>.json`: sets table plus cards `[oracleId, name, typeLine, colors, imageId, printings[]]`, where a
     printing is `[setIndex, collectorNumber, rarity, finishMask, flags, extrasIndex]`.
   - `data/prices.<hash>.json`: prices aligned to the printing order (cents, null when unknown).
   - `data/manifest.json`: build time, Scryfall's `updated_at`, counts and the two file names. Short cache; the hashed files are immutable.
   - The data format is documented and tested with a small fixture file, so the script can be checked without a download.
2. **Runs in the build.** `npm run build` runs the data step first, so every deploy ships fresh data. If Scryfall can't be
   reached the build fails and the previous deploy stays live (a retry is built in).
3. **Daily refresh.** A GitHub Action on a daily schedule rebuilds and redeploys, so prices are never older than about
   a day. It needs two Cloudflare secrets that the owner adds in GitHub (an API token and the account id). Nothing is
   committed to the repo.
4. **Bulk connector** (`BulkConnector`, implements the existing `GameConnector`, so screens and the engine don't change):
   downloads the manifest and files once, keeps them in IndexedDB (database version 2), and answers name lookup, printings,
   sets, sort category and autocomplete locally and instantly. It also works offline. Prices refresh by fetching only the
   0.3 MB prices file when the manifest says it changed.
5. **Live API stays for what bulk data can't do:** cards released since the last build (looked up by exact name with a
   plain GET) and typo matching for names the local data doesn't know. The paced, retrying client and `loadCards` from
   PR 9 and PR 12 remain as that fallback. Their per-card cache and 7-day refresh are retired for catalog cards.
6. **Prices are shown as estimates**, with "Prices from Scryfall, updated <date>" on the list review.

## What Scryfall's terms say (read 2026-10-17)
- Required headers: `Accept` always. From browser JavaScript, "keep the browser's User-Agent intact". **Our current client
  sets a custom one: that is wrong and is being removed in PR #12.**
- "You may not **simply repackage, republish, or proxy** Scryfall data. Your software must create additional value."
  A Cloudflare proxy is therefore ruled out. Hosting slimmed files as part of an app that adds value (the routing) fits
  the wording, but it is a grey area because the files are publicly fetchable. **Recommend asking Scryfall** (draft below).
- No paywall for Scryfall data. Images unmodified, copyright and artist line visible. Don't imply Scryfall endorses us.
- Bulk data is collected every 12 to 24 hours; prices are "dangerously stale after 24 hours" and only for trends or a
  general estimate; gameplay data (names, types) changes rarely.

Draft message to Scryfall (owner to send, from the contact page):
> We are building Binder Diver, a free web app that tells Magic players which store binders to pull from their decklists
> (it is not a card database or API). To avoid hundreds of API calls per user we plan to download your Default Cards bulk
> file daily at build time and serve a slimmed copy (names, types, printings and prices) as private static assets of the app,
> used only by the app and not offered as a data product. Card images stay on your servers, unmodified, with credit on every
> page. Is that acceptable, or would you prefer something different?

## PR steps (each small, with tests)
1. This PR: plan and policy edits. **(needs approval)**
2. PR #12 (speed-ups, plus removing the custom User-Agent). Already open.
3. Build script, data format and fixture tests; data written to the built site.
4. `BulkConnector` with the IndexedDB catalog; the list review reads from it; API fallback for unknown names; remove
   the per-card TTL path.
5. Daily refresh Action, prices refresh, "prices updated" date, manifest check.

## Decisions for the owner
- Approve this plan and the policy edits (merge this PR).
- Scryfall message: owner decided it is not needed, since Scryfall offers the daily bulk file for this use. The draft above is kept in case it is wanted later.
- Create the Cloudflare API token and add it, with the account id, as GitHub secrets (step 5). Never paste them in chat.
- Accept that a Scryfall outage at build time blocks that deploy (the old one keeps running).

## Risks
- Republishing grey area (above). Mitigation: ask, and keep the files undocumented app assets.
- First visit downloads about 3 MB; later visits only the 0.3 MB prices file. Acceptable on cellular.
- Parsing about 8 MB of JSON on a low-end phone: done once per visit and kept in memory; measure on a real phone in step 4.
- New cards before the next daily build use the live API, which may be slow; they are rare.
- The slimmed format is ours: if Scryfall changes a field, the build script's tests catch it on the next build.
