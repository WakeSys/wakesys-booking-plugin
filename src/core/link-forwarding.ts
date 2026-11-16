/**
 * Decorates links to the wakesys booking app with the visitor's ad
 * attribution at the moment they are pressed.
 *
 * The panel already decorates every URL it opens itself. This covers what it
 * doesn't open:
 *   - parks that only LINK to wakesys (no #wakesys-app container): loading
 *     plugin.js alone makes their booking links carry the ad click, so a
 *     park never needs a second script for attribution;
 *   - Cmd/Ctrl/Shift/middle-clicks and "open in new tab" on panel links,
 *     which the panel hands back to the browser;
 *   - wakesys links outside the panel's booking-link pattern.
 *
 * Decoration happens on press (mousedown, touchstart, Enter, contextmenu,
 * click), not once on load, so links a site builder injects later are
 * covered and cookie values are read fresh. Params already on the link win
 * (see withAttribution), so decorating twice changes nothing.
 */
import { ALLOWED_ORIGINS } from './allowlist';
import { persistAttributionFromUrl, withAttribution } from './attribution';

function isWakesysUrl(href: string): boolean {
  try {
    return ALLOWED_ORIGINS.includes(new URL(href).origin);
  } catch {
    return false;
  }
}

/** Installs the listeners; returns a function that removes them. */
export function installLinkForwarding(doc: Document = document): () => void {
  persistAttributionFromUrl();

  const onPress = (e: Event) => {
    const target = e.target as Element | null;
    const link = target && typeof target.closest === 'function'
      ? (target.closest('a[href]') as HTMLAnchorElement | null)
      : null;
    if (!link || !isWakesysUrl(link.href)) return;
    const next = withAttribution(link.href);
    if (next !== link.href) link.href = next;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') onPress(e);
  };

  const opts = { capture: true, passive: true } as const;
  doc.addEventListener('mousedown', onPress, opts);
  doc.addEventListener('touchstart', onPress, opts);
  doc.addEventListener('contextmenu', onPress, opts);
  doc.addEventListener('click', onPress, opts);
  doc.addEventListener('keydown', onKey, opts);

  return () => {
    doc.removeEventListener('mousedown', onPress, opts);
    doc.removeEventListener('touchstart', onPress, opts);
    doc.removeEventListener('contextmenu', onPress, opts);
    doc.removeEventListener('click', onPress, opts);
    doc.removeEventListener('keydown', onKey, opts);
  };
}
