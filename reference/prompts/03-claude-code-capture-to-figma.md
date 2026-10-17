# Prompt for Claude Code: capture the mockups into Figma

Before running it: connect Figma's MCP server to Claude Code following Figma's developer docs, and serve the mockups:
`cd reference/design/mockups && python3 -m http.server 8080`.

```
I want the static Binder Diver mockups captured into Figma so my designer can edit them. Use the Figma MCP server's
capture-to-Figma capability and follow Figma's developer docs for Claude Code. If it isn't set up or needs a plan I don't
have, tell me exactly what's missing before doing anything else.

1. The mockups are served at http://localhost:8080 (index.html lists every page).
2. Capture these pages into one Figma file named "Binder Diver mockups", one Figma page per group, in this order:
   - UI kit: UIKit.html
   - Home: Main.magic.html, Mobile.magic.html
   - Import: Import1Desk, Import1Phone, Import2Desk, Import2Phone, Import3Desk, Import3Phone, Import4Desk, Import4Phone
   - Lists and plan: ListsDesk, ListReview, ListReviewPhone
   - Store dive: DiveDesk, DiveTablet, Dive, DiveQtyPhone
   - Stops: PlacesPlanDesk, CasePhone, AskPhone
   - Trip end: TripEndDesk, TripEnd
   (all .html)
3. Phone pages are 390 wide, tablet 820, desktop 1440. Capture at those widths if the tool allows, and tell me if it can't.
4. Don't change any file in the repo. When done, list what was captured, and anything that failed or looks wrong
   (broken layout, missing fonts, text split into pieces).
```
