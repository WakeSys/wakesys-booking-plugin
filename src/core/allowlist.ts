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
export const ALLOWED_ORIGINS: readonly string[] = [
  'https://wakesys.app',
  'https://staging.wakesys.app',
];

const LOCAL_HOSTNAMES: readonly string[] = ['localhost', '127.0.0.1', '[::1]'];

function isLocalHostname(hostname: string): boolean {
  return LOCAL_HOSTNAMES.includes(hostname);
}

/**
 * `pageHostname` is the hostname of the page embedding the panel; it only
 * exists as a parameter so tests can pin it — callers omit it.
 */
export function isAllowedUrl(
  url: string,
  pageHostname: string = typeof window === 'undefined'
    ? ''
    : window.location.hostname
): boolean {
  try {
    const parsed = new URL(url);
    if (ALLOWED_ORIGINS.includes(parsed.origin)) return true;
    return (
      isLocalHostname(pageHostname) &&
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      isLocalHostname(parsed.hostname)
    );
  } catch {
    return false;
  }
}
