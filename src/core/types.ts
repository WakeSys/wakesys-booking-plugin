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
}

export interface BookingPanelInstance {
  open(url?: string): void;
  close(): void;
  isOpen(): boolean;
  /** Replaces the default URL. Safe to call on every render. */
  setBookingUrl(url: string): void;
  /** The current default URL, for callers that need to append an offer. */
  getBookingUrl(): string;
  /** Removes all DOM and listeners. Safe to call twice. */
  destroy(): void;
}
