# Routing engine spec (v1)

Source of truth for how Binder Diver decides where each card is most likely to be in a store. Reference
implementation: `engine.ts`. Tests: `engine.test.ts` (23 cases, 29 checks, all pass; compiles with `tsc --strict`).
Port both into `src/core` as the first commit, then wire the UI to them. `engine.test.ts` uses a tiny `check()` harness so it runs with plain node (compile with `tsc --strict --target es2020 --module commonjs`, with Node types for `process`); port the cases to Vitest `it()` blocks one for one.

## Summary
The engine sends every needed card to the store stop where a copy is most likely to be, with a confidence score and a
ranked list of backups, using one fixed v1 store profile that later becomes per-store toggles.

- Input: each card's paper printings from Scryfall, plus a store profile.
- Output: per card, a ranked list of stops (Look here first, then Also try); per trip, an ordered list of stops with cards, copies and value.
- Stops in v1: set binders, Commander box, Display case, Ask an associate.
- Pure and deterministic: same inputs and same `now` give the same plan. Never read the clock inside the engine.
- Stable mid-trip: stop order is frozen when a trip starts. Finishing a stop only moves that stop's unfound copies.

## Inputs (one Scryfall card object per printing)
| Engine field | Scryfall field | Notes |
| --- | --- | --- |
| setCode | set | lowercase; matched against binder groups and Not carried |
| setName | set_name | shown to people |
| setType | set_type | expansion, core, commander, masters, box, promo, ... |
| releasedAt | released_at | per printing; unknown date counts as old |
| rarity | rarity | common, uncommon, rare, mythic, special, bonus |
| collectorNumber | collector_number | shown on tiles and staff lists |
| finishes | finishes | nonfoil, foil, etched; each finish is its own candidate |
| prices | prices.usd, usd_foil, usd_etched | strings or null; the price of that finish only; non-numeric strings count as unknown |
| promo, promoTypes | promo, promo_types | special printing |
| frameEffects, borderColor, fullArt | frame_effects, border_color, full_art | showcase, extended art, borderless, full art |
| digital, games | digital, games | drop digital printings and any without paper |
| typeLine | type_line | basic land detection on the front face |

Card-level inputs from the app: card name, needed copies per list, which lists are on for this trip.

## Store profile (v1 defaults in `V1_STORE`)
| Field | Default | Effect |
| --- | --- | --- |
| usesDisplayCase | true | off: expensive printings fall through |
| displayCaseMin | 15 | USD at or above goes to Display case |
| hasCommanderSection | true | off: Commander products route like other sets (and so to Ask an associate) |
| usesSetBinders | true | off: no set binders |
| setBinderMaxAgeYears | 3 | main sets newer than this get their own binder |
| usesValueBinders | false | on: value tier becomes its own stop instead of Ask an associate |
| valueBinderMin | 5 | splits older cards into value-binder and bulk hints |
| binderGroups | [] | named groups of set codes sharing one binder; groups ignore the age cutoff |
| notCarried | [] | printings in these sets are ignored |
| includeBasicLands | false | off: basic lands are skipped |
| acceptFinishes | nonfoil, foil, etched | finishes the player will take |

Pull thresholds (worth a pull at 2+ copies or $10+) are pull settings; they label stops and never route cards.

## Locations and stops
| Location | v1 stop | Walking order | How the stop works |
| --- | --- | --- | --- |
| set_binder | one stop per set or binder group | 1, most copies first, then newest, then name | flip through; sorted by color then number |
| commander_box | Commander box | 2 | flip through; sorted by color |
| value_binder | Ask an associate, hint "value binders" (own stop when usesValueBinders) | 3 | show staff |
| display_case | Display case | 4 | show staff |
| bulk | Ask an associate, hint "bulk boxes" | 5 | show staff |

Everything the player can flip alone comes first; the counter is visited once with one combined list.

## Algorithm
1. **Candidates.** Every paper printing (not digital, games includes paper, set not in notCarried) times every accepted finish. Basic lands skipped unless enabled. No candidates: status `no_stop` (goes to Buy the rest).
2. **Classify each candidate, first match wins.**
   1. usesDisplayCase and price at or above displayCaseMin: display_case.
   2. hasCommanderSection and setType is `commander`: commander_box.
   3. usesSetBinders and set code in a binder group: set_binder for that group (no age check).
   4. usesSetBinders, setType in (core, expansion, draft_innovation, masters) and age at most setBinderMaxAgeYears: set_binder for that set.
   5. price at or above valueBinderMin: value_binder.
   6. otherwise bulk.
