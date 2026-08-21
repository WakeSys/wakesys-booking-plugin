export declare const FOCUSABLE_SELECTOR = "button, [href], input, select, textarea, iframe, [tabindex]:not([tabindex=\"-1\"])";
/**
 * Cycles focus within the container. Note the iframe is in the selector but
 * once focus is inside a cross-origin document the host page stops receiving
 * keydown, so the trap cannot follow it. See the known limitation in README.
 */
export declare function handleTabKey(e: KeyboardEvent, container: HTMLElement): void;
