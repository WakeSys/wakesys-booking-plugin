export declare const DEFAULT_MOBILE_BREAKPOINT = 768;
/** Falls back to the default on NaN, non-numeric, or non-positive input. */
export declare function normalizeBreakpoint(value: unknown): number;
/**
 * Neither a width-only nor a shorter-dimension-only check asks the question
 * that actually matters: is this a touch device?
 *
 *  - Width alone (`innerWidth < breakpoint`) misses landscape phones: at
 *    844x390 the panel is a 428px-wide dialog sliding over a 390px-tall
 *    viewport, and the CSS media query (max-width only) doesn't hide it
 *    either, because the width is 844.
 *  - The shorter dimension alone (`min(w, h) < breakpoint`) misreads short
 *    desktop windows, e.g. 1440x720, as mobile.
 *
 * So: mobile if the width alone is below the breakpoint (portrait phones,
 * narrow desktop windows), OR the device has a coarse (touch) pointer AND
 * its shorter dimension is below the breakpoint (landscape phones). A fine
 * pointer with a short window (short desktop) is never mobile via the
 * second clause, and an environment without matchMedia is treated as not
 * coarse rather than throwing.
 */
export declare function isMobile(breakpoint: number): boolean;
export declare function mobileMediaQuery(breakpoint: number): string;
