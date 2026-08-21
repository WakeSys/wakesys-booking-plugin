import type { BookingPanelConfig, BookingPanelInstance } from './types';
import { isAllowedUrl } from './allowlist';
import { createPanel } from './panel';

export function createBookingPanel(config: BookingPanelConfig): BookingPanelInstance {
  if (!isAllowedUrl(config.bookingUrl)) {
    throw new Error(
      `[wakesys] bookingUrl must point to wakesys.app or staging.wakesys.app, got: ${config.bookingUrl}`,
    );
  }
  return createPanel(config);
}

export { isAllowedUrl, ALLOWED_ORIGINS } from './allowlist';
export { DEFAULT_MOBILE_BREAKPOINT } from './viewport';
export type { BookingPanelConfig, BookingPanelInstance } from './types';
