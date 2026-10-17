# Binder Diver: instructions for Claude Code

Binder Diver is a free, phone-first web app that tells Magic: The Gathering players which store binders to pull. It
predicts where cards are likely to be from print history; it never sees store stock.

**Read `reference/README.md` first.** It maps every reference file and says which wins when two disagree.
`reference/policy/constraints.md` is binding. Logic lives in `reference/engine/`. Scope and decisions live in
`reference/product/v1-scope-and-decisions.md`. Screens live in `reference/design/`.

## Build for easy mass edits
The visual design is not final (colors, type, shapes and some wording will change). Layout, behavior and logic are settled.
So nothing that may change gets scattered across files:

1. **Design tokens in one place.** Colors, fonts, radii, spacing and breakpoints are CSS variables or one theme file, with
   a theme per game (Magic is the only live one). No hex values, font names or pixel sizes in components. Values come from
   `reference/design/` and the XD kit's `style-guide.md` if present.
2. **Copy in one place.** Every user-facing string lives in one copy module (for example `src/app/copy/en.ts`), keyed by
   screen. Components reference keys. The Fan Content disclaimer and the content placeholders live there too.
3. **Engine knobs in config.** `WEIGHTS` and the store profile (`V1_STORE`) stay in their own modules, exactly as in
   `reference/engine/engine.ts`. Changing a number must never need a component edit.
4. **One component per UI-kit item.** Button, Chip, Switch, Input, StatusLabel, PullVerdict, OddsLabel, QuantityBadge,
   ProgressBar, StepIndicator, CardTile, ListRow, ListCard, Banner, Toast, Menu, Sheet, Dialog, TourTip, TabBar. Screens
   compose them and add no one-off styling.
5. **A kit gallery route** (for example `/kit`) shows every component in every state, mirroring `reference/design/` board 8, so
   a restyle is one visual check, not a hunt.
6. **Layout rules in one place.** Phone under 640 px, tablet 640 to 1100 px, desktop above, defined once and reused.
7. **Seams for later versions.** Storage behind an interface (IndexedDB now, Supabase in v3). Card data behind a
   `GameConnector` (Scryfall now, other games later). v2 and v3 features (affiliate links, accounts, saved stores) sit behind
   feature flags and are off in v1.
8. **Core stays pure.** `src/core` has no React, no fetch and no clock reads; pass `now` in.

## Process
- Propose the folder structure and PR-sized steps first, then wait for approval before building.
- Small PRs. Tests with every rule (port `reference/engine/engine.test.ts` to Vitest first). Add a CHANGELOG entry per feature.
- When a v1 item in `reference/product/v1-scope-and-decisions.md` ships, tick its checkbox in the same PR. Don't otherwise edit
  files under `reference/` unless the owner asks.
- Ask before adding any dependency beyond React, Vite, TypeScript, Vitest and an IndexedDB helper.
- List every `[square bracket]` placeholder you leave in the PR description. Never invent them.
- If a rule or number here conflicts with the reference folder, say so and stop; don't pick silently.

## Commands
Fill this in after the scaffold PR (expected: `npm run dev`, `npm test`, `npm run lint`, `npm run build`).

## Never
- Add a paywall, subscription, required sign-up or required download (Fan Content Policy).
- Remove or edit the Fan Content disclaimer, or use Wizards logos or trademarks, or "MTG" in names or branding.
- Send card names or list contents to analytics, or load analytics before consent.
- Promote other games on Magic pages.
- Change engine weights, cutoffs or routing rules without updating `reference/engine/routing-engine-spec.md` and the tests.
