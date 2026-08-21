/**
 * Appends `?offer=<encoded>` to a booking URL, placing the query string
 * before any `#fragment`: https://wakesys.app/park-a/booking#step2 with
 * offer=aqua must become .../booking?offer=aqua#step2, not
 * .../booking#step2?offer=aqua (a query string after a fragment is part of
 * the fragment, so it would never reach the server).
 *
 * Shared by the vanilla (src/iife.ts) and React (src/react.tsx) adapters,
 * which both need to attach an offer to a booking URL that may already
 * carry a query string and/or a fragment.
 */
export function appendOffer(url: string, offer: string): string {
  const hashIndex = url.indexOf('#');
  const base = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}offer=${encodeURIComponent(offer)}${hash}`;
}
