/**
 * Depth is tracked here rather than read back from history.state, because any
 * host replaceState (Next.js scroll restoration, most analytics SDKs) replaces
 * the state object and would erase a flag stored there.
 */
let depth = 0;

export function pushPanelState(): void {
  try {
    history.pushState({ wakesysPanel: true }, '');
    depth += 1;
  } catch {
    // pushState throws SecurityError on opaque origins (file://, sandboxed
    // frames without allow-same-origin). The panel still works; it just
    // won't participate in back-button navigation.
  }
}

/** Pops an entry this module pushed. No-op if it pushed none. */
export function popPanelState(): void {
  if (depth === 0) return;
  depth -= 1;
  history.back();
}

/** Records that the browser popped our entry (popstate), without navigating. */
export function notePopped(): void {
  if (depth > 0) depth -= 1;
}

export function getDepth(): number {
  return depth;
}

export function resetDepth(): void {
  depth = 0;
}
