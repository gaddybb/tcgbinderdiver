# Binder Diver: reference materials

Everything a coding agent (Claude Code) or a project assistant (Cowork) needs to build Binder Diver v1 without
re-asking questions. Written 2026-10-17. Nothing here is production code except `engine/`.

**What Binder Diver is:** a free, phone-first web app that tells a Magic: The Gathering player which store
binders to pull, and what to look for in each, for every card on their lists. It replaces a Google Sheets +
Apps Script tool. It predicts where cards are likely to be from print history; it never sees store stock.

## Folder map

| Path | What it is | Authority |
| --- | --- | --- |
| `policy/constraints.md` | Fan Content Policy, Scryfall, affiliate and privacy rules the app must obey | Highest: never violate |
| `engine/routing-engine-spec.md` | The routing logic: store profile, locations, scoring, plan, tests | Source of truth for logic |
| `engine/engine.ts`, `engine.test.ts` | Verified reference implementation (strict TypeScript, 23 test cases pass) | Start `src/core` from this |
| `engine/scryfall-integration.md` | Which Scryfall calls to make and how | Source of truth for data fetching |
| `engine/source-drafts/` | Two AI-drafted specs the engine was built from, with known bugs | Context only, do not implement |
| `product/product-brief.md` | Who it's for, journey, principles, roadmap v1 to v3, risks | Why we're building it |
| `product/v1-scope-and-decisions.md` | v1 features, every product decision, open questions, v2 and v3 items | Source of truth for scope |
| `design/README.md` | Index of every mockup screen, design rules, themes, components | Layout and behavior spec |
| `design/figma-workflow.md` | How to get the mockups, and later the built app, into Figma through Claude Code | Convenience |
| `legacy-sheet/` | The Google Sheet and script being replaced, and how they behave | Port parsing and import; routing is replaced |
| `prompts/` | Ready-to-paste first prompts for Claude Code | Convenience |

## If two files disagree

1. `policy/` beats everything.
2. `engine/routing-engine-spec.md` beats `legacy-sheet/` and `source-drafts/` on routing and ranking.
3. `product/v1-scope-and-decisions.md` beats `design/` on scope; `design/` beats it on layout.
4. Placeholders in square brackets (for example `[CONTACT EMAIL]`) are blanks the owner fills in. Never invent them.

## Working agreements

- Phone first, desktop and tablet are real experiences, not stretched phones. Breakpoints: phone under 640 px, tablet 640 to 1100 px, desktop above.
- No account required for anything. Lists and settings live in the browser (IndexedDB or localStorage behind a storage interface) so accounts (Supabase, v3) can be added later.
- Free forever: no paywalls, subscriptions, required sign-up or required downloads.
- Core logic is pure TypeScript with no React, no fetch and no clock reads; pass `now` in.
- Every tap target is at least 44 px. Problems show inline in the screen they affect, not as pop-ups.
- Small PRs, tests with every rule, CHANGELOG entry per feature, semantic versions starting at 0.1.0.

## CLAUDE.md

A ready `CLAUDE.md` ships next to this folder (in the zip it sits beside `reference/`). Put it at the repo root. It tells Claude Code to read this folder first, build for easy mass edits (tokens, copy, engine config, one component per UI-kit item, a kit gallery route) and never break the policy rules.

## Not in this folder yet

- PNG screenshots of the mockups (static HTML versions are in `design/mockups/`; add images to `design/screens/` if you want them).
- Trademark list from Wizards' FAQ (images in the policy page; check it before choosing any icon).
- Real store feedback on the four-place model (see open questions in `product/v1-scope-and-decisions.md`).
