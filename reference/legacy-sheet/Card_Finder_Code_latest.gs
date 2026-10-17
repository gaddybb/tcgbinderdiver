/**
 * Card Finder (version 10)
 * Fills the green list tabs from Scryfall, builds the binder plan, and runs the Shop tab.
 * Replace ALL of your old Apps Script code with this file.
 */

const CF = {
  VERSION: '10',
  FIRST_ROW: 2,
  LIST_ROWS: 250,                 // cards per list tab (rows 2-251)
  LAST_ROW: 251,
  MAX_LISTS: 25,
  PRICE_MODE: 'cheapest',         // price_usd: 'cheapest' paper printing, or 'default'
  DELAY_MS: 100,                  // Scryfall asks for 50-100 ms between requests
  TIME_LIMIT_MS: 5 * 60 * 1000,   // stop before Apps Script's 6 minute cap

  VERSION_CELL: 'A2',

  PLAN_LABELS: 'I6:I30',          // list names (right panel), one per list
  PLAN_TOGGLES: 'J6:J30',         // Search it? checkboxes
  PLAN_FIRST_ROW: 6,
  PLAN_ROWS: 150,                 // rows 6-155
  PLAN_BINDER_COL: 2,
  PLAN_SEARCHED_COL: 7,
  RESET_CELL: 'G3',

  PLAN_BRINGBACK: 'B4',           // dropdown: bring a skipped binder back
  ORDER_LABEL: 'D4',
  ORDER_CELL: 'E4',               // dropdown: Balanced / Most cards / Newest sets
  ORDER_MODES: ['Balanced', 'Most cards', 'Newest sets'],
  SETINFO_COL: 14,                // Binder Setup N:P: set name, release date, set type (from Scryfall)
  SETINFO_ROWS: 1500,
  SETINFO_STAMP: 'Q1',
  PH_HEADER: 'I1',                // phone controls (Binder Plan I1:K4), work after Enable phone controls
  PH_FETCH: 'J2',                 // tick: fetch new cards on every list
  PH_SCAN: 'J3',                  // tick: find sets without a binder
  PH_AUTO: 'J4',                  // ticked: pasting names into a list fetches them automatically

  BINDER_ROWS: 400,
  BINDER_LAST: 401,
  BINDER_LIST: 'B2:B401',
  BINDER_SEARCHED: 'C2:C401',     // Searched or No Binder
  BINDER_POT_COL: 8,              // H: needed cards that could come from this binder

  SHOP_PICK: 'B3',                // binder dropdown
  SHOP_SHOWING: 'B4',             // binder actually shown
  SHOP_DONE: 'E3',                // Done with this binder
  SHOP_IMAGES: 'E4',              // Show images
  SHOP_FIRST_ROW: 6,
  SHOP_ROWS: 200,
  SHOP_KEY_COL: 8,                // H: Binder Data row of the card
  SHOP_IMAGE_HEIGHT: 90,

  ALIAS_RANGE: 'A2:B501',
  ALIAS_LAST: 501,

  LS_ID_COL: 11,                  // K: sheet id each list block was built for

  NOT_FOUND_COLOR: '#f4cccc',
};
CF.BD_LAST = 1 + CF.MAX_LISTS * CF.LIST_ROWS;   // 6251

/* ---------------- Finding the tabs (safe to rename) ----------------
 * Each tab the script uses is found by a tag it stores on the tab, then by its default name,
 * then by what's in its header cells. Renaming tabs is fine. */
const CF_ROLES = {
  readme:  { name: 'README',       sig: g => /^card finder$/i.test(g('A1')) },
  plan:    { name: 'Binder Plan',  sig: g => g('I5') === 'List' && g('J5') === 'Search it?' },
  shop:    { name: 'Shop',         sig: g => g('A5') === 'Found?' && g('H5') === 'key' },
  setup:   { name: 'Binder Setup', sig: g => g('B1').indexOf('Binder (auto') === 0 },
  aliases: { name: 'Set Aliases',  sig: g => g('A1').indexOf('Set name (as Scryfall') === 0 },
  data:    { name: 'Binder Data',  sig: g => g('A1') === 'Card' && g('B1') === 'Binder to pull' },
  lists:   { name: 'List Setup',   sig: g => g('A1') === 'List (tab name)' },
};
const CF_CACHE = {};

function cfSheet_(role) {
  if (CF_CACHE[role]) return CF_CACHE[role];
  const ss = SpreadsheetApp.getActive(), def = CF_ROLES[role];
  let sh = null, tagged = false;
  try {
    const md = ss.createDeveloperMetadataFinder().withKey('cf_role').withValue(role).find();
    if (md.length) { sh = md[0].getLocation().getSheet(); tagged = !!sh; }
  } catch (e) {}
  const fits = s => { try { return def.sig(a1 => String(s.getRange(a1).getValue()).trim()); } catch (e) { return false; } };
  if (!sh) sh = ss.getSheetByName(def.name);
  if (!sh) sh = ss.getSheets().find(fits) || null;
  if (sh && !tagged) { try { sh.addDeveloperMetadata('cf_role', role); } catch (e) {} }
  if (sh) CF_CACHE[role] = sh;
  return sh;
}

// Current tab names, quoted for formulas
function cfNames_() {
  const out = {};
  Object.keys(CF_ROLES).forEach(r => { const s = cfSheet_(r); out[r] = cfQ_(s ? s.getName() : CF_ROLES[r].name); });
  return out;
}

// Row 1 header text (any case) -> what the script writes there.
const CF_FIELDS = {
  name:           ['name', 'printed_name', 'card name'],
  count:          ['count', '#', 'qty', 'quantity'],
  type_line:      ['type_line', 'type line'],
  mana_cost:      ['mana_cost', 'mana cost'],
  set_name:       ['set_name'],
  cmc:            ['cmc', 'mana value'],
  rarity:         ['rarity'],
  price_usd:      ['price_usd', 'avg price', 'price', 'tcgplayer'],
  colors:         ['colors'],
  oracle_text:    ['oracle_text', 'oracle text'],
  scryfall_uri:   ['scryfall_uri', 'scryfall url'],
  set_prices:     ['set_prices'],     // one price per line, same order as set_name
  image_uri:      ['image_uri'],
  color_identity: ['color_identity'],
};
// Never written by fetch (formula column): target_binder

