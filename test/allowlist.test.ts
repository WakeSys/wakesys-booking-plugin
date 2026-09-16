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
    expect(isAllowedUrl('http://wakesys.app/park/booking', 'wakesys.app')).toBe(false);
    expect(isAllowedUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects localhost when the page is not on localhost', () => {
    expect(isAllowedUrl('http://localhost:3000/park/booking', 'wakesys.app')).toBe(false);
    expect(isAllowedUrl('http://localhost:3000/park/booking', 'example.com')).toBe(false);
    expect(isAllowedUrl('http://127.0.0.1:3000/park/booking', '')).toBe(false);
  });

  it('accepts localhost booking URLs only from a localhost page', () => {
    expect(isAllowedUrl('http://localhost:3000/park/booking', 'localhost')).toBe(true);
    expect(isAllowedUrl('http://localhost:8080/park/booking', 'localhost')).toBe(true);
    expect(isAllowedUrl('http://127.0.0.1:3000/park/booking', '127.0.0.1')).toBe(true);
    expect(isAllowedUrl('http://127.0.0.1:3000/park/booking', 'localhost')).toBe(true);
  });

  it('rejects lookalike local hostnames even from a localhost page', () => {
    expect(isAllowedUrl('http://localhost.evil.com/park/booking', 'localhost')).toBe(false);
    expect(isAllowedUrl('http://192.168.1.10:3000/park/booking', 'localhost')).toBe(false);
    expect(isAllowedUrl('javascript:alert(1)', 'localhost')).toBe(false);
  });

  it('defaults the page hostname to window.location (localhost under jsdom)', () => {
    // jsdom serves tests from http://localhost:3000
    expect(isAllowedUrl('http://localhost:3000/park/booking')).toBe(true);
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
