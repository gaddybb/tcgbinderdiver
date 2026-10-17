# Binder Diver mockups (static HTML)

Static snapshots exported from the design canvas. Open `index.html` in a browser.

- One file per screen. Phone and tablet boards are fixed-width (390 px and 820 px); desktop boards are fluid, so resize the window.
- Screens with several states (import problems, app states, first-time tour) have one file per state, named `Board.state.html`.
- Home exists in all four game themes (`Main.pokemon.html` and so on); everything else is Magic.
- Buttons, links and tabs don't navigate or change state: native controls such as selects, checkboxes and details elements still work.
- Fonts (Fraunces, Karla) load from Google Fonts. Colors, type and shapes are placeholders for the visual design pass.
- Source of truth for behavior is `../README.md` and `product/v1-scope-and-decisions.md`.
