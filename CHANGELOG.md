# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Storage seam in `src/storage`: an `AppStorage` interface with an IndexedDB implementation (via `idb`) and an in-memory one. `createStorage` falls back to memory when IndexedDB is unavailable, and `persistent` tells the UI which one it got. Both pass the same contract tests.
- Decklist parser in `src/core/parse`: `parseDecklist` reads Moxfield, Archidekt, EDHREC and MTGO text (counts, set codes, collector numbers, foil tags, `#tags`, headers, sideboard and maybeboard sections) and `combineEntries` merges duplicate lines under the section toggles.
- Engine: `reopenStop` brings a finished stop's unfound cards back and keeps the frozen stop order. `Plan` now carries `order` and `left` to support it.
- Engine: `pullVerdict` labels plan stops "Worth a pull", "Buy online" or "Show staff" from `PullSettings` (default 2 copies or $10, in `pullSettings.ts`). It never changes routing.
- Routing engine in `src/core/engine`, copied from `reference/engine`: per-printing routing, scoring, plan building and Finish stop. `WEIGHTS` and `V1_STORE` are in their own modules. 29 Vitest checks, ported one for one from the reference tests, plus the missing 21c.
- Project scaffold: Vite, React, TypeScript (strict), Vitest, ESLint, GitHub Actions CI (lint, test, build).
- Design tokens in one place with a Magic theme, shared breakpoints, feature flags (v2 and v3 off) and a copy module.
- Footer on every page with the verbatim Fan Content disclaimer and the Scryfall credit, with a test that guards the wording.
- Cloudflare Pages config (SPA fallback and headers), MIT license, build plan in `docs/PLAN.md`.
