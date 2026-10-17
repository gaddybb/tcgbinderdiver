# Product brief

## Pitch
Stop researching, start finding. Paste a decklist and Binder Diver shows the store binders most likely to have your
cards, best pull first, then walks you through the store one stop at a time.

## Problem
Building a non-precon deck means hunting dozens of singles. Today that takes hours of looking up printings on
Scryfall, then flipping binders on a hunch, and sometimes paying shipping online for cards that were in the store.

| Alternative today | Why it falls short |
| --- | --- |
| Search Scryfall card by card | Hours per deck; no sense of which binder covers the most cards |
| Flip every binder | Slow; staff and other customers wait on the binders |
| Ask staff | They know the binders, not your 80-card list |
| Buy everything online | Shipping and waiting; skips the local store |
| The Google Sheet this replaces | Works, but needs setup most players won't do |

## Who it is for
| Persona | Needs | Release |
| --- | --- | --- |
| New deckbuilder (primary): newer or returning player upgrading past precons, shops at one or two stores, builds in Moxfield or Archidekt | A short list of binders and what to look for, without learning every set | v1 |
| Busy brewer: several decks and a wishlist at once | One pull list across all lists, easy way to buy what's missing | v1, v2 |
| Collector-builder: owns a big tracked collection | Owned cards skipped automatically, lists synced | v3 |
| Traveler: visits unfamiliar stores | A plan for a store they've never seen, fast | v1 |

Not for: competitive players buying exact printings online, collectors chasing specific foils or alt-arts, store owners managing inventory.

## What it is not
Not a store inventory system (it predicts, it can't see stock). Not a deck builder. Not a marketplace or price tracker.

## Customer journey
| Stage | What the player does | Release |
| --- | --- | --- |
| Discover | Hears from a friend; link opens straight into the app | v1 |
| First use | Pastes a decklist from Moxfield, Archidekt or EDHREC; no account | v1 |
| Prep at home | Marks owned cards, picks which lists to hunt, checks the plan | v1 |
| At the store | Works through stops one at a time, taps Found | v1 |
| After the trip | Buys what wasn't found: TCGplayer in one tap, or another nearby store | v2 (copy list in v1) |
| Come back | Next deck or another store; lists and owned cards remembered | v3 |
| Share | Tells their playgroup | v1.x |

## Design principles
1. One hand, one glance: the store screen is used standing at a counter holding a binder.
2. Value before setup: a pasted list shows a plan right away.
3. Never reshuffle mid-trip: marking a card found never reorders stops.
4. Every action can be undone.
5. Plain player words: binder, pull, found. No code jargon.
6. Works with bad signal: a loaded plan keeps working offline.

## Roadmap
- **v1, the sheet as an app:** free, no account, phone first. Paste lists, automatic stops, plan, store dive, store set groups, offline, About, walkthrough, tip jar.
- **Gate:** friends keep using it on real trips; domain bought; TCGplayer affiliate approved.
- **v2, buy the rest:** trip summary of leftovers, TCGplayer Mass Entry through an affiliate link (labeled), buy links for cards marked Buy online.
- **Gate:** players ask to keep lists across devices.
- **v3, remember me:** optional sign-in (Google, email link), list sync, collection import (ManaBox CSV, Moxfield, Archidekt), saved stores that sync.
- **Later, no dates:** Lorcana and Pokemon (each needs its own connector and publisher-policy check), shareable trip results, Archidekt deck links, real store stock (crowd-sourced from Found and Not available taps, or store partnerships).

Success signals: v1, friends use it on real trips and come back; v2, Buy the rest gets used; v3, signed-in players return across devices.

## Tech direction
Static web app on Cloudflare Pages (Vite, React, TypeScript, Vitest). Scryfall called from each user's browser. Browser storage in v1. Supabase (Postgres, row-level security, Google and email-link auth) in v3 with two projects, dev and prod, and a scheduled keep-alive so the free project doesn't pause. Domain: tcgbinderdiver.com (buy after the friends beta). Hostinger WordPress stays separate (blog or about page at most). Support via Ko-fi. Analytics: GA4 through Tag Manager, with a consent banner.

## Risks
| Risk | Handling |
| --- | --- |
| Fan Content Policy: free, disclaimer, no Wizards logos, revocable | See `policy/constraints.md` |
| Predictions may be wrong | Say "most likely"; Finish stop moves cards on; tune from Found rates |
| Scryfall limits and terms | Browser-side requests, paced and cached, credit shown |
| Search confusion ("binder divider") | Use "TCG Binder Diver" in titles; early links from Reddit and Discord |
| Free-tier pausing (Supabase) | Scheduled keep-alive; paid plan only if usage warrants |
