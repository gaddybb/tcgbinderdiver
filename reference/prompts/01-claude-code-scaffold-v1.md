# First prompt for Claude Code

Paste this into Claude Code with the repo open (this `reference/` folder at the repo root).

```
You're building Binder Diver v1: a free, phone-first web app that tells Magic: The Gathering players which store
binders to pull. Read reference/README.md first, then policy/constraints.md (binding), engine/routing-engine-spec.md,
product/v1-scope-and-decisions.md and design/README.md.

Stack: Vite + React + TypeScript, Vitest, Cloudflare Pages (build `npm run build`, output `dist`). No backend. Save
everything in the browser through a small storage interface (IndexedDB), so accounts can be added later. MIT license,
CHANGELOG.md (Keep a Changelog), semantic versions from 0.1.0. A GitHub Actions workflow runs lint, tests and build on PRs.

Architecture:
- src/core: pure game-agnostic logic, no React, no fetch, no clock reads. Start from reference/engine/engine.ts and
  engine.test.ts: copy them in, port the tests to Vitest one for one, keep them passing.
- src/connectors/scryfall: the only game connector. Follow reference/engine/scryfall-integration.md. Define a
  GameConnector interface so Lorcana and Pokemon can be added later.
- src/app: the UI. Match the screens in reference/design/README.md (phone, tablet and desktop layouts).

Work plan: first reply with the folder structure, core types and a list of PR-sized steps, then wait for my OK.
Suggested order:
1. Repo scaffold, CI, license, CHANGELOG, the verbatim Fan Content disclaimer component, deploy preview.
2. Engine into src/core with the Vitest suite.
3. Decklist parser (counts, set codes, foil tags, #tags, headers, sideboard and maybeboard sections, duplicates) with tests.
4. Scryfall connector with mocked-fetch tests (batch 75, fuzzy fallback, printings pagination, sets cache, pacing, resume).
5. Storage, lists, statuses and quantities (several lists, copies found).
6. Import flow (4 steps, wishlist variant, fix names, problem states).
7. Plan, pull settings, binder groups, no-binder cards.
8. Store dive (stops, Found +1, Finish stop with frozen order, Reopen, show-staff stops, trip end).
9. Pages: home, walkthrough and tour, About, Support, Privacy, app states, offline.

Rules: small commits, tests with every rule, ask before adding dependencies beyond React, Vite, TypeScript, Vitest and an
IndexedDB helper. Never invent text in [square brackets]; list those in the PR description. Treat the Fan Content
Policy constraints as requirements, not suggestions.
```

## Follow-up prompts
- "Implement step N from your plan. Show the test list first, then the code."
- "Compare the phone Store dive against board 3 in design/README.md and list gaps before changing anything."
- "Tune the weights: here are 30 recorded outcomes (Found or Not available per location type). Propose WEIGHTS changes and show which tests change."
