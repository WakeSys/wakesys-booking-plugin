export interface BookingPanelConfig {
  /** Must pass isAllowedUrl. Panel refuses to open otherwise. */
  bookingUrl: string;
  /** Viewport width below which booking opens in a new tab. Default 768. */
  mobileBreakpoint?: number;
  /** Side the panel slides in from. Default 'right'. */
  position?: 'left' | 'right';
  /** Panel header text and aria-label. Default 'Booking'. */
  title?: string;
  /**
   * Called instead of window.open when the viewport is below the breakpoint.
   * Return true to signal the caller handled it; anything else falls through
   * to window.open.
   */
  onMobileOpen?: (url: string) => boolean | void;
  /**
   * Called on every real open/close transition: the close button, the
   * overlay, Escape, browser back, the mobile-resize auto-close, and
   * destroy() while open, in addition to open()/close() calls. Not called
   * for no-op calls (e.g. close() while already closed).
   */
  onOpenChange?: (isOpen: boolean) => void;
}

export interface BookingPanelInstance {
  open(url?: string): void;
  close(): void;
  isOpen(): boolean;
  /** Replaces the default URL. Safe to call on every render. */
  setBookingUrl(url: string): void;
  /** The current default URL, for callers that need to append an offer. */
  getBookingUrl(): string;
  /**
   * An empty container between the header and the iframe, for a caller to
   * fill with its own content (e.g. a demo-mode notice). Carries no styling
   * of its own beyond the `ws-notice` class, so an untouched slot is
   * invisible: no padding, no border, no height. The package has no opinion
   * on what goes in it.
   */
  getNoticeSlot(): HTMLElement;
  /** Removes all DOM and listeners. Safe to call twice. */
  destroy(): void;
}
