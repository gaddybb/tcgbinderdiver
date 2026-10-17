// Feature flags. v2 and v3 features stay off in v1.
export const FLAGS = {
  affiliateLinks: false, // v2: TCGplayer buy links through Impact
  savedStores: false,    // v2: per-store profiles
  accounts: false,       // v3: Supabase sign-in and sync
  analytics: false,      // v1, later PR: GA4 behind consent
} as const;

export type Flag = keyof typeof FLAGS;
export const isOn = (flag: Flag): boolean => FLAGS[flag];
