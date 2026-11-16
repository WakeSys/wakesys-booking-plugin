import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { bootFromDom } from '../src/iife';
import { withoutAttribution } from '../src/core/attribution';

const URL_A = 'https://wakesys.app/park-a/booking';
const FBP = 'fb.1.1700000000000.1234567890';
const FBP_LATER = 'fb.1.1700000999999.9999999999';

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/`;
}
function clearCookies() {
  for (const c of ['_fbp', '_ga', '_fbc']) document.cookie = `${c}=; max-age=0; path=/`;
}
function link(href: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = 'Book';
  document.body.appendChild(a);
  return a;
}
function press(el: Element, type: string, init: MouseEventInit = {}) {
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init }));
}
const params = (url: string) => new URL(url).searchParams;

let instance: ReturnType<typeof bootFromDom> = null;

beforeEach(() => {
  document.body.innerHTML = '';
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
  localStorage.clear();
  clearCookies();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  history.replaceState(null, '', '/?fbclid=IwAR1&utm_source=facebook&utm_campaign=bf');
});

afterEach(() => {
  instance?.destroy();
  instance = null;
  vi.restoreAllMocks();
  localStorage.clear();
  clearCookies();
  history.replaceState(null, '', '/');
});

describe('link forwarding without a panel (park only links to wakesys)', () => {
  it('decorates a booking link on press, from plugin.js alone', () => {
    instance = bootFromDom(); // no #wakesys-app on the page
    expect(instance).toBeNull();
    const a = link(URL_A);
    press(a, 'mousedown');
    expect(params(a.href).get('fbclid')).toBe('IwAR1');
    expect(params(a.href).get('utm_campaign')).toBe('bf');
  });

  it('carries the landing params to a later page that has none', () => {
    bootFromDom();
    history.replaceState(null, '', '/about');
    bootFromDom();
    const a = link(URL_A);
    press(a, 'mousedown');
    expect(params(a.href).get('fbclid')).toBe('IwAR1');
  });

  it('leaves links to anywhere else alone', () => {
    bootFromDom();
    const a = link('https://www.example.com/contact');
    const evil = link('https://wakesys.app.evil.com/p/booking');
    press(a, 'mousedown');
    press(evil, 'mousedown');
    expect(a.href).toBe('https://www.example.com/contact');
    expect(evil.href).toBe('https://wakesys.app.evil.com/p/booking');
  });

  it('covers "open in new tab" from the context menu and keyboard Enter', () => {
    bootFromDom();
    const a = link(URL_A);
    a.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    expect(params(a.href).get('fbclid')).toBe('IwAR1');
    const b = link(`${URL_A}?x=1`);
    b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(params(b.href).get('fbclid')).toBe('IwAR1');
  });

  it('keeps params already on the link, and is idempotent', () => {
    bootFromDom();
    const a = link(`${URL_A}?utm_source=newsletter`);
    press(a, 'mousedown');
    const once = a.href;
    press(a, 'mousedown');
    expect(a.href).toBe(once);
    expect(params(a.href).get('utm_source')).toBe('newsletter');
    expect(params(a.href).has('utm_campaign')).toBe(false);
  });

  it('exposes window.wakesysDecorateBookingUrl for custom buttons', () => {
    bootFromDom();
    expect(params(window.wakesysDecorateBookingUrl!(URL_A)).get('fbclid')).toBe('IwAR1');
  });

  it('does not stack listeners across re-boots', () => {
    const spy = vi.spyOn(document, 'addEventListener');
    bootFromDom();
    bootFromDom();
    const remove = vi.spyOn(document, 'removeEventListener');
    bootFromDom();
    expect(remove).toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
  });
});

describe('link forwarding with a panel', () => {
  function mountPanel() {
    const div = document.createElement('div');
    div.id = 'wakesys-app';
    div.setAttribute('data-wakesys-url', URL_A);
    document.body.appendChild(div);
    instance = bootFromDom();
  }

  it('decorates a Ctrl-clicked panel link, which the panel hands to the browser', () => {
    const a = link(URL_A);
    mountPanel();
    press(a, 'mousedown', { ctrlKey: true });
    press(a, 'click', { ctrlKey: true });
    expect(params(a.href).get('fbclid')).toBe('IwAR1');
    expect(instance!.isOpen()).toBe(false);
  });

  it('resumes the booking when the same link, decorated in place, is pressed again', () => {
    const a = link(URL_A); // present at boot, so the panel binds it
    mountPanel();
    press(a, 'mousedown');
    press(a, 'click');
    expect(instance!.isOpen()).toBe(true);
    const frame = document.querySelector('iframe')!;
    const firstSrc = frame.getAttribute('src');
    instance!.close();

    // The park's Pixel sets a new _fbp before the second press, so the
    // in-place decoration differs from the first. The booking must survive.
    setCookie('_fbp', FBP);
    setCookie('_fbp', FBP_LATER);
    press(a, 'mousedown');
    press(a, 'click');
    expect(instance!.isOpen()).toBe(true);
    expect(frame.getAttribute('src')).toBe(firstSrc);
  });

  it('stops forwarding when the panel is destroyed', () => {
    mountPanel();
    instance!.destroy();
    instance = null;
    const a = link(URL_A);
    press(a, 'mousedown');
    expect(a.href).toBe(URL_A);
  });
});

describe('withoutAttribution', () => {
  it('strips exactly what withAttribution can add, and nothing else', () => {
    expect(
      withoutAttribution(`${URL_A}?offerId=1&fbclid=x&utm_source=y&_fbp=${FBP}&_ga=GA1.1.1.1&gclid=z`),
    ).toBe(`${URL_A}?offerId=1`);
  });
});
