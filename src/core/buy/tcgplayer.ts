// Addresses for buying a card on TCGplayer. Pure: no fetch, no window. The affiliate tracking address comes in as an
// argument, so the code stays out of core and the links work (without a commission) until it is set.
export const MASS_ENTRY_URL = 'https://www.tcgplayer.com/massentry';

// A TCGplayer search for one card by name, as a grid of Magic products.
export const cardSearchUrl = (name: string): string =>
  `https://www.tcgplayer.com/search/magic/product?q=${encodeURIComponent(name)}&productLineName=magic&view=grid`;

// Routes a TCGplayer address through the affiliate tracking address (Impact deep link). Unchanged when there is none.
export const withAffiliate = (url: string, trackingUrl: string | null): string =>
  trackingUrl === null ? url : `${trackingUrl}?u=${encodeURIComponent(url)}`;
