/**
 * Booking is served path-based from these origins: wakesys.app/<park>/booking.
 * Exact origin match only — per-park subdomains are marketing sites, not
 * booking origins, and must not be framed.
 */
export const ALLOWED_ORIGINS: readonly string[] = [
  'https://wakesys.app',
  'https://staging.wakesys.app',
];

export function isAllowedUrl(url: string): boolean {
  try {
    return ALLOWED_ORIGINS.includes(new URL(url).origin);
  } catch {
    return false;
  }
}