/* ---------------- Menu and triggers ---------------- */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Card Finder')
    .addItem('Fetch card data (this tab)', 'cfFetchActive')
    .addItem('Fetch card data (all lists)', 'cfFetchAll')
    .addSeparator()
    .addItem('Refresh ALL rows on this tab (prices too)', 'cfRefreshActive')
    .addItem('Refresh lists (after adding, renaming or moving a list tab)', 'cfSyncListsMenu')
    .addItem('Find sets without a binder', 'cfScanSets')
    .addSeparator()
    .addItem('Reset Searched / No Binder (new shop)', 'cfResetSearched')
    .addItem('Re-rank binders', 'cfRankBindersMenu')
    .addItem('Repair: rebuild all list formulas', 'cfRebuildAll')
    .addSeparator()
    .addItem('Enable phone controls (one time)', 'cfEnablePhone')
    .addToUi();
  cfSafe_(() => cfSyncLists_(false));
  cfSafe_(cfEnsureOrderControl_);
  cfSafe_(cfRankBinders_);
  cfSafe_(cfEnsureCheckboxes_);
  cfSafe_(cfProtectMachinery_);
  cfSafe_(cfCheckVersion_);
}

function cfSafe_(fn) { try { fn(); } catch (e) { console.log(e); } }

// Simple trigger (works in the phone and tablet app too).
function onEdit(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  const id = sh.getSheetId();
  const is = role => { const s = cfSheet_(role); return !!s && s.getSheetId() === id; };
  if (is('shop')) { cfShopEdit_(e); return; }
  if (is('aliases')) { cfRankBinders_(); return; }
  if (!is('plan')) return;
  const r = e.range;
  const a1 = r.getA1Notation();
  if (a1 === CF.RESET_CELL) {
    if (cfIsTrue_(r.getValue())) cfResetSearched();
    return;
  }
  if (a1 === CF.ORDER_CELL) { cfRankBinders_(); return; }
  if (a1 === CF.PLAN_BRINGBACK) {
    const b = String(r.getValue() || '');
    if (b) { cfSetSkipped_([b], false); r.clearContent(); SpreadsheetApp.getActive().toast(b + ' is back on the plan.', 'Card Finder', 4); }
    return;
  }
  // Search it? toggles change which cards count, so re-rank the binders
  const t = sh.getRange(CF.PLAN_TOGGLES);
  if (r.getColumn() === t.getColumn() && r.getRow() >= t.getRow() && r.getLastRow() <= t.getLastRow()) {
    cfRankBinders_();
    return;
  }
  // Searched? ticked on the plan: record it on Binder Setup, then clear the plan box.
  if (r.getColumn() === CF.PLAN_SEARCHED_COL && r.getNumColumns() === 1 &&
      r.getRow() >= CF.PLAN_FIRST_ROW && r.getLastRow() < CF.PLAN_FIRST_ROW + CF.PLAN_ROWS) {
    const ticks = r.getValues();
    const names = sh.getRange(r.getRow(), CF.PLAN_BINDER_COL, r.getNumRows(), 1).getValues();
    const toMark = names.filter((n, i) => n[0] !== '' && cfIsTrue_(ticks[i][0])).map(n => String(n[0]));
    if (toMark.length) cfMarkSearched_(toMark);
    r.setValues(ticks.map(() => [false]));
  }
}

function cfIsTrue_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }

function cfMarkSearched_(names) { cfSetSkipped_(names, true); }

// Searched or No Binder state, kept by binder name on the hidden Binder Setup tab
function cfSetSkipped_(names, value) {
  const bs = cfSheet_('setup');
  const list = bs.getRange(CF.BINDER_LIST).getValues();
  const rng = bs.getRange(CF.BINDER_SEARCHED);
  const vals = rng.getValues();
  const want = new Set(names);
  list.forEach(([b], i) => { if (want.has(String(b))) vals[i][0] = value; });
  rng.setValues(vals);
}

/* ---------------- Auto binder list ---------------- */

function cfRankBindersMenu() {
  cfRefreshSetInfo_(true);
  const n = cfRankBinders_();
  SpreadsheetApp.getActive().toast('Ranked ' + n + ' binders (' + cfOrderMode_() + ').', 'Card Finder', 5);
}

// Every set (or Set Aliases group) that holds a needed card becomes a binder, ranked by how many
// needed cards it could supply. Sets mapped to (none) on Set Aliases are left out.
// Searched / No Binder ticks stay with their binder name.
function cfRankBinders_() {
  const ss = SpreadsheetApp.getActive();
  SpreadsheetApp.flush();
  const bs = cfSheet_('setup'), bd = cfSheet_('data'), sa = cfSheet_('aliases');
  if (!bs || !bd) return 0;
  const map = {};
  if (sa) sa.getRange(CF.ALIAS_RANGE).getValues().forEach(([a, b]) => {
    a = String(a).trim(); b = String(b).trim();
    if (a && b) map[a] = b;
  });
  const n = CF.BD_LAST - 1;
  const need = bd.getRange(2, 5, n, 1).getValues();   // E: still need?
  const sets = bd.getRange(2, 8, n, 1).getValues();   // H: set lines
  const pot = {}, members = {};
  for (let i = 0; i < n; i++) {
    if (need[i][0] !== 'Y') continue;
    const mine = new Set();
    String(sets[i][0]).split('\n').forEach(x => {
      x = x.trim();
      if (!x || x.indexOf('(+') === 0) return;
      const b = map[x] || x;
      if (b.toLowerCase() === '(none)') return;
      mine.add(b);
      (members[b] = members[b] || new Set()).add(x);
    });
    mine.forEach(b => { pot[b] = (pot[b] || 0) + 1; });
  }
  const score = cfBinderScorer_(bs, pot, members);
  const names = Object.keys(pot)
    .sort((a, b) => score(b) - score(a) || pot[b] - pot[a] || a.localeCompare(b))
    .slice(0, CF.BINDER_ROWS);
  const skipped = {};
  bs.getRange(2, 2, CF.BINDER_ROWS, 2).getValues().forEach(([b, c]) => { if (b !== '') skipped[String(b)] = cfIsTrue_(c); });
  const bc = [], h = [];
  for (let i = 0; i < CF.BINDER_ROWS; i++) {
    const b = names[i];
    bc.push(b ? [b, !!skipped[b]] : ['', false]);
    h.push([b ? pot[b] : '']);
  }
  bs.getRange(2, 2, CF.BINDER_ROWS, 2).setValues(bc);
  bs.getRange(2, CF.BINDER_POT_COL, CF.BINDER_ROWS, 1).setValues(h);
  return names.length;
}

function cfOrderMode_() {
  const plan = cfSheet_('plan');
  const v = plan ? String(plan.getRange(CF.ORDER_CELL).getValue()).trim() : '';
  return CF.ORDER_MODES.indexOf(v) === -1 ? 'Balanced' : v;
}

