# Design reference

The mockups are layout and behavior specs, not production code and not final visual design. Colors, fonts and shapes are
placeholders for a later pass with a graphic designer; layout, wording, states and behavior are settled unless noted.

- **Live canvas:** https://claude.ai/artifact/2sQKpTFyiwdnzuoXk9haeA (in the owner's Claude account; ask for access or screenshots).
- **Static mockups:** open `design/mockups/index.html` in a browser. One HTML file per screen (107 files: states and the four game themes of Home included). They are snapshots, not a prototype: controls don't navigate. Add exported PNGs to `design/screens/` if you want images too.
- The board names below match the mockup files: `Board.dc.html` in the canvas is `Board.html` (or `Board.state.html`) in `design/mockups/`.
- Boards marked "switch Scenario in tweaks" show several states of one screen; the Game tweak switches the theme.

## Rules that apply to every screen
- **Breakpoints:** phone under 640 px, tablet 640 to 1100 px, desktop above. Desktop is a real desktop layout (sidebars, tables), not a stretched phone.
- **Store dive layouts:** desktop uses a left sidebar (binder dropdown with previous and next, lists to show, sort and filter) and a card grid; tablet uses a stacked toolbar and three columns; phone uses one stop at a time, two-column card tiles and a bottom action bar.
- **Tap targets** at least 44 px; primary actions near the bottom on phone.
- **Problems are inline** (banners and messages inside the screen). Dialogs only for delete, end trip and similar.
- **Undo toast** (5 seconds) after Found, status changes and deletes.
- **Words:** binder, pull, found, stop, show staff. "Worth a pull" and "Buy online" are labels, never buttons.
- **Card tiles** show the Scryfall image, name, set and number at the stop, price, and the list(s); no color dot since the image shows it.
- **Footer** on every page: the verbatim Fan Content disclaimer plus the Scryfall credit.
- **Itemized content placeholders** appear in square brackets; leave them.

## Game themes
Magic is the only live game. Themes are color families so each game's section feels distinct: Magic blues, Pokemon reds, Lorcana yellows, Yu-Gi-Oh purples. The hero emblem and a faint drifting anchor are original generic designs (Magic: a pentagon of five colored coral nodes, with the real mana symbols dropped in from the Mana icon font; Pokemon: droplet, bolt and flame; Lorcana: an antique inkwell; Yu-Gi-Oh: an obelisk and sun disk). A desaturated brass diving helmet sits in the background. Never use publisher logos or symbols.
Home hero: full screen, centered, parallax bubbles in three layers, "Why Binder Diver" cue below; header leads with **Store dive** as the main button and **My lists** as the secondary one.

## Components (see board 8, UI kit)
Buttons (primary, secondary, text, danger, disabled, icon), inputs (text, search, select, number, stepper, error state), switches, chips, color filter, radios and checkboxes, status labels, pull verdict labels, odds labels, quantity badge, progress bars, import step indicator, card tiles (to find, found, x4 in progress, all found, image missing), rows (card, binder, list card, set chip), banners (info, warning, error), undo toast, loading placeholders, menus, bottom sheets, dialogs, tour tips, phone tab bar, binder picker, logo and game anchors.

## Screens by number
### 1. Home

| Screen | Board file |
| --- | --- |
| Home: desktop | `Main.dc.html` |
| Home: phone | `Mobile.dc.html` |

### 1b. Import flow

| Screen | Board file |
| --- | --- |
| Import step 1, wishlist chosen: desktop | `Import1WishDesk.dc.html` |
| Import step 1, wishlist chosen: phone | `Import1WishPhone.dc.html` |
| Import step 1: desktop | `Import1Desk.dc.html` |
| Import step 1: phone | `Import1Phone.dc.html` |
| Import step 2: desktop | `Import2Desk.dc.html` |
| Import step 2: phone | `Import2Phone.dc.html` |
| Import step 3: desktop | `Import3Desk.dc.html` |
| Import step 3: phone | `Import3Phone.dc.html` |
| Import step 4: desktop | `Import4Desk.dc.html` |
| Import step 4: phone | `Import4Phone.dc.html` |

### 1c. Import problem states

| Screen | Board file |
| --- | --- |
| Import edge cases: desktop | `ImportStatesDesk.dc.html` |
| Import edge cases: phone | `ImportStatesPhone.dc.html` |
| Import problems in action: desktop (switch Scenario in tweaks) | `ImportInActionDesk.dc.html` |
| Import problems in action: phone (switch Scenario in tweaks) | `ImportInActionPhone.dc.html` |

### 2. My lists and list review

| Screen | Board file |
| --- | --- |
| Delete a list: desktop | `ListsDeleteDesk.dc.html` |
| List actions: phone | `ListsMenuPhone.dc.html` |
| List review: desktop | `ListReview.dc.html` |
| List review: phone | `ListReviewPhone.dc.html` |
| My lists, renaming: phone | `ListsPhone.dc.html` |
| My lists: desktop | `ListsDesk.dc.html` |

