import { describe, it, expect } from 'vitest';
import { isAllowedUrl, ALLOWED_ORIGINS } from '../src/core/allowlist';

describe('isAllowedUrl', () => {
  it('accepts the two production origins', () => {
    expect(isAllowedUrl('https://wakesys.app/park/booking')).toBe(true);
    expect(isAllowedUrl('https://staging.wakesys.app/park/booking')).toBe(true);
  });

  it('accepts regardless of path, query or hash', () => {
    expect(isAllowedUrl('https://wakesys.app/p/booking?offer=x#y')).toBe(true);
  });

  it('rejects lookalike hostnames', () => {
    expect(isAllowedUrl('https://evilwakesys.app/park/booking')).toBe(false);
    expect(isAllowedUrl('https://wakesys.app.evil.com/booking')).toBe(false);
    expect(isAllowedUrl('https://notwakesys.app/booking')).toBe(false);
  });

  it('rejects per-park subdomains (booking is path-based)', () => {
    expect(isAllowedUrl('https://splishsplash.wakesys.app/booking')).toBe(false);
  });

  it('rejects insecure and non-http schemes', () => {
    expect(isAllowedUrl('http://wakesys.app/park/booking')).toBe(false);
    expect(isAllowedUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects localhost', () => {
    expect(isAllowedUrl('http://localhost:3000/park/booking')).toBe(false);
  });

  it('rejects the retired legacy origin', () => {
    expect(isAllowedUrl('https://app.wakesys.com/park/booking')).toBe(false);
  });

  it('rejects unparseable input without throwing', () => {
    expect(isAllowedUrl('')).toBe(false);
    expect(isAllowedUrl('//wakesys.app/booking')).toBe(false);
    expect(isAllowedUrl('not a url')).toBe(false);
  });

  it('exports exactly two origins', () => {
    expect([...ALLOWED_ORIGINS]).toEqual([
      'https://wakesys.app',
      'https://staging.wakesys.app',
    ]);
  });
});