// How likely a shop is to have a binder: newer sets and main product lines score higher.
const CF_TYPE_WEIGHT = {
  core: 1, expansion: 1, commander: 1, masters: 0.9, draft_innovation: 0.9, starter: 0.8,
  box: 0.6, duel_deck: 0.5, premium_deck: 0.5, spellbook: 0.5, planechase: 0.5, archenemy: 0.5,
  from_the_vault: 0.4, funny: 0.4, masterpiece: 0.4, arsenal: 0.4, promo: 0.3, treasure_chest: 0.3,
  memorabilia: 0.1, token: 0.1, minigame: 0.1, vanguard: 0.1, alchemy: 0,
};

// Returns binder -> score for the chosen Pull order.
//   Most cards:  cards it could supply.
//   Newest sets: newest release first (a group counts as its newest set).
//   Balanced:    cards it could supply, discounted for older and niche sets, so a big new
//                set beats an old small one but a binder with many more cards still wins.
function cfBinderScorer_(bs, pot, members) {
  const mode = cfOrderMode_();
  if (mode === 'Most cards') return b => pot[b];
  const info = {};
  bs.getRange(2, CF.SETINFO_COL, CF.SETINFO_ROWS, 3).getValues().forEach(([nm, d, t]) => {
    if (nm !== '') info[String(nm)] = { t: d instanceof Date ? d.getTime() : Date.parse(d), type: String(t) };
  });
  const now = Date.now(), YEAR = 365.25 * 24 * 3600 * 1000;
  const cache = {};
  const facts = b => {
    if (cache[b]) return cache[b];
    let t = 0, w = 0, known = false;
    (members[b] || new Set([b])).forEach(x => {
      const i = info[x];
      if (!i || isNaN(i.t)) return;
      known = true;
      t = Math.max(t, i.t);
      w = Math.max(w, i.type in CF_TYPE_WEIGHT ? CF_TYPE_WEIGHT[i.type] : 0.5);
    });
    return (cache[b] = known ? { t: t, w: w } : { t: 0, w: 0.5, unknown: true });
  };
  if (mode === 'Newest sets') return b => facts(b).t / YEAR;
  return b => {
    const f = facts(b);
    const age = f.unknown ? 0.5 : 1 / (1 + Math.max(0, now - f.t) / YEAR / 3);
    return pot[b] * (0.25 + 0.75 * age * f.w);
  };
}

// Scryfall's set list (name, release date, type), stored on Binder Setup so ranking works
// from any trigger. Refreshed at most weekly unless forced.
function cfRefreshSetInfo_(force) {
  const bs = cfSheet_('setup');
  if (!bs) return;
  const stamp = bs.getRange(CF.SETINFO_STAMP).getValue();
  const fresh = stamp instanceof Date && (Date.now() - stamp.getTime()) < 7 * 24 * 3600 * 1000;
  if (!force && fresh && bs.getRange(2, CF.SETINFO_COL).getValue() !== '') return;
  const r = cfFetch_('https://api.scryfall.com/sets', { lastCall: 0 });
  if (r.code !== 200 || !r.body.data) return;
  const rows = r.body.data.filter(x => !x.digital).slice(0, CF.SETINFO_ROWS)
    .map(x => [x.name, x.released_at || '', x.set_type || '']);
  const out = [];
  for (let i = 0; i < CF.SETINFO_ROWS; i++) out.push(rows[i] || ['', '', '']);
  bs.getRange(1, CF.SETINFO_COL, 1, 3).setValues([['Set (Scryfall)', 'Released', 'Set type']]);
  bs.getRange(2, CF.SETINFO_COL, CF.SETINFO_ROWS, 3).setValues(out);
  bs.getRange(CF.SETINFO_STAMP).setValue(new Date());
}

// Pull order dropdown on the binder plan (added if missing)
function cfEnsureOrderControl_() {
  const plan = cfSheet_('plan');
  if (!plan) return;
  const cell = plan.getRange(CF.ORDER_CELL);
  if (String(plan.getRange(CF.ORDER_LABEL).getValue()) === '') {
    plan.getRange(CF.ORDER_LABEL).setValue('Pull order:').setFontWeight('bold').setHorizontalAlignment('right');
    cell.setValue('Balanced');
  }
  cell.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(CF.ORDER_MODES, true).build());
}

function cfResetSearched() {
  const ss = SpreadsheetApp.getActive();
  const rng = cfSheet_('setup').getRange(CF.BINDER_SEARCHED);
  rng.setValues(rng.getValues().map(() => [false]));
  cfSheet_('plan').getRange(CF.RESET_CELL).setValue(false);
  ss.toast('All binders set back to not searched.', 'Card Finder', 4);
}

/* ---------------- Shop tab ---------------- */

function cfShopEdit_(e) {
  const r = e.range, sh = r.getSheet(), a1 = r.getA1Notation();
  const ss = SpreadsheetApp.getActive();
  if (a1 === CF.SHOP_DONE) {
    if (!cfIsTrue_(r.getValue())) return;
    const binder = String(sh.getRange(CF.SHOP_SHOWING).getValue() || '');
    if (binder) cfMarkSearched_([binder]);
    sh.getRange(CF.SHOP_PICK).clearContent();
    r.setValue(false);
    SpreadsheetApp.flush();
    const next = sh.getRange(CF.SHOP_SHOWING).getValue();
    ss.toast(binder + ' marked searched.' + (next ? ' Next: ' + next : ' No binders left.'), 'Card Finder', 5);
    return;
  }
  if (a1 === CF.SHOP_IMAGES) {
    const on = cfIsTrue_(r.getValue());
    sh.setRowHeights(CF.SHOP_FIRST_ROW, CF.SHOP_ROWS, on ? CF.SHOP_IMAGE_HEIGHT : 21);
    return;
  }
  // Found? ticked: mark the card TRUE on its own list tab, then clear the box.
  if (r.getColumn() === 1 && r.getNumColumns() === 1 &&
      r.getRow() >= CF.SHOP_FIRST_ROW && r.getLastRow() < CF.SHOP_FIRST_ROW + CF.SHOP_ROWS) {
    const ticks = r.getValues();
    const keys = sh.getRange(r.getRow(), CF.SHOP_KEY_COL, r.getNumRows(), 1).getValues();
    const rows = keys.filter((k, i) => k[0] !== '' && cfIsTrue_(ticks[i][0])).map(k => Number(k[0]));
    r.setValues(ticks.map(() => [false]));
    if (rows.length) cfMarkFound_(rows);
  }
}

// Binder Data rows -> set column A (In Collection?) to TRUE on the card's own list tab
function cfMarkFound_(bdRows) {
  const ss = SpreadsheetApp.getActive();
  const bd = cfSheet_('data');
  const ls = cfSheet_('lists').getRange(2, 1, CF.MAX_LISTS, 2).getValues();  // name, status col
  const statusCol = {};
  ls.forEach(([n, c]) => { if (n !== '') statusCol[String(n)] = Number(c) || 1; });
  bdRows.forEach(row => {
    const v = bd.getRange(row, 14, 1, 4).getValues()[0];   // N deck row, O, P, Q list name
    const deckRow = Number(v[0]), list = String(v[3]);
    const sh = ss.getSheetByName(list);
    if (sh && deckRow >= CF.FIRST_ROW) sh.getRange(deckRow, statusCol[list] || 1).setValue(true);
  });
}

