export const DEFAULT_MOBILE_BREAKPOINT = 768;

/** Falls back to the default on NaN, non-numeric, or non-positive input. */
export function normalizeBreakpoint(value: unknown): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MOBILE_BREAKPOINT;
}

/**
 * Width only. Testing the smaller viewport dimension misreads short desktop
 * windows (e.g. 1440x720) as mobile, and disagrees with the media query below.
 */
export function isMobile(breakpoint: number): boolean {
  return window.innerWidth < breakpoint;
}

export function mobileMediaQuery(breakpoint: number): string {
  return `(max-width:${breakpoint - 1}px)`;
}