3. **Score** = base(location) x rarity x finish x special x frame x unknown-price x age x price-fit, clamped 0 to 1 (table below).
4. **Rank stops per card.** Map candidates to stops; a stop's score is its best candidate (ties: lower price, then nonfoil). Sort by score, then walking order. First is Look here first; the rest are Also try (show up to 3).
5. **Build the plan.** Each card starts at its top unfinished stop; near ties (within 0.10) move to the busier stop (copy counts, one pass, no loops). Order stops: set binders by copies, newest, name; then Commander box, Display case, Ask an associate. Each stop gets copies, value (sum of each copy's candidate price) and a label. Order is frozen when the trip starts.
6. **Finish a stop.** Mark finished; each unfound copy there moves to that card's next unfinished stop; found cards leave; cards with nowhere left go to `no_stop`. Reopening brings back that stop's unfound copies.

## Weights (all in one `WEIGHTS` table; starting guesses, tune from real data)
| Factor | Applies to | Values |
| --- | --- | --- |
| Base | every candidate | display_case 0.85, set_binder 0.75, commander_box 0.65, value_binder 0.60, bulk 0.55 |
| Rarity | all but display_case | common 1.0, uncommon 1.0, rare 0.9, mythic 0.8, special or bonus 0.6 |
| Finish | every candidate | nonfoil 1.0, foil 0.7, etched 0.5 |
| Special printing | promo, any promo_types, set_type box, masterpiece, promo, memorabilia, funny, token, or set plst | 0.5 |
| Frame | showcase, extendedart, inverted, borderless, full art | 0.7 |
| Unknown price | that finish's price is null | 0.8 |
| Age | set_binder reached by the age rule (not groups) | max(0.6, 1 - years / 7.5) |
| Price fit | candidates with a price | (cheapest candidate price / this price) ^ 0.25, prices floored at $0.01 |

Worked example: a Foundations common, nonfoil, 1 year old, $0.25 and the cheapest copy scores 0.75 x 1 x 1 x 0.87 = 0.65. Its $16 original in the Display case scores 0.85 x (0.25 / 16) ^ 0.25 = 0.30, so the binder comes first and the case becomes Also try.

## Tuning and telemetry
- Record per card per stop (locally, then as GA4 events with no card names): location type, hint, set type, rarity, finish, price band, confidence shown, outcome (Found, Not available, unfound when the stop finished).
- If cards shown at 0.85 for the Display case are found 60% of the time, lower that base. Change only `WEIGHTS`, rerun tests.
- Watch the found rate for set binders by set age (is 3 years right?) and Display case by price band (is $15 right?).

## Known limits
- Confidences are guesses until real Found data exists. Cutoffs ($15, 3 years, $5) are assumptions to check with store staff.
- Commander detection is by `set_type` only; some Commander cards appear in non-Commander sets (and vice versa). Accepting that for v1.
- Stores that sort by color or A to Z are approximated by the hints on Ask an associate.
- Commander box sits below set binders (0.65 against 0.75; it was 0.80, above them). Owner feedback after v1: a box of mixed singles is a weaker place to send someone than a recent set binder, and a card that is also in a recent set (a Foundations card with a Foundations Commander reprint) belongs in that set's binder. A card whose only recent prints are Commander products still goes to the Commander box, which beats Ask an associate.

## Fixes versus the AI-drafted specs
| Problem in the drafts | Fix here |
| --- | --- |
| Commander detected by "commander" in legalities (true for nearly every card) or "not legal in Standard" (sends old Modern cards to Commander) | `set_type == commander` only |
| Hard-coded set code (snc) as a Commander signal | removed |
| One chosen printing routed, foil assumed known | every printing and finish is a candidate; best stop wins |
| No preference for the cheaper copy | price-fit factor |
| Unexplained fixed confidences | one weights table, tuned from Found rates |
| Thresholds disagree ($20, $25) | one profile: $15 case, 3-year binders, $5 value split |
| Group matching on names or mixed case | lowercase Scryfall set codes everywhere |

## Store profile fields reserved for v2
uses_display_case, display_case_min, uses_set_binders, set_binder_age_years, has_commander_section, uses_value_binders, value_binder_min, not_carried, binder_groups. Already in `StoreProfile`; v2 only adds a way to save one per store.
