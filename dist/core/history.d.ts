export declare function pushPanelState(): void;
/** Pops an entry this module pushed. No-op if it pushed none. */
export declare function popPanelState(): void;
/** Records that the browser popped our entry (popstate), without navigating. */
export declare function notePopped(): void;
export declare function getDepth(): number;
export declare function resetDepth(): void;
