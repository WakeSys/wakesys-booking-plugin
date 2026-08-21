export declare const DEFAULT_MOBILE_BREAKPOINT = 768;
/** Falls back to the default on NaN, non-numeric, or non-positive input. */
export declare function normalizeBreakpoint(value: unknown): number;
/**
 * Width only. Testing the smaller viewport dimension misreads short desktop
 * windows (e.g. 1440x720) as mobile, and disagrees with the media query below.
 */
export declare function isMobile(breakpoint: number): boolean;
export declare function mobileMediaQuery(breakpoint: number): string;
