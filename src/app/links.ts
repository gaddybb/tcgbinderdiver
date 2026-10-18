// Outside addresses the app points to, in one place.
import { withAffiliate } from '../core/buy';
export const KOFI_URL = 'https://ko-fi.com/gaddybb';

// A Google Maps search that Maps answers from the player's own location (no key, and no location handled by this app).
export const NEARBY_STORES_URL = 'https://www.google.com/maps/search/?api=1&query=trading+card+game+store';

// TCGplayer affiliate tracking address (Impact deep link). Null until the owner has the account: buy links then go straight to TCGplayer.
export const TCGPLAYER_TRACKING_URL: string | null = null;

// Opens a TCGplayer address in a new tab, through the affiliate address when there is one.
export const buyUrl = (url: string): string => withAffiliate(url, TCGPLAYER_TRACKING_URL);
