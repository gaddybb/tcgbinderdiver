# Constraints the app must obey

Binding. Summarized from the Wizards of the Coast Fan Content Policy (page text dated 2017-11-15, pasted by the
owner), plus Scryfall, affiliate, privacy and naming rules from our design work. Re-read the live policy before launch.
This is not legal advice.

## Wizards of the Coast Fan Content Policy
- **Free means free.** No payments, surveys, downloads, subscriptions or email registration required to use the app. Do not sell or license the app to third parties. It must be free for anyone (including Wizards) to view, use and share.
- **Allowed income:** sponsorships, ad revenue and donations, as long as they don't interfere with people's access. Keep ads out of the store dive screens.
- **Sponsors:** don't promote Wizards' competitors; label sponsors as sponsors; keep mentions short; never associate Wizards with a sponsor. TCGplayer sells other games too: Magic pages link only to Magic cards and never advertise other games.
- **Disclaimer on every page** (footer), verbatim, with the product title:

  > Binder Diver is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.

  Also credit Scryfall as the data source.
- **No Wizards logos or trademarks.** Don't use the Magic logo, the Planeswalker symbol or "MTG" in the name or branding. The page lists protected marks as images; check it before using any icon. Do not remove copyright or trademark notices from card images.
- **Cards, art and mana symbols are usable game content** in free fan content. Show card images as provided (artist credit and copyright line intact). Mana symbols come from the Mana icon font by Andrew Gioia.
- **Wizards can revoke permission at any time.** Keep costs near zero and don't assume permanence.
- **Optional accounts only:** anything that works without sign-up must keep working without sign-up.
- No sexist, racist or otherwise offensive content; keep it clean (kids play).
- Other games (Pokemon, Lorcana, Yu-Gi-Oh) have their own publishers and policies; read each before adding a game. Don't promote other games on Magic pages.

## Scryfall
Changed 2026-10-17 by the owner (see `docs/DATA-PLAN.md`): card data now comes from Scryfall's daily bulk file instead of
per-card API calls. Terms below were read from scryfall.com/docs/api on that date.
- **Card data** comes from Scryfall's bulk file (Default Cards), slimmed at build time into static files on our own site.
  The live API is used only for what bulk data can't do: cards newer than the last build and typo matching.
- **Live API calls** come from each user's browser, paced (about 100 ms apart) and cached. Send an `Accept` header and
  **keep the browser's own `User-Agent`** (Scryfall: "keep the browser's User-Agent intact"); never set a custom one from
  browser code. Build scripts send an accurate app `User-Agent` such as `BinderDiver/1.0` and `Accept`.
- **Never proxy Scryfall's API, and never simply repackage or republish their data.** Our software must create additional
  value for players (the routing). The slimmed files are app assets, not a public data product or API.
- **Prices are estimates.** Scryfall: bulk prices "should be considered dangerously stale after 24 hours" and are only for
  trends or a general estimate. Refresh prices at least daily, show when they were last updated, and never present them as exact.
- Don't put Scryfall data behind a paywall. Show images unmodified (don't cover the copyright or artist line, distort, blur
  or crop). Credit Scryfall on every page. Don't use the Scryfall name or logo in a way that implies endorsement.
- See `engine/scryfall-integration.md` for the data and calls. Verify current terms at https://scryfall.com/docs/api.

## Affiliate and sponsors
- TCGplayer's program runs through Impact. First-click attribution, 48-hour window, whole cart credited, payouts about 45 days after month end (as stated by TCGplayer to the owner).
- Every Buy on TCGplayer button carries an affiliate disclosure next to it: "Affiliate link: Binder Diver may earn a small commission." The Privacy page repeats it.
- Apply to the program before building v2. Ask Wizards (via the support site named in the policy) if affiliate income becomes significant.

## Privacy and analytics
- Lists, statuses, groups and settings are stored on the device only in v1; nothing is sent to a server.
- GA4 via Tag Manager only after the player allows analytics (consent banner with Consent Mode for EU and UK). The app behaves identically either way. No card names or list contents in any event.
- Nearby-store search sends approximate location to Google Maps only when the player taps it; show Google attribution.
- Privacy page copy in the design is a draft: have it reviewed before launch.

## Naming and brand
- Name: Binder Diver. Use "TCG Binder Diver" in page titles and descriptions to avoid the "binder divider" search correction. Domain: tcgbinderdiver.com (not yet bought).
- "Binder Finder" belongs to another tool: avoid it and "LGS Binder Finder".
- Game anchors and the helmet are original generic art (a pentagon of coral nodes, droplet/bolt/flame, an inkwell, an obelisk). Never copy a publisher's symbols.
- Placeholders in square brackets are the owner's to fill; never invent them.

## Accessibility baseline
Tap targets at least 44 px, visible focus, labels on every control, progress and status conveyed by text not color alone, motion stops when the user prefers reduced motion, contrast checked after the visual design pass.
