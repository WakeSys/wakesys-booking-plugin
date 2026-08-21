export declare function buildCss(breakpoint: number, position: 'left' | 'right'): string;
/** Idempotent. Refcounted so StrictMode double-mounts don't duplicate or strip. */
export declare function ensureStyles(css: string): void;
export declare function releaseStyles(): void;
