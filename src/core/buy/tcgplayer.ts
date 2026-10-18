// Addresses for buying a card on TCGplayer. Pure: no fetch, no window. The affiliate tracking address comes in as an
// argument, so the code stays out of core and the links work (without a commission) until it is set.
export const MASS_ENTRY_URL = 'https://www.tcgplayer.com/massentry';

// Mass Entry opened with a list already in it: `?productline=Magic&c=` then one "quantity name" per card, joined by "||".
// (Checked in a browser: the page shows the list in its box, ready to price and add to a cart.) A list too long for an
// address gives null, and the caller falls back to copying the list for the player to paste.
export const MASS_ENTRY_MAX_CHARS = 6000;

export function massEntryUrl(lines: readonly { name: string; copies: number }[]): string | null {
  if (lines.length === 0) return null;
  const list = lines.map(l => encodeURIComponent(`${l.copies} ${l.name}`)).join('||');
  const url = `${MASS_ENTRY_URL}?productline=Magic&c=${list}`;
  return url.length <= MASS_ENTRY_MAX_CHARS ? url : null;
}

// A TCGplayer search for one card by name, as a grid of Magic products.
export const cardSearchUrl = (name: string): string =>
  `https://www.tcgplayer.com/search/magic/product?q=${encodeURIComponent(name)}&productLineName=magic&view=grid`;

// Routes a TCGplayer address through the affiliate tracking address (Impact deep link). Unchanged when there is none.
export const withAffiliate = (url: string, trackingUrl: string | null): string =>
  trackingUrl === null ? url : `${trackingUrl}?u=${encodeURIComponent(url)}`;
