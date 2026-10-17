# The Google Sheet being replaced

Files: `Bens_Card_Finder_latest.xlsx` (the sheet, imported from Google Sheets; tab names were renamed by the owner) and
`Card_Finder_Code_latest.gs` (the bound Apps Script). Use them as the behavior reference for **import and parsing**.
**Do not port its binder ranking**: routing now follows `../engine/routing-engine-spec.md`.

## What the sheet does
1. One tab per list (up to 25, 250 cards each). Column A is status: TRUE, FALSE, ORDERED, PROXY, OUT OF DECK. Only FALSE or blank counts as needed.
2. Paste names into the name column. The script (Card Finder menu) looks each up on Scryfall by name and fills type_line, mana_cost, every paper set name, cmc, rarity, cheapest price, per-set prices, colors, oracle_text, scryfall_uri and an image link. A target_binder column shows where to look.
3. A Binder Plan tab ranks binders and lists the cards in each; Searched/No binder drops a binder and its cards move on; Reset clears it. Lists to search are switchable.
4. A Shop tab shows one binder's cards sorted White, Blue, Black, Red, Green, Multicolor, Colorless, Land, then name, with Found and Done boxes.
5. Set Aliases groups several sets into one binder or marks sets as `(none)` (not carried).
6. Phone controls: checkboxes trigger an installable edit trigger that can call Scryfall (simple triggers cannot).

## Behavior worth keeping in the web app
- **Line parsing:** `1 Sol Ring`, `2x Sol Ring (CMM) 400 *F* #ramp` produce count and name; strip set codes, collector numbers, `*F*`/`*E*` foil tags, `#tags`; skip blanks and headers.
- **Lookup:** `POST /cards/collection` in batches of 75 with the front-face name, then `fuzzy` for misses, writing back Scryfall's spelling; unfound names highlighted with a note.
- **Printings:** follow `prints_search_uri` with pagination; drop digital, non-paper and memorabilia; keep the cheapest price per set and overall; skip basics.
- **Rows already filled are skipped** on reruns; a force-refresh refetches prices.
- **Status vocabulary** (above) and "only Needed counts."
- **Binder never reshuffles mid-trip:** ranking recomputes only when lists, list toggles, aliases or the order mode change.
- **Stable, plain-language UI words:** pull, searched, not carried, bring back.

## Behavior being replaced
- Binder ranking by "could supply" count with Balanced, Most cards, Newest sets modes. (Balanced was `couldSupply x (0.25 + 0.75 x ageWeight x typeWeight)` with `ageWeight = 1 / (1 + years / 3)` and a set_type weight table.) The new engine ranks per printing by where a copy is most likely to be.
- Treating every set as its own binder forever. The new engine only makes set binders for sets under 3 years old and sends the rest to Display case, Commander box or Ask an associate.
- Per-binder Searched ticks on a hidden Binder Setup tab; replaced by Finish stop and Reopen.
- Manual Set Aliases tab; replaced by the Binder groups editor (set codes, Not carried).

## Lessons from building the sheet
- Name-based lookups need typo tolerance and a clear "fix names" step.
- Showing only binders with cards left, in a stable order, matters more than the exact ranking formula.
- Small cheap cards in old sets are why "buy online" and "ask staff" stops exist.
- Phone use drove every control to be a checkbox or dropdown; the web app should make those native buttons.
