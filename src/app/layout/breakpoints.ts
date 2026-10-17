// Layout breakpoints, defined once. Phone under 640 px, tablet 640 to 1100 px, desktop above.
export const BREAKPOINTS = { tabletMin: 640, desktopMin: 1100 } as const;

export type Layout = 'phone' | 'tablet' | 'desktop';

export function layoutFor(widthPx: number): Layout {
  if (widthPx < BREAKPOINTS.tabletMin) return 'phone';
  if (widthPx <= BREAKPOINTS.desktopMin) return 'tablet';
  return 'desktop';
}

export const MEDIA = {
  phone: `(max-width: ${BREAKPOINTS.tabletMin - 0.02}px)`,
  tablet: `(min-width: ${BREAKPOINTS.tabletMin}px) and (max-width: ${BREAKPOINTS.desktopMin}px)`,
  desktop: `(min-width: ${BREAKPOINTS.desktopMin + 0.02}px)`,
} as const;
