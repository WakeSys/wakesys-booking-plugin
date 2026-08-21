/**
 * Booking is served path-based from these origins: wakesys.app/<park>/booking.
 * Exact origin match only — per-park subdomains are marketing sites, not
 * booking origins, and must not be framed.
 */
export declare const ALLOWED_ORIGINS: readonly string[];
export declare function isAllowedUrl(url: string): boolean;