/* ---------------- Lists: any tab with "In Collection?" in A1 ---------------- */

function cfSyncListsMenu() {
  const n = cfSyncLists_(false);
  cfRankBinders_();
  SpreadsheetApp.getActive().toast('Lists refreshed (' + n + ' list tabs).', 'Card Finder', 5);
}

function cfRebuildAll() {
  const n = cfSyncLists_(true);
  SpreadsheetApp.getActive().toast('Rebuilt formulas for ' + n + ' list tabs.', 'Card Finder', 5);
}

// Assigns each list tab (in tab order) a block on Binder Data, writes the formulas for any block
// whose tab changed, and keeps the Search it? ticks attached to the right list names.
function cfSyncLists_(force) {
  const ss = SpreadsheetApp.getActive();
  const decks = cfDeckSheets_().slice(0, CF.MAX_LISTS);
  const ls = cfSheet_('lists'), bd = cfSheet_('data'), plan = cfSheet_('plan');
  const meta = ls.getRange(2, 1, CF.MAX_LISTS, CF.LS_ID_COL).getValues();
  const oldNames = meta.map(r => String(r[0])), oldIds = meta.map(r => String(r[CF.LS_ID_COL - 1]));

  const labels = plan.getRange(CF.PLAN_LABELS).getValues().map(r => String(r[0]));
  const toggles = plan.getRange(CF.PLAN_TOGGLES).getValues().map(r => r[0]);
  const byName = {}, byId = {};
  labels.forEach((l, i) => { if (l) byName[l] = cfIsTrue_(toggles[i]); });
  oldIds.forEach((id, i) => { if (id && oldNames[i] in byName) byId[id] = byName[oldNames[i]]; });

  const N = cfNames_();
  const newLabels = [], newToggles = [];
  for (let i = 0; i < CF.MAX_LISTS; i++) {
    const sh = decks[i];
    const id = sh ? String(sh.getSheetId()) : '';
    const name = sh ? sh.getName() : '';
    const start = 2 + i * CF.LIST_ROWS;
    if (!force && id && oldIds[i] === '' && oldNames[i] === name) {
      ls.getRange(i + 2, CF.LS_ID_COL).setValue(id);       // template already built for this tab: just adopt it
    } else if (force || id !== oldIds[i]) {
      if (sh) {
        ls.getRange(i + 2, 2, 1, 9).setFormulas([cfListSetupFormulas_(name)]);
        ls.getRange(i + 2, CF.LS_ID_COL).setValue(id);
        bd.getRange(start, 1, CF.LIST_ROWS, 18).setFormulas(cfBlockFormulas_(i, name, N));
        const tcol = cfFindHeader_(sh, 'target_binder');
        if (tcol) sh.getRange(CF.FIRST_ROW, tcol, CF.LIST_ROWS, 1).setFormulas(cfTargetFormulas_(i, N).map(f => [f]));
      } else {
        ls.getRange(i + 2, 1, 1, CF.LS_ID_COL).clearContent();
        bd.getRange(start, 1, CF.LIST_ROWS, 18).clearContent();
      }
    }
    if (sh) ls.getRange(i + 2, 1).setValue(name);
    newLabels.push([name]);
    newToggles.push([sh ? (id in byId ? byId[id] : (name in byName ? byName[name] : true)) : false]);
  }
  plan.getRange(CF.PLAN_LABELS).setValues(newLabels);
  plan.getRange(CF.PLAN_TOGGLES).setValues(newToggles);
  return decks.length;
}

function cfFindHeader_(sh, text) {
  const h = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0]
    .map(x => String(x).trim().toLowerCase());
  const i = h.indexOf(text);
  return i === -1 ? 0 : i + 1;
}

/* ---------------- Formula builders (also used to build the template file) ---------------- */

