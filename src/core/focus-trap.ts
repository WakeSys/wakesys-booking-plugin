export const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])';

/**
 * Cycles focus within the container. Note the iframe is in the selector but
 * once focus is inside a cross-origin document the host page stops receiving
 * keydown, so the trap cannot follow it. See the known limitation in README.
 */
export function handleTabKey(e: KeyboardEvent, container: HTMLElement): void {
  const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  if (focusables.length === 0) return;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    last.focus();
    e.preventDefault();
  } else if (!e.shiftKey && document.activeElement === last) {
    first.focus();
    e.preventDefault();
  }
}
