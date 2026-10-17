# Getting the design into Figma

Source: Figma's post "From Claude Code to Figma: Turning production code into editable Figma designs" (read by the owner,
pasted into the chat). Not tested on these files yet.

## What the post says
- Claude Code (an MCP partner of Figma) can **capture a working UI from a browser, including localhost,** and turn it into
  **editable frames** on the Figma canvas.
- Each captured screen can be sent to Figma or copied to the clipboard and pasted into any Figma file.
- Several screens can be captured in one session, keeping their sequence, so whole flows land together.
- The reverse works through the **Figma MCP server**: give Claude Code a prompt and a link to a Figma frame to generate code
  informed by the design.

## What it doesn't say (check Figma's developer docs and MCP catalog first)
- Which Figma plan or seat is required (free or paid).
- Exact setup steps for Claude Code, and how viewport widths are chosen at capture time.
- Whether pages with fixed-width layouts (the phone mockups) come through cleanly.

## Plan
1. **Now: capture the static mockups.** `design/mockups/` is plain HTML, so it can be served from localhost.
   Serve it (for example `python3 -m http.server 8080` inside that folder), then ask Claude Code to capture pages with
   the prompt in `prompts/03-claude-code-capture-to-figma.md`. Nothing needs to be hosted online.
2. **In Figma:** organize frames by flow (one page per group) and turn repeated pieces into components. The UI kit page and
   the XD kit's `style-guide.md` list every component, size and state. Annotate, duplicate and compare variants there.
   Colors, type and shapes are placeholders for the designer.
3. **Later: capture the real app.** Once v1 runs on localhost or a staging URL, capture it the same way, so the Figma file
   tracks the built UI, not just the mockups.
4. **Round trip.** When the designer changes a frame, give Claude Code the frame link through the Figma MCP server and
   ask it to update the code. Keep behavior and logic in `reference/` as the source of truth; Figma frames define layout and look.

## Capture order (file names in `design/mockups/`)
| Figma page | Files |
| --- | --- |
| UI kit | `UIKit.html` (capture first and build components from it) |
| Home | `Main.magic.html`, `Mobile.magic.html` |
| Import | `Import1Desk.html`, `Import1Phone.html`, `Import2Desk.html`, `Import2Phone.html`, `Import3Desk.html`, `Import3Phone.html`, `Import4Desk.html`, `Import4Phone.html` |
| Lists and plan | `ListsDesk.html`, `ListReview.html`, `ListReviewPhone.html` |
| Store dive | `DiveDesk.html`, `DiveTablet.html`, `Dive.html`, `DiveQtyPhone.html` |
| Stops | `PlacesPlanDesk.html`, `CasePhone.html`, `AskPhone.html` |
| Trip end | `TripEndDesk.html`, `TripEnd.html` |
| States (later) | the `*.state.html` files such as `StatesPhone.offline.html` |

Widths: phone pages are 390 wide, tablet 820, desktop fluid (capture at 1440).

## Fallbacks if capture doesn't suit
- An HTML-to-Figma plugin (for example html.to.design): import each page by URL or file. Untested here; check its free limits.
- Screenshots placed in Figma as reference images (not editable).
- Rebuilding from `style-guide.md` and `artboards.csv` in the XD starter kit.
