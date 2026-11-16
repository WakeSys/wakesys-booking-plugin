import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createPanel } from '../src/core/panel';
import { createBookingPanel } from '../src/core';
import { bootFromDom } from '../src/iife';
import { STORAGE_KEY } from '../src/core/attribution';

const URL_A = 'https://wakesys.app/park-a/booking';
const OFFER_URL = 'https://wakesys.app/park-a/booking/email?offerId=1&productId=2';
const FBP = 'fb.1.1700000000000.1234567890';
const FBP_LATER = 'fb.1.1700000999999.9999999999';
const GA = 'GA1.1.123456789.1700000000';

function setWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
}
function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/`;
}
function clearCookies() {
  for (const c of ['_fbp', '_ga', '_fbc']) document.cookie = `${c}=; max-age=0; path=/`;
}

const iframe = () => document.querySelector('iframe')!;
const params = (url: string) => new URL(url).searchParams;

/** Records every write to the panel iframe's src. */
function watchSrc() {
  const writes: string[] = [];
  const el = iframe();
  const proto = Object.getPrototypeOf(el) as HTMLIFrameElement;
  const original = Object.getOwnPropertyDescriptor(proto, 'src')!;
  Object.defineProperty(el, 'src', {
    configurable: true,
    get: () => original.get!.call(el),
    set: (v: string) => { writes.push(v); original.set!.call(el, v); },
  });
  return writes;
}

let panel: { destroy(): void } | null = null;

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  setWidth(1280);
  localStorage.clear();
  clearCookies();
  // The ad landing page the visitor is on.
  history.replaceState(null, '', '/?fbclid=IwAR1&utm_source=facebook&utm_campaign=summer');
});

afterEach(() => {
  panel?.destroy();
  panel = null;
  vi.restoreAllMocks();
  localStorage.clear();
  clearCookies();
  history.replaceState(null, '', '/');
});

describe('desktop: iframe', () => {
  it('loads the booking URL with the attribution appended', () => {
    setCookie('_fbp', FBP);
    setCookie('_ga', GA);
    const p = createPanel({ bookingUrl: URL_A });
    panel = p;
    p.open();

    const src = iframe().getAttribute('src')!;
    expect(src.startsWith(`${URL_A}?`)).toBe(true);
    expect(Object.fromEntries(params(src))).toEqual({
      fbclid: 'IwAR1', utm_source: 'facebook', utm_campaign: 'summer', _fbp: FBP, _ga: GA,
    });
  });

  it('keeps the target\'s own query and adds to it', () => {
    const p = createPanel({ bookingUrl: URL_A });
    panel = p;
    p.open(OFFER_URL);
    expect(iframe().getAttribute('src'))
      .toBe(`${OFFER_URL}&fbclid=IwAR1&utm_source=facebook&utm_campaign=summer`);
  });

  it('still refuses a disallowed URL, decoration or not', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const p = createPanel({ bookingUrl: URL_A });
    panel = p;
    p.open('https://evil.com/booking');
    expect(p.isOpen()).toBe(false);
    expect(iframe().hasAttribute('src')).toBe(false);
    expect(warn).toHaveBeenCalled();
  });

  it('resumes on a second open() with the same URL even after a new _fbp cookie appeared', () => {
    const p = createPanel({ bookingUrl: URL_A });
    panel = p;
    p.open();
    iframe().dispatchEvent(new Event('load'));
    const firstSrc = iframe().getAttribute('src')!;
    expect(params(firstSrc).has('_fbp')).toBe(false);
    p.close();

    // The park's Meta Pixel sets _fbp after the first open, so decorating
    // the same configured URL now yields a different string.
    setCookie('_fbp', FBP);
    const writes = watchSrc();

    p.open();
    expect(writes).toEqual([]); // no reload: the in-progress booking survives
    expect(iframe().getAttribute('src')).toBe(firstSrc);
    expect(p.isOpen()).toBe(true);
    expect(document.querySelector('.ws-spinner')!.classList.contains('ws-hidden')).toBe(true);
  });

  it('resumes when the cookie changes between opens (rotating _fbp)', () => {
    setCookie('_fbp', FBP);
    const p = createPanel({ bookingUrl: URL_A });
    panel = p;
    p.open();
    p.close();
    setCookie('_fbp', FBP_LATER);
    const writes = watchSrc();
    p.open();
    expect(writes).toEqual([]);
    expect(params(iframe().getAttribute('src')!).get('_fbp')).toBe(FBP);
  });

  it('decorates afresh, with the newest cookies, when a different URL is loaded', () => {
    const p = createPanel({ bookingUrl: URL_A });
    panel = p;
    p.open();
    setCookie('_fbp', FBP);
    p.open(OFFER_URL);
    expect(params(iframe().getAttribute('src')!).get('_fbp')).toBe(FBP);
  });

  it('resume pill reopens the existing document without reloading', () => {
    const p = createPanel({ bookingUrl: URL_A });
    panel = p;
    p.open();
    // Grow the shared history as a step inside the frame would.
    history.pushState(null, '', `${location.pathname}${location.search}#step`);
    p.close();
    setCookie('_fbp', FBP);
    const writes = watchSrc();
    document.querySelector<HTMLButtonElement>('.ws-resume-open')!.click();
    expect(p.isOpen()).toBe(true);
    expect(writes).toEqual([]);
  });

  it('cold-loads with the current attribution after the resume pill is dismissed', () => {
    const p = createPanel({ bookingUrl: URL_A });
    panel = p;
    p.open();
    history.pushState(null, '', `${location.pathname}${location.search}#step`);
    p.close();
    document.querySelector<HTMLButtonElement>('.ws-resume-dismiss')!.click();
    setCookie('_fbp', FBP);
    p.open();
    expect(params(iframe().getAttribute('src')!).get('_fbp')).toBe(FBP);
  });

  it('leaves the URL untouched when the visitor carries no attribution', () => {
    history.replaceState(null, '', '/');
    const p = createPanel({ bookingUrl: URL_A });
    panel = p;
    p.open();
    expect(iframe().getAttribute('src')).toBe(URL_A);
  });
});

