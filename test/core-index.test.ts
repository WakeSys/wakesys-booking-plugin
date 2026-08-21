import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  createBookingPanel, isAllowedUrl, ALLOWED_ORIGINS, DEFAULT_MOBILE_BREAKPOINT,
} from '../src/core';

let panel: ReturnType<typeof createBookingPanel> | undefined;
afterEach(() => { panel?.destroy(); panel = undefined; });

describe('createBookingPanel', () => {
  it('returns the documented instance surface', () => {
    panel = createBookingPanel({ bookingUrl: 'https://wakesys.app/p/booking' });
    for (const key of ['open', 'close', 'isOpen', 'setBookingUrl', 'destroy']) {
      expect(typeof (panel as unknown as Record<string, unknown>)[key]).toBe('function');
    }
  });

  it('refuses to construct with a disallowed url', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => createBookingPanel({ bookingUrl: 'https://evil.com/booking' })).toThrow(
      /must point to wakesys\.app/,
    );
    warn.mockRestore();
  });

  it('re-exports the allowlist helpers', () => {
    expect(isAllowedUrl('https://wakesys.app/p/booking')).toBe(true);
    expect(ALLOWED_ORIGINS).toHaveLength(2);
    expect(DEFAULT_MOBILE_BREAKPOINT).toBe(768);
  });
});