function cfQ_(name) { return "'" + String(name).replace(/'/g, "''") + "'"; }

// List Setup columns B-J for one list tab: where each field lives (found by row 1 headers)
function cfListSetupFormulas_(tab) {
  const T = cfQ_(tab) + '!$1:$1';
  const m = (h, fb) => `IFERROR(MATCH("${h}",${T},0),${fb})`;
  return [
    '=' + m('In Collection*', 1),                                        // B status
    '=' + m('count', m('#', 2)),                                         // C count
    '=' + m('name', m('printed_name', m('Card Name', 3))),               // D name
    '=' + m('set_name', 7),                                              // E sets
    '=' + m('price_usd', m('Avg Price', m('Price', 10))),                // F price
    '=' + m('set_prices', '""'),                                         // G price per set
    '=' + m('colors', '""'),                                             // H colors
    '=' + m('type_line', '""'),                                          // I type line
    '=' + m('image_uri', '""'),                                          // J image link
  ];
}

// Binder Data block for list i (columns A-R, LIST_ROWS rows)
function cfDefaultNames_() {
  const out = {}; Object.keys(CF_ROLES).forEach(r => { out[r] = cfQ_(CF_ROLES[r].name); }); return out;
}

function cfBlockFormulas_(i, tab, N) {
  N = N || cfDefaultNames_();
  const s = 2 + i * CF.LIST_ROWS, off = s - 2, lr = i + 2, NL = 'CHAR(10)', L = CF.BD_LAST;
  const T = cfQ_(tab) + '!$A:$Z';
  const X = c => `INDEX(${T},ROW()-${off},${N.lists}!$${c}$${lr})`;
  const AF = f => '=ARRAYFORMULA(' + f.slice(1) + ')';
  const rows = [];
  for (let r = s; r < s + CF.LIST_ROWS; r++) {
    const typ = `IFERROR(${X('I')}&"","")`;
    const front = `LEFT(${typ},IFERROR(SEARCH(" // ",${typ})-1,LEN(${typ})))`;
    const cs = `IFERROR(${X('H')}&"","")`;
    const pos = `SEARCH(${NL}&I${r}&${NL},H${r})`;
    const k = `(${pos}-LEN(SUBSTITUTE(LEFT(H${r},${pos}),${NL},"")))`;
    const alpha = [1, 2, 3, 4].map(p => `MAX(0,MIN(26,CODE(MID(UPPER(A${r})&"    ",${p},1))-64))*${Math.pow(27, 4 - p)}`).join('+');
    const plan = (c) => `INDEX(${N.plan}!$J$6:$J$30,MATCH(Q${r},${N.plan}!$I$6:$I$30,0))`;
    const st = X('B');
    rows.push([
      /* A name   */ `=IF(${X('D')}="","",${X('D')})`,
      /* B binder */ AF(`=IF(A${r}="","",IFERROR(INDEX(${N.setup}!$B$2:$B$${CF.BINDER_LAST},MIN(` +
                     `IF(ISNUMBER(SEARCH(${NL}&${N.setup}!$B$2:$B$${CF.BINDER_LAST}&${NL},$H${r})),${N.lists}!$Q$2:$Q$${CF.BINDER_LAST},999),` +
                     `IF(ISNUMBER(SEARCH(${NL}&${N.aliases}!$A$2:$A$${CF.ALIAS_LAST}&${NL},$H${r})),${N.aliases}!$C$2:$C$${CF.ALIAS_LAST},999))),"(none)"))`),
      /* C sets   */ `=IF(A${r}="","",SUBSTITUTE(MID(H${r},2,LEN(H${r})-2),${NL}," | "))`,
      /* D status */ `=IF(A${r}="","",IF(ISLOGICAL(${st}),IF(${st},"In collection","Needed"),` +
                     `IF(UPPER(TRIM(${st}))="ORDERED","Ordered",IF(UPPER(TRIM(${st}))="PROXY","Proxy",` +
                     `IF(UPPER(TRIM(${st}))="OUT OF DECK","Out of deck",IF(UPPER(TRIM(${st}))="TRUE","In collection","Needed"))))))`,
      /* E need   */ `=IF(A${r}="","",IF(AND(D${r}="Needed",R${r}=TRUE()),"Y","N"))`,
      /* F price  */ `=IF(A${r}="","",IF(ISNUMBER(J${r}),J${r},IF(ISNUMBER(${X('F')}),${X('F')},0)))`,
      /* G label  */ `=IF(A${r}="","",A${r}&IF(N(${X('C')})>1," (x"&${X('C')}&")","")&IF(COUNTIF(${N.plan}!$J$6:$J$30,TRUE())>1," ["&Q${r}&"]",""))`,
      /* H sets   */ `=IF(A${r}="","",${NL}&${X('E')}&${NL})`,
      /* I tset   */ AF(`=IF(OR(B${r}="",B${r}="(none)"),"",IF(ISNUMBER(SEARCH(${NL}&B${r}&${NL},H${r})),B${r},` +
                     `IFERROR(INDEX(${N.aliases}!$A$2:$A$${CF.ALIAS_LAST},MATCH(1,(${N.aliases}!$B$2:$B$${CF.ALIAS_LAST}=B${r})*` +
                     `ISNUMBER(SEARCH(${NL}&${N.aliases}!$A$2:$A$${CF.ALIAS_LAST}&${NL},H${r})),0)),"")))`),
      /* J tprice */ `=IF(I${r}="","",IFERROR(VALUE(TRIM(MID(SUBSTITUTE(${X('G')},${NL},REPT(" ",100)),(${k}-1)*100+1,100))),""))`,
      /* K color# */ `=IF(A${r}="","",IF(ISNUMBER(SEARCH("Land",${front})),8,IF(LEN(${cs})=0,7,IF(LEN(${cs})>1,6,FIND(${cs},"WUBRG")))))`,
      /* L color  */ `=IF(A${r}="","",CHOOSE(K${r},"White","Blue","Black","Red","Green","Multicolor","Colorless","Land"))`,
      /* M shop   */ `=IF(A${r}="","",IF(AND(E${r}="Y",B${r}=${N.shop}!$B$4),K${r}*10000000000+(${alpha})*10000+ROW(),""))`,
      /* N row    */ `=IF(A${r}="","",ROW()-${off})`,
      /* O image  */ `=IF(A${r}="","",IFERROR(${X('J')}&"",""))`,
      /* P        */ '',
      /* Q list   */ `=IF(A${r}="","",${N.lists}!$A$${lr})`,
      /* R on     */ `=IF(A${r}="","",IFERROR(OR(${plan()}=TRUE(),UPPER(${plan()}&"")="TRUE"),FALSE()))`,
    ]);
  }
  return rows;
}

// target_binder column on list tab i
function cfTargetFormulas_(i, N) {
  N = N || cfDefaultNames_();
  const s = 2 + i * CF.LIST_ROWS, e = s + CF.LIST_ROWS - 1;
  const R = c => `INDEX(${N.data}!$${c}$${s}:$${c}$${e},ROW()-1)`;
  const out = [];
  for (let n = 0; n < CF.LIST_ROWS; n++)
    out.push(`=IF(${R('A')}="","",IF(${R('D')}="Needed",${R('B')},${R('D')}))`);
  return out;
}

/* ---------------- Housekeeping ---------------- */

// Imports from .xlsx lose checkboxes; this puts them back without changing their values.
function cfEnsureCheckboxes_() {
  const ss = SpreadsheetApp.getActive();
  const plan = cfSheet_('plan'), setup = cfSheet_('setup'), shop = cfSheet_('shop');
  const ranges = [];
  if (plan && String(plan.getRange(CF.PH_HEADER).getValue()) !== '')
    ranges.push(plan.getRange(CF.PH_FETCH), plan.getRange(CF.PH_SCAN), plan.getRange(CF.PH_AUTO));
  if (plan) ranges.push(plan.getRange(CF.RESET_CELL), plan.getRange(CF.PLAN_TOGGLES),
                        plan.getRange(CF.PLAN_FIRST_ROW, CF.PLAN_SEARCHED_COL, CF.PLAN_ROWS, 1));
  if (setup) ranges.push(setup.getRange(CF.BINDER_SEARCHED));
  if (shop) ranges.push(shop.getRange(CF.SHOP_DONE), shop.getRange(CF.SHOP_IMAGES),
                        shop.getRange(CF.SHOP_FIRST_ROW, 1, CF.SHOP_ROWS, 1));
  ranges.forEach(r => {
    const vals = r.getValues();
    r.insertCheckboxes();
    r.setValues(vals.map(row => row.map(cfIsTrue_)));
  });
}

// Binder Data and List Setup: warning-only protection (edits ask "are you sure?")
function cfProtectMachinery_() {
  const ss = SpreadsheetApp.getActive();
  ['data', 'lists', 'setup'].forEach(role => {
    const sh = cfSheet_(role);
    if (sh && !sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).length)
      sh.protect().setDescription('Card Finder machinery').setWarningOnly(true);
  });
}

function cfCheckVersion_() {
  const sh = cfSheet_('readme');
  if (!sh) return;
  const v = String(sh.getRange(CF.VERSION_CELL).getValue());
  if (v.indexOf('Version ' + CF.VERSION) === -1)
    SpreadsheetApp.getActive().toast('This sheet says "' + v + '" but the script is version ' + CF.VERSION +
      '. Get the matching sheet or script.', 'Card Finder', 10);
}

/* ---------------- Phone controls ----------------
 * Simple triggers can't call Scryfall, so phone controls use an installable edit trigger.
 * Enable it once from a computer (Card Finder > Enable phone controls). It runs as you,
 * from any device, whenever a phone control is ticked or names are pasted into a list. */

function cfEnablePhone() {
  const ss = SpreadsheetApp.getActive();
  const has = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'cfOnEditInstalled');
  if (!has) ScriptApp.newTrigger('cfOnEditInstalled').forSpreadsheet(ss).onEdit().create();
  cfEnsureControls_();
  SpreadsheetApp.getUi().alert('Card Finder',
    'Phone controls are on. On the binder plan tab (top right):\n\n' +
    'Fetch new cards: tick to fill in new cards on every list.\n' +
    'Find sets without a binder: tick to update Set Aliases.\n' +
    'Auto-fetch pasted names: while ticked, pasting names into a list fills them in by itself.\n\n' +
    'Results show in the cell next to each box. This works in the phone and tablet app.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

// Writes the control labels and checkboxes if they are missing.
function cfEnsureControls_() {
  const plan = cfSheet_('plan');
  if (!plan) return;
  if (String(plan.getRange(CF.PH_HEADER).getValue()) === '') {
    plan.getRange('I1:K1').setValues([['Phone controls', 'Tick', 'Last result']])
      .setFontWeight('bold').setFontColor('#ffffff').setBackground('#1f3864');
    plan.getRange('I2:I4').setValues([['Fetch new cards'], ['Find sets without a binder'], ['Auto-fetch pasted names']]);
    plan.getRange(CF.PH_AUTO).setValue(true);
  }
  [CF.PH_FETCH, CF.PH_SCAN, CF.PH_AUTO].forEach(a => {
    const r = plan.getRange(a), v = r.getValue();
    r.insertCheckboxes(); r.setValue(cfIsTrue_(v));
  });
}

function cfStatus_(cell, text) {
  const plan = cfSheet_('plan');
  const t = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d h:mm a');
  if (plan) plan.getRange(cell).offset(0, 1).setValue(t + ': ' + text);
}

function cfOnEditInstalled(e) {
  if (!e || !e.range) return;
  const r = e.range, sh = r.getSheet();
  const plan = cfSheet_('plan');
  const onPlan = plan && sh.getSheetId() === plan.getSheetId();
  if (onPlan) {
    const a1 = r.getA1Notation();
    if (a1 !== CF.PH_FETCH && a1 !== CF.PH_SCAN) return;
    if (!cfIsTrue_(r.getValue())) return;
    cfLocked_(a1, () => {
      cfStatus_(a1, 'Running...');
      SpreadsheetApp.flush();
      let msg;
      if (a1 === CF.PH_FETCH) {
        cfSyncLists_(false);
        msg = cfRun_(cfDeckSheets_(), false, true);
      } else {
        msg = cfScanSets(true);
      }
      cfStatus_(a1, msg || 'Done');
    });
    r.setValue(false);
    return;
  }
  // Names pasted or typed into a list: fetch just that tab
  if (!cfIsDeckSheet_(sh) || r.getLastRow() < CF.FIRST_ROW) return;
  if (!plan || !cfIsTrue_(plan.getRange(CF.PH_AUTO).getValue())) return;
  const cols = cfHeaderMap_(sh);
  if (!cols.name) return;
  const c = cols.name[0];
  if (c < r.getColumn() || c > r.getLastColumn()) return;
  cfLocked_(CF.PH_AUTO, () => {
    cfStatus_(CF.PH_AUTO, 'Fetching ' + sh.getName() + '...');
    SpreadsheetApp.flush();
    cfSyncLists_(false);
    cfStatus_(CF.PH_AUTO, cfRun_([sh], false, true));
  });
}

// One run at a time; a second tick while busy just reports it.
function cfLocked_(cell, fn) {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(2000)) { cfStatus_(cell, 'Already running, try again in a minute'); return; }
  try { fn(); }
  catch (err) { cfStatus_(cell, 'Error: ' + err.message); }
  finally { lock.releaseLock(); }
}

/* ---------------- Fetch entry points ---------------- */

function cfFetchActive()   { cfRunOnActive_(false); }
function cfRefreshActive() { cfRunOnActive_(true); }
function cfFetchAll()      { cfRun_(cfDeckSheets_(), false); }

function cfRunOnActive_(force) {
  const sh = SpreadsheetApp.getActiveSheet();
  if (!cfIsDeckSheet_(sh)) {
    SpreadsheetApp.getUi().alert('Open a green list tab first (A1 should say "In Collection?").');
    return;
  }
  cfRun_([sh], force);
}

function cfIsDeckSheet_(sh) {
  return String(sh.getRange(1, 1).getValue()).trim().toLowerCase().indexOf('in collection') === 0;
}

function cfDeckSheets_() {
  return SpreadsheetApp.getActive().getSheets().filter(cfIsDeckSheet_);
}

/* ---------------- Main run ---------------- */

function cfRun_(sheets, force, quiet) {
  cfSafe_(() => cfRefreshSetInfo_(false));
  const ss = SpreadsheetApp.getActive();
  const started = Date.now();
  const ctx = { lastCall: 0, cards: {}, prints: {}, rankOf: cfBinderRanker_() };
  const report = [];
  let stopped = false;

  for (const sh of sheets) {
    if (stopped) break;
    const cols = cfHeaderMap_(sh);
    if (!cols.name) { report.push(sh.getName() + ': no "name" header, skipped'); continue; }

    const nRows = CF.LAST_ROW - CF.FIRST_ROW + 1;
    const nCols = Math.max(sh.getLastColumn(), 1);
    const data = sh.getRange(CF.FIRST_ROW, 1, nRows, nCols).getValues();
    const nameCol = cols.name[0];
    const nameRange = sh.getRange(CF.FIRST_ROW, nameCol, nRows, 1);
    const bgs = nameRange.getBackgrounds();
    const notes = nameRange.getNotes();

    // Which rows need a lookup
    const todo = [];
    data.forEach((row, i) => {
      const raw = String(row[nameCol - 1] || '').trim();
      if (!raw) return;
      const parsed = cfParseLine_(raw);
      if (!force && cfLooksDone_(row, cols, parsed.name)) return;
      todo.push({ i: i, name: parsed.name, count: parsed.count });
    });
    if (!todo.length) { report.push(sh.getName() + ': nothing new to fetch'); continue; }

    ss.toast('Looking up ' + todo.length + ' cards on ' + sh.getName() + '...', 'Card Finder', 10);
    cfCollection_(todo.map(t => t.name), ctx);   // fast batch lookup, exact names

    let filled = 0;
    const missing = [];
    for (const t of todo) {
      if (Date.now() - started > CF.TIME_LIMIT_MS) { stopped = true; break; }
      const row = data[t.i];
      if (t.count != null && cols.count) row[cols.count[0] - 1] = t.count;

      const card = cfLookup_(t.name, ctx);
      if (card.error) {
        row[nameCol - 1] = t.name;
        bgs[t.i][0] = CF.NOT_FOUND_COLOR;
        notes[t.i][0] = 'Scryfall: ' + card.error;
        missing.push(t.name);
        continue;
      }
      cfFillRow_(row, cols, card, cfPrints_(card, ctx), ctx);
      bgs[t.i][0] = null;
      notes[t.i][0] = '';
      filled++;
    }

    // Write back only the columns the script owns
    const owned = new Set();
    Object.keys(cols).forEach(k => cols[k].forEach(c => owned.add(c)));
    owned.forEach(c => {
      sh.getRange(CF.FIRST_ROW, c, nRows, 1).setValues(data.map(r => [r[c - 1]]));
    });
    nameRange.setBackgrounds(bgs);
    nameRange.setNotes(notes);
    if (cols.set_name) {   // keep rows one line tall
      sh.getRange(CF.FIRST_ROW, cols.set_name[0], nRows, 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
    }

    let line = sh.getName() + ': ' + filled + ' filled';
    if (missing.length) line += ', ' + missing.length + ' not found (' + missing.join(', ') + ')';
    report.push(line);
  }

  if (stopped) report.push('Stopped at the 5 minute limit. Run it again to finish; filled rows are skipped.');
  cfSafe_(cfRankBinders_);
  if (quiet) return report.join('; ');
  SpreadsheetApp.getUi().alert('Card Finder', report.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}

/* ---------------- Sheet helpers ---------------- */

function cfHeaderMap_(sh) {
  const headers = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0]
    .map(h => String(h).trim().toLowerCase());
  const map = {};
  Object.keys(CF_FIELDS).forEach(field => {
    const hits = [];
    headers.forEach((h, i) => { if (CF_FIELDS[field].indexOf(h) !== -1) hits.push(i + 1); });
    if (hits.length) map[field] = field === 'name' ? [hits[0]] : hits;
  });
  return map;
}

// Accepts "Sol Ring", "1 Sol Ring", "2x Sol Ring (CMM) 400 *F* #Ramp"
function cfParseLine_(raw) {
  let s = raw.replace(/\s+/g, ' ').trim();
  let count = null;
  const m = s.match(/^(\d{1,2})\s*x?\s+(.+)$/i);
  if (m) { count = Number(m[1]); s = m[2]; }
  s = s.replace(/\s+#\S.*$/, '')                          // Moxfield tags
       .replace(/\s+\*[A-Z]+\*\s*$/i, '')                  // *F* / *E*
       .replace(/\s+\([A-Za-z0-9]{2,6}\)(\s+\S+)?\s*$/, '') // (CMM) 400
       .replace(/\s+\*[A-Z]+\*\s*$/i, '')
       .trim();
  return { name: s, count: count };
}

// A row is done when its scryfall_uri matches the name (or set_name is filled if there is no uri column)
// and the newer columns (set_prices, image_uri) are filled where they exist
function cfLooksDone_(row, cols, name) {
  for (const f of ['set_prices', 'image_uri'])
    if (cols[f] && String(row[cols[f][0] - 1] || '') === '') return false;
  if (cols.scryfall_uri) {
    const uri = String(row[cols.scryfall_uri[0] - 1] || '');
    return uri !== '' && cfSlug_(name) === cfSlug_(uri.split('?')[0].split('/').pop());
  }
  return cols.set_name ? String(row[cols.set_name[0] - 1] || '') !== '' : false;
}

function cfSlug_(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/['\u2019]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Binder order (with Set Aliases applied) -> rank, used to put likely binder sets first
function cfBinderRanker_() {
  const ss = SpreadsheetApp.getActive();
  const rank = {};
  cfSheet_('setup').getRange(CF.BINDER_LIST).getValues()
    .forEach(([b], i) => { if (b !== '' && !(b in rank)) rank[String(b).trim()] = i; });
  const alias = {};
  const aSheet = cfSheet_('aliases');
  if (aSheet) aSheet.getRange(CF.ALIAS_RANGE).getValues()
    .forEach(([from, to]) => { if (from !== '' && to !== '') alias[String(from).trim()] = String(to).trim(); });
  return setName => {
    const target = alias[setName] || setName;
    return target in rank ? rank[target] : Infinity;
  };
}

function cfText_(v) {
  if (v == null) return '';
  const s = String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;   // keep "+1: ..." from being read as a formula
}

function cfFace_(card, key) {
  if (card[key] != null && card[key] !== '') return card[key];
  if (card.card_faces) return card.card_faces.map(f => f[key] || '').filter(String).join(' // ');
  return '';
}

function cfFillRow_(row, cols, card, prints, ctx) {
  const put = (field, value) => { if (cols[field]) cols[field].forEach(c => { row[c - 1] = value; }); };

  // every paper set: binder sets first (Binder Plan order), then the rest, newest first
  const sets = prints.sets.slice().sort((a, b) => ctx.rankOf(a.name) - ctx.rankOf(b.name) || a.order - b.order);

  const defaultPrice = parseFloat(card.prices && (card.prices.usd || card.prices.usd_foil || card.prices.usd_etched));
  const price = CF.PRICE_MODE === 'cheapest' && prints.cheapest != null ? prints.cheapest
              : (isNaN(defaultPrice) ? '' : defaultPrice);

  row[cols.name[0] - 1] = card.name;   // corrected spelling
  put('type_line', cfText_(cfFace_(card, 'type_line')));
  put('mana_cost', cfText_(cfFace_(card, 'mana_cost')));
  put('set_name', sets.map(s => s.name).join('\n'));
  put('cmc', card.cmc != null ? card.cmc : '');
  put('rarity', card.rarity || '');
  put('price_usd', price);
  put('oracle_text', cfText_(cfFace_(card, 'oracle_text')));
  put('scryfall_uri', card.scryfall_uri || '');
  put('color_identity', (card.color_identity || []).join(''));
  const colors = card.colors || (card.card_faces && card.card_faces[0].colors) || [];
  put('colors', colors.join(''));
  const sp = sets.map(x => x.price == null ? '' : x.price.toFixed(2)).join('\n');
  put('set_prices', sp.replace(/\n/g, '') === '' ? 'n/a' : sp);
  const img = (card.image_uris && card.image_uris.small) ||
              (card.card_faces && card.card_faces[0].image_uris && card.card_faces[0].image_uris.small) || '';
  put('image_uri', img);
}

/* ---------------- Scryfall ---------------- */

function cfFetch_(url, ctx, options) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = ctx.lastCall + CF.DELAY_MS - Date.now();
    if (wait > 0) Utilities.sleep(wait);
    ctx.lastCall = Date.now();
    const res = UrlFetchApp.fetch(url, Object.assign({
      muteHttpExceptions: true,
      headers: { 'Accept': 'application/json', 'User-Agent': 'CardFinderSheet/1.0' },
    }, options || {}));
    const code = res.getResponseCode();
    if (code === 429 || code >= 500) { Utilities.sleep(1000 * (attempt + 1)); continue; }
    try { return { code: code, body: JSON.parse(res.getContentText()) }; }
    catch (e) { return { code: code, body: { details: 'Bad response from Scryfall' } }; }
  }
  return { code: 503, body: { details: 'Scryfall did not respond, try again later' } };
}

function cfKey_(name) { return String(name).trim().toLowerCase(); }

function cfRemember_(card, ctx, asName) {
  ctx.cards[cfKey_(card.name)] = card;
  (card.card_faces || []).forEach(f => { ctx.cards[cfKey_(f.name)] = card; });
  if (asName) ctx.cards[cfKey_(asName)] = card;
}

// POST /cards/collection: up to 75 exact names per request
function cfCollection_(names, ctx) {
  const wanted = names.filter(n => !ctx.cards[cfKey_(n)]);
  for (let i = 0; i < wanted.length; i += 75) {
    const ids = wanted.slice(i, i + 75).map(n => ({ name: n.split(' // ')[0] }));
    const r = cfFetch_('https://api.scryfall.com/cards/collection', ctx, {
      method: 'post', contentType: 'application/json', payload: JSON.stringify({ identifiers: ids }),
    });
    if (r.code === 200) (r.body.data || []).forEach(c => cfRemember_(c, ctx));
  }
}

// Exact match from the batch, otherwise Scryfall's fuzzy search (typos, partial names)
function cfLookup_(name, ctx) {
  const key = cfKey_(name);
  if (ctx.cards[key]) return ctx.cards[key];
  const front = name.split(' // ')[0];
  if (ctx.cards[cfKey_(front)]) return ctx.cards[cfKey_(front)];
  const r = cfFetch_('https://api.scryfall.com/cards/named?fuzzy=' + encodeURIComponent(front), ctx);
  if (r.code === 200 && r.body.object === 'card') { cfRemember_(r.body, ctx, name); return r.body; }
  return { error: (r.body && r.body.details) || 'not found' };
}

// Every paper printing: unique sets (newest first) with the cheapest USD price in each, plus the overall cheapest
function cfPrints_(card, ctx) {
  const id = card.oracle_id || (card.card_faces && card.card_faces[0].oracle_id) || card.id;
  if (ctx.prints[id]) return ctx.prints[id];
  const out = { sets: [], cheapest: null };
  if (/\bBasic\b/.test(card.type_line || '')) { ctx.prints[id] = out; return out; }  // skip basic lands

  const bySet = {};
  let url = card.prints_search_uri;
  let order = 0;
  while (url) {
    const r = cfFetch_(url, ctx);
    if (r.code !== 200) break;
    (r.body.data || []).forEach(p => {
      if (p.digital || (p.games && p.games.indexOf('paper') === -1) || p.set_type === 'memorabilia') return;
      if (!bySet[p.set_name]) {
        bySet[p.set_name] = { name: p.set_name, order: order++, price: null };
        out.sets.push(bySet[p.set_name]);
      }
      const pr = parseFloat(p.prices && (p.prices.usd || p.prices.usd_foil || p.prices.usd_etched));
      if (!isNaN(pr)) {
        const s = bySet[p.set_name];
        if (s.price == null || pr < s.price) s.price = pr;
        if (out.cheapest == null || pr < out.cheapest) out.cheapest = pr;
      }
    });
    url = r.body.has_more ? r.body.next_page : null;
  }
  ctx.prints[id] = out;
  return out;
}

/* ---------------- Set Aliases scan ---------------- */

function cfIsNeeded_(status) {
  if (status === false || status === '' || status == null) return true;
  return String(status).trim().toUpperCase() === 'FALSE';
}

// Adds every set from still-needed cards that is not on Set Aliases yet (column A),
// most common first, and refreshes the "Needed cards" count in column D.
function cfScanSets(quiet) {
  const ss = SpreadsheetApp.getActive();
  const aSheet = cfSheet_('aliases');
  const aliases = aSheet.getRange(CF.ALIAS_RANGE).getValues();   // [set, binder] rows 2-501

  const counts = {};
  cfDeckSheets_().forEach(sh => {
    const cols = cfHeaderMap_(sh);
    if (!cols.set_name) return;
    sh.getRange(CF.FIRST_ROW, 1, CF.LAST_ROW - CF.FIRST_ROW + 1, sh.getLastColumn()).getValues().forEach(row => {
      if (!String(row[cols.name[0] - 1] || '').trim() || !cfIsNeeded_(row[0])) return;
      String(row[cols.set_name[0] - 1] || '').split('\n').map(x => x.trim())
        .filter(x => x && x.indexOf('(+') !== 0)
        .forEach(x => { counts[x] = (counts[x] || 0) + 1; });
    });
  });

  const rowOf = {};
  aliases.forEach(([a], i) => { if (a !== '') rowOf[String(a).trim()] = i; });
  const fresh = Object.keys(counts)
    .filter(x => !(x in rowOf))
    .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));

  let next = 0, added = 0;
  for (const x of fresh) {
    while (next < aliases.length && aliases[next][0] !== '') next++;
    if (next >= aliases.length) break;
    aliases[next][0] = x;
    added++;
  }
  aSheet.getRange(2, 1, aliases.length, 1).setValues(aliases.map(r => [r[0]]));
  aSheet.getRange(2, 4, aliases.length, 1).setValues(aliases.map(([a]) => [a === '' ? '' : (counts[String(a).trim()] || 0)]));

  const skipped = fresh.length - added;
  const summary = 'Added ' + added + ' set(s) to Set Aliases' + (skipped ? ' (' + skipped + ' did not fit)' : '');
  if (quiet === true) return summary;
  SpreadsheetApp.getUi().alert('Card Finder',
    'Added ' + added + ' set(s) to Set Aliases' + (skipped ? ' (' + skipped + ' did not fit; the tab holds 500 rows)' : '') + '.\n\n' +
    'Every set is already its own binder. Use column B only to group sets into one binder (e.g. "Commander Box"), ' +
    'or type (none) for sets your shops never carry. Leave B blank otherwise. Column D shows how many needed cards each set covers.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

