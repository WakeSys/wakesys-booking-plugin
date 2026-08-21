import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { bootFromDom } from '../src/iife';
import { resetDepth } from '../src/core/history';

const URL_A = 'https://wakesys.app/park-a/booking';

let instance: ReturnType<typeof bootFromDom>;

function mountContainer(attrs: Record<string, string>) {
  const div = document.createElement('div');
  div.id = 'wakesys-app';
  for (const [k, v] of Object.entries(attrs)) div.setAttribute(k, v);
  document.body.appendChild(div);
  return div;
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  resetDepth();
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
  vi.spyOn(history, 'pushState').mockImplementation(() => {});
  vi.spyOn(history, 'back').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  delete (window as { BookingPanel?: unknown }).BookingPanel;
});

afterEach(() => { instance?.destroy(); vi.restoreAllMocks(); });

describe('boot', () => {
  it('returns null and defines a no-op global when the container is missing', () => {
    instance = bootFromDom();
    expect(instance).toBeNull();
    expect(typeof window.BookingPanel!.open).toBe('function');
    expect(() => window.BookingPanel!.open()).not.toThrow();
  });

  it('returns null and defines a no-op global when the url is disallowed', () => {
    mountContainer({ 'data-wakesys-url': 'https://evil.com/booking' });
    instance = bootFromDom();
    expect(instance).toBeNull();
    expect(() => window.BookingPanel!.open()).not.toThrow();
  });

  it('boots and exposes a working global', () => {
    mountContainer({ 'data-wakesys-url': URL_A });
    instance = bootFromDom();
    expect(instance).not.toBeNull();
    window.BookingPanel!.open();
    expect(instance!.isOpen()).toBe(true);
  });
});

describe('button binding', () => {
  it('opens with an offer appended', () => {
    mountContainer({ 'data-wakesys-url': URL_A });
    const btn = document.createElement('button');
    btn.setAttribute('data-wakesys-book', 'aqua-session');
    document.body.appendChild(btn);

    instance = bootFromDom();
    btn.click();
    expect(document.querySelector('iframe')!.getAttribute('src'))
      .toBe(`${URL_A}?offer=aqua-session`);
  });

  it('reads the offer at click time, not bind time', () => {
    mountContainer({ 'data-wakesys-url': URL_A });
    const btn = document.createElement('button');
    btn.setAttribute('data-wakesys-book', 'old-offer');
    document.body.appendChild(btn);

    instance = bootFromDom();
    btn.setAttribute('data-wakesys-book', 'new-offer'); // SPA re-render
    btn.click();
    expect(document.querySelector('iframe')!.getAttribute('src'))
      .toBe(`${URL_A}?offer=new-offer`);
  });

  it('upgrades booking anchors but not lookalike paths', () => {
    mountContainer({ 'data-wakesys-url': URL_A });
    const good = document.createElement('a');
    good.href = URL_A;
    const bad = document.createElement('a');
    bad.href = 'https://wakesys.app/park-a/booking-terms';
    document.body.append(good, bad);

    instance = bootFromDom();
    const e1 = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    good.dispatchEvent(e1);
    expect(e1.defaultPrevented).toBe(true);

    const e2 = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    bad.dispatchEvent(e2);
    expect(e2.defaultPrevented).toBe(false);
  });

  it('leaves modified clicks to the browser', () => {
    mountContainer({ 'data-wakesys-url': URL_A });
    const btn = document.createElement('button');
    btn.setAttribute('data-wakesys-book', '');
    document.body.appendChild(btn);
    instance = bootFromDom();

    for (const mod of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { button: 1 }]) {
      const e = new MouseEvent('click', { bubbles: true, cancelable: true, ...mod });
      btn.dispatchEvent(e);
      expect(e.defaultPrevented).toBe(false);
    }
  });
});

describe('attribute parsing', () => {
  it('falls back to 768 on a malformed breakpoint', () => {
    mountContainer({ 'data-wakesys-url': URL_A, 'data-wakesys-mobile': 'wide' });
    instance = bootFromDom();
    expect(document.head.querySelector('style')!.textContent)
      .toContain('(max-width:767px)');
  });

  it('ignores an invalid position', () => {
    mountContainer({ 'data-wakesys-url': URL_A, 'data-wakesys-position': 'top' });
    instance = bootFromDom();
    expect(document.head.querySelector('style')!.textContent).toContain('right:0');
  });
});
