/**
 * Booking is served path-based from these origins: wakesys.app/<park>/booking.
 * Exact origin match only — per-park subdomains are marketing sites, not
 * booking origins, and must not be framed.
 *
 * Local development is the one exception: a page that is itself served from
 * localhost may frame a localhost booking app (any port, http allowed). A
 * page on any other host can never frame localhost, so production behavior
 * is unchanged.
 */
export declare const ALLOWED_ORIGINS: readonly string[];
/**
 * `pageHostname` is the hostname of the page embedding the panel; it only
 * exists as a parameter so tests can pin it — callers omit it.
 */
export declare function isAllowedUrl(url: string, pageHostname?: string): boolean;