### 2a. Card status and bulk actions

| Screen | Board file |
| --- | --- |
| Bulk selection: phone | `BulkPhone.dc.html` |
| Card status and bulk actions: desktop | `StatusDesk.dc.html` |
| Card status sheet: phone | `StatusPhone.dc.html` |

### 2b. Card detail, dive plan, pull settings, no-binder cards

| Screen | Board file |
| --- | --- |
| Card detail in the store: phone | `CardDetailDivePhone.dc.html` |
| Card detail panel: desktop | `CardDetailDesk.dc.html` |
| Card detail: phone | `CardDetailPhone.dc.html` |
| Dive plan: values and no-binder cards, desktop | `PlanNoBinderDesk.dc.html` |
| No-binder cards: phone | `NoBinderPhone.dc.html` |
| Pull settings: desktop | `PullSettingsDesk.dc.html` |
| Pull settings: phone | `PullSettingsPhone.dc.html` |

### 2c. Binder groups

| Screen | Board file |
| --- | --- |
| Add a set to a group: phone | `GroupsAddPhone.dc.html` |
| Binder groups: desktop | `GroupsDesk.dc.html` |
| Binder groups: phone | `GroupsPhone.dc.html` |

### 3. Store dive

| Screen | Board file |
| --- | --- |
| Store dive: desktop | `DiveDesk.dc.html` |
| Store dive: phone | `Dive.dc.html` |
| Store dive: tablet | `DiveTablet.dc.html` |

### 3a. Binder picker and end trip

| Screen | Board file |
| --- | --- |
| Binder picker, finished binders: desktop | `DivePickerDesk.dc.html` |
| Binder picker, finished binders: phone | `DivePickerPhone.dc.html` |
| End trip confirmation: desktop | `EndTripDesk.dc.html` |
| End trip confirmation: phone | `EndTripPhone.dc.html` |

### 3b. Quantities and several lists

| Screen | Board file |
| --- | --- |
| Copies across lists, card detail: phone | `CardSplitPhone.dc.html` |
| Quantities and lists in the store: desktop | `DiveQtyDesk.dc.html` |
| Quantities and lists in the store: phone | `DiveQtyPhone.dc.html` |

### 3c. Four-place model (stops)

| Screen | Board file |
| --- | --- |
| Ask an associate stop: desktop | `AskDesk.dc.html` |
| Ask an associate stop: phone | `AskPhone.dc.html` |
| Display case stop: phone | `CasePhone.dc.html` |
| Dive plan by place: phone | `PlacesPlanPhone.dc.html` |
| Four-place model: dive plan, desktop | `PlacesPlanDesk.dc.html` |
| Show to staff, big text: phone | `StaffViewPhone.dc.html` |
| Stops picker: phone | `PlacesPickerPhone.dc.html` |

### 4. Trip end

| Screen | Board file |
| --- | --- |
| Trip end: desktop | `TripEndDesk.dc.html` |
| Trip end: phone | `TripEnd.dc.html` |

### 5. App states

| Screen | Board file |
| --- | --- |
| App states in action: desktop (switch Scenario in tweaks) | `StatesDesk.dc.html` |
| App states in action: phone (switch Scenario in tweaks) | `StatesPhone.dc.html` |

### 6. Walkthrough and first-time tour

| Screen | Board file |
| --- | --- |
| First-time tour in the store: desktop (switch Scenario) | `TourDesk.dc.html` |
| First-time tour in the store: phone (switch Scenario) | `TourPhone.dc.html` |
| Walkthrough page: desktop | `WalkthroughDesk.dc.html` |
| Walkthrough page: phone | `WalkthroughPhone.dc.html` |

### 7. About, Support, Privacy

| Screen | Board file |
| --- | --- |
| About page: desktop | `AboutDesk.dc.html` |
| About page: phone | `AboutPhone.dc.html` |
| Privacy page: desktop | `PrivacyDesk.dc.html` |
| Privacy page: phone | `PrivacyPhone.dc.html` |
| Support page: desktop | `SupportDesk.dc.html` |
| Support page: phone | `SupportPhone.dc.html` |

### 8. UI kit

| Screen | Board file |
| --- | --- |
| UI kit: every component and state | `UIKit.dc.html` |

## Notes for the build
- Mockup data is illustrative (card names, prices, counts). Real data comes from the engine.
- Sorting in the store is "binder order" by default: color (White, Blue, Black, Red, Green, Multicolor, Colorless, Land), then collector number; A to Z on show-staff stops.
- Tablet uses the desktop store dive behavior in a stacked layout; hover states are not needed anywhere.
- First-time tour highlight positions in the mockup are approximate.
