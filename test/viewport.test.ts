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

afterEach(() => setViewport(1024, 768));

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
  it('uses width only, so short desktop windows are not mobile', () => {
    setViewport(1440, 720); // height below 768 — the old bug
    expect(isMobile(768)).toBe(false);
  });

  it('is true below the breakpoint', () => {
    setViewport(375, 812);
    expect(isMobile(768)).toBe(true);
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