describe('mobile: new tab', () => {
  it('opens the decorated URL with window.open', () => {
    setWidth(375);
    setCookie('_fbp', FBP);
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const p = createPanel({ bookingUrl: URL_A });
    panel = p;
    p.open();

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target, features] = openSpy.mock.calls[0];
    expect(target).toBe('_blank');
    expect(features).toBe('noopener');
    expect(Object.fromEntries(params(String(url)))).toEqual({
      fbclid: 'IwAR1', utm_source: 'facebook', utm_campaign: 'summer', _fbp: FBP,
    });
  });

  it('hands onMobileOpen the decorated URL so custom handlers forward it too', () => {
    setWidth(375);
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const onMobileOpen = vi.fn().mockReturnValue(true);
    const p = createPanel({ bookingUrl: URL_A, onMobileOpen });
    panel = p;
    p.open(OFFER_URL);

    expect(onMobileOpen).toHaveBeenCalledWith(
      `${OFFER_URL}&fbclid=IwAR1&utm_source=facebook&utm_campaign=summer`,
    );
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('refuses a disallowed URL without calling onMobileOpen or window.open', () => {
    setWidth(375);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const onMobileOpen = vi.fn();
    const p = createPanel({ bookingUrl: URL_A, onMobileOpen });
    panel = p;
    p.open('https://evil.com/booking');
    expect(onMobileOpen).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
  });
});

describe('landing params are persisted when a panel is created', () => {
  const persisted = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')?.params;

  it('by createBookingPanel (vanilla package)', () => {
    panel = createBookingPanel({ bookingUrl: URL_A });
    expect(persisted()).toEqual({ fbclid: 'IwAR1', utm_source: 'facebook', utm_campaign: 'summer' });
  });

  it('by the script-tag boot (CDN)', () => {
    vi.spyOn(history, 'pushState').mockImplementation(() => {});
    const div = document.createElement('div');
    div.id = 'wakesys-app';
    div.setAttribute('data-wakesys-url', URL_A);
    document.body.appendChild(div);
    panel = bootFromDom();
    expect(panel).not.toBeNull();
    expect(persisted()).toEqual({ fbclid: 'IwAR1', utm_source: 'facebook', utm_campaign: 'summer' });
  });

  it('and still forwarded after the visitor browses to a page without them', () => {
    const p = createBookingPanel({ bookingUrl: URL_A });
    panel = p;
    history.replaceState(null, '', '/tickets'); // client-side nav dropped the query
    p.open();
    expect(iframe().getAttribute('src'))
      .toBe(`${URL_A}?fbclid=IwAR1&utm_source=facebook&utm_campaign=summer`);
  });

  it('a script-tag booking link carries the attribution into the iframe', () => {
    const div = document.createElement('div');
    div.id = 'wakesys-app';
    div.setAttribute('data-wakesys-url', URL_A);
    const link = document.createElement('a');
    link.href = OFFER_URL;
    document.body.append(div, link);
    panel = bootFromDom();
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    expect(iframe().getAttribute('src'))
      .toBe(`${OFFER_URL}&fbclid=IwAR1&utm_source=facebook&utm_campaign=summer`);
  });

  it('never breaks panel creation when storage is blocked', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const p = createBookingPanel({ bookingUrl: URL_A });
    panel = p;
    p.open();
    expect(p.isOpen()).toBe(true);
    // Storage is gone, but the current URL's params still travel.
    expect(params(iframe().getAttribute('src')!).get('fbclid')).toBe('IwAR1');
  });
});
