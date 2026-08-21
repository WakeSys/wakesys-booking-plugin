import { describe, it, expect, afterEach } from 'vitest';
import {
  DEFAULT_MOBILE_BREAKPOINT,
  normalizeBreakpoint,
  isMobile,
  mobileMediaQuery,
} from '../src/core/viewport';

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
}

/** jsdom has no matchMedia at all (not even a stub) unless a test installs one. */
function mockPointer(coarse: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('coarse') ? coarse : !coarse,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  setViewport(1024, 768);
  // @ts-expect-error -- jsdom doesn't define this itself; undo any test's mock.
  delete window.matchMedia;
});

describe('normalizeBreakpoint', () => {
  it('defaults when the value is missing or unparseable', () => {
    expect(normalizeBreakpoint(undefined)).toBe(768);
    expect(normalizeBreakpoint(null)).toBe(768);
    expect(normalizeBreakpoint('')).toBe(768);
    expect(normalizeBreakpoint('abc')).toBe(768);
    expect(normalizeBreakpoint(NaN)).toBe(768);
  });

  it('defaults on non-positive values', () => {
    expect(normalizeBreakpoint(0)).toBe(768);
    expect(normalizeBreakpoint(-100)).toBe(768);
  });

  it('accepts numbers and numeric strings', () => {
    expect(normalizeBreakpoint(1024)).toBe(1024);
    expect(normalizeBreakpoint('1024')).toBe(1024);
  });
});

describe('isMobile', () => {
  it('is true below the breakpoint (portrait phone)', () => {
    setViewport(375, 812);
    expect(isMobile(768)).toBe(true);
  });

  it('is true for a landscape phone: width above the breakpoint, coarse pointer, shorter dimension below it', () => {
    setViewport(844, 390);
    mockPointer(true);
    expect(isMobile(768)).toBe(true);
  });

  it('stays false for a short desktop window even with matchMedia present, because the pointer is fine', () => {
    setViewport(1440, 720); // height below 768 - the old min(w,h) bug
    mockPointer(false);
    expect(isMobile(768)).toBe(false);
  });

  it('is false for a normal desktop viewport', () => {
    setViewport(1280, 900);
    mockPointer(false);
    expect(isMobile(768)).toBe(false);
  });

  it('treats a missing matchMedia as not-coarse, rather than throwing', () => {
    setViewport(844, 390); // landscape-phone-shaped, but no matchMedia to prove it's coarse
    expect(() => isMobile(768)).not.toThrow();
    expect(isMobile(768)).toBe(false);
  });

  it('is false exactly at the breakpoint', () => {
    setViewport(768, 1024);
    expect(isMobile(768)).toBe(false);
  });
});

describe('mobileMediaQuery', () => {
  it('is one pixel below the breakpoint so it matches isMobile', () => {
    expect(mobileMediaQuery(768)).toBe('(max-width:767px)');
  });
});

it('exports the documented default', () => {
  expect(DEFAULT_MOBILE_BREAKPOINT).toBe(768);
});
