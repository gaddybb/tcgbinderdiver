# v1 scope, decisions and open questions

Status on 2026-10-17: all v1 screens are designed (see `design/README.md`). The engine is specified and has a
verified reference implementation (`engine/`). Nothing is built yet. Turn each unchecked item into a Git issue.

## v1 features to build

### Lists and import
- [ ] Paste import for Moxfield, Archidekt and EDHREC text. Parse `1 Sol Ring`, `2x Sol Ring (CMM) 400 *F* #tag`: take count and name, drop set codes, collector numbers, foil tags and `#tags`. Skip blank lines and section headers.
- [ ] Four import steps: Name it, Look up cards, Fix names, What you own. Wishlist import has three (no What you own) and skips cards already on the wishlist.
- [ ] Step 1 asks where cards go: New deck (named) or Wishlist (no name field). Sideboard and maybeboard sections are off by default with a toggle each. Duplicate lines combine into one entry with a quantity.
- [ ] Fix names: several matches grouped under "Needs your pick" (tabs on desktop, 1-of-N pager on phone); not-found names use live card-name autocomplete; spellings fixed automatically show with Undo.
- [ ] Per-card status at import: Needed, In collection, Ordered, Proxy, Out of deck, with Set all to and Reset to needed.
- [ ] Limits and errors: 250 cards per list (split in two or keep first 250), empty paste, no card names found, Scryfall trouble with retry, resume banners on My lists if a lookup was interrupted.
- [ ] Sample deck: a small built-in set of popular decks, one picked at random; skips import, opens the plan with a banner (Paste my own list, Try another).

### Managing lists and cards
- [x] My lists page: list cards with In next dive switches, next-dive summary, Paste a new list. List menu: Rename (inline), Duplicate, Copy as text, Delete (with confirmation). One wishlist always exists (Clear wishlist instead of Delete).
- [x] Card status menu and bulk actions (select mode: Set status, Copy to list, Remove; quick actions Mark all owned or needed, Select by binder).
- [ ] Card detail: big image, quantity, status, Look here first, Also try by odds, all printings with odds; opens from lists and from the store (with a Found button).
- [ ] Quantity per card per list; the same card on several lists shows as one card in the store with copies found, Found +1, undo, and a per-list split in card detail.
- [ ] Basic lands are off the hunt by default (switch in pull settings).

### Plan and stops
- [ ] Routing engine exactly as `engine/routing-engine-spec.md`. Four stops: set binders, Commander box, Display case, Ask an associate. Starting values: display case at $15, set binders for sets under 3 years old, Commander is one box.
- [ ] Dive plan grouped by stop type with counts, value and verdict: Worth a pull or Buy online for flip stops, Show staff for the counter stops. Walking order: set binders (most copies first), Commander box, Display case, Ask an associate.
- [ ] Pull settings: pull order (Balanced, Most cards, Newest sets), worth-a-pull rule (at least N cards OR at least $X), basic lands, with a live preview.
- [ ] Binder groups editor: named groups of sets that share one binder, Not carried group, sets-without-a-group list, suggestions (Commander sets first). Match on Scryfall set codes.
- [ ] No-binder cards list with reasons, Buy on TCGplayer, See printings.
- [ ] Lists in this dive switches (same setting on My lists, the plan and the store).

### In the store
- [ ] Store dive on desktop (sidebar), tablet and phone: stop dropdown with previous and next, list toggles, sort and filter (color, price, collector number, A to Z), card image tiles with Found, progress counted in copies.
- [ ] One Finish binder action: unfound copies move to each card's next stop; stop order stays frozen all trip; Reopen a finished stop from the picker.
- [ ] Show-staff stops (Display case, Ask an associate): list sorted A to Z, big names, Found or Not available per card, "likely in value binders / bulk boxes" hints, big-text view to hand over the phone. Not available cards go to Buy the rest.
- [ ] End trip confirmation; trip summary; Buy the rest (copy leftover list in TCGplayer Mass Entry format); nearby stores with a map; Back to my lists; Start a new trip (resets stops).
- [ ] QR hand-off from desktop to phone: the list travels inside the link until accounts exist.

### Pages, states and trust
- [ ] Home with game theming (Magic only live; others "coming"), walkthrough with FAQ, first-time tour (welcome plus three tips, replayable), About, Support (Ko-fi), Privacy.
- [ ] App states: first visit, loading, nothing left to find, no binders left, offline, card data unavailable, image missing, install prompt (once, after first trip), cookie choice.
- [ ] Offline: a loaded plan and dive keep working from saved data.
- [ ] Footer on every page with the verbatim Fan Content disclaimer and Scryfall credit.
- [ ] GA4 through Tag Manager behind consent. Events: list pasted, plan viewed, stop finished (with found and unfound counts per stop type), card found, Buy the rest tapped. No card names or lists leave the device.

## Decisions (settled)
- Not here and Finish binder are one button, Finish binder. Every new trip resets stops.
- Save for later was removed; lists stay in the browser without an account.
- Store picker and saved stores are v2 or v3; set groups apply to every trip for now.
- Lists hold up to 250 cards in v1. Up to 25 lists. Collection-sized imports come later.
- Quantities and several lists: Found +1 fills lists top to bottom; card detail can put a copy on a specific list.
- Status words: Needed (still hunting), In collection (you own it), Ordered (on the way), Proxy (stand-in), Out of deck (cut, kept for reference). Only Needed counts.
- Pull verdict is a label, not a button: "Worth a pull" or "Buy online".
- Problems appear inline in their screen. Dialogs only for choices that can't be undone (delete, end trip).
- Toasts with Undo (5 seconds) after Found, status changes and deletes.
- Basic lands off the hunt by default.
- Magic only in v1. Architecture keeps a game connector interface so Lorcana and Pokemon can be added later.
- Sign-in in v3: Google plus email link; Discord later if asked.
- Support: Ko-fi. Analytics: GA4 via Tag Manager, with consent.
- Game color themes: Magic blues, Pokemon reds, Lorcana yellows, Yu-Gi-Oh purples. Game anchors are original generic designs, never publisher logos.

## Open questions for friends who hunt often
- How far back do set binders usually go at your stores (we assume 3 years)?
- Cheapest card ever seen in a display case; most expensive seen in a binder (we assume $15)?
- Is Commander one box everywhere, or split?
- When a card isn't in a binder, where do staff look?
- Do any stores sort by color or A to Z instead of by set?

## v2
- [ ] Buy links from the plan for Buy online and no-binder cards; per-card buy links.
- [ ] TCGplayer Mass Entry through the Impact affiliate link, labeled as an affiliate link. Still to check: whether the link itself can pre-fill the list. Credit lasts 48 hours (first click), payouts about 45 days after month end.
- [ ] Affiliate disclosure (already in the Privacy page copy) and GA4 affiliate events (Buy taps, cards sent).
- [ ] Saved stores with their own groups, not-carried sets and thresholds; store profile fields are already in the engine (value binders, display case, set binder age).

## v3
- [ ] Accounts (Supabase, Google and email link), sync lists, saved stores.
- [ ] Collection import (ManaBox CSV first, then Moxfield and Archidekt) replaces or upgrades the What you own step.

## Content placeholders to fill (never invent)
[ABOUT BEN], [CONTACT EMAIL], [FEEDBACK LINK], [DATE] (privacy policy), [SAMPLE DECK NAME], [STORE NAME n] in nearby stores. Privacy copy is a plain-language draft: have it reviewed before launch.
