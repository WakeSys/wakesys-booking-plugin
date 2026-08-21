import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { bootFromDom } from '../src/iife';
import { resetDepth } from '../src/core/history';
import * as core from '../src/core';

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

  // The CSS-based assertions above pass even if iife.ts's own normalization is
  // deleted outright, because core/panel.ts normalizes the same config value a
  // second time before building that CSS. These pin the check to the iife
  // layer specifically, by inspecting the config object handed to the core
  // factory rather than its downstream effect.
  it('hands the core factory a normalized breakpoint for malformed input', () => {
    const spy = vi.spyOn(core, 'createBookingPanel');
    mountContainer({ 'data-wakesys-url': URL_A, 'data-wakesys-mobile': 'wide' });
    instance = bootFromDom();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ mobileBreakpoint: 768 }));
  });

  it('hands the core factory a normalized position for invalid input', () => {
    const spy = vi.spyOn(core, 'createBookingPanel');
    mountContainer({ 'data-wakesys-url': URL_A, 'data-wakesys-position': 'top' });
    instance = bootFromDom();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ position: 'right' }));
  });
});

describe('offer url building', () => {
  it('keeps the offer query ahead of an existing fragment on the booking url', () => {
    mountContainer({ 'data-wakesys-url': `${URL_A}#step2` });
    const btn = document.createElement('button');
    btn.setAttribute('data-wakesys-book', 'aqua');
    document.body.appendChild(btn);

    instance = bootFromDom();
    btn.click();
    expect(document.querySelector('iframe')!.getAttribute('src'))
      .toBe(`${URL_A}?offer=aqua#step2`);
  });
});

describe('trigger attribute removal', () => {
  it('stops hijacking a trigger once its data-wakesys-book attribute is removed', () => {
    mountContainer({ 'data-wakesys-url': URL_A });
    const link = document.createElement('a');
    link.href = 'https://example.com/other';
    link.setAttribute('data-wakesys-book', 'x');
    document.body.appendChild(link);

    instance = bootFromDom();
    link.removeAttribute('data-wakesys-book');

    const e = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it('still opens the default url when data-wakesys-book is present but empty', () => {
    mountContainer({ 'data-wakesys-url': URL_A });
    const btn = document.createElement('button');
    btn.setAttribute('data-wakesys-book', '');
    document.body.appendChild(btn);

    instance = bootFromDom();
    btn.click();
    expect(document.querySelector('iframe')!.getAttribute('src')).toBe(URL_A);
  });
});

describe('boot failure', () => {
  it('installs the no-op global and does not throw when the core factory throws', () => {
    mountContainer({ 'data-wakesys-url': URL_A });
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'iframe') throw new Error('blocked by host CSP');
      return realCreateElement(tag);
    });

    expect(() => { instance = bootFromDom(); }).not.toThrow();
    expect(instance).toBeNull();
    expect(() => window.BookingPanel!.open()).not.toThrow();
  });
});

describe('teardown', () => {
  it('destroy() releases click listeners so a bound link behaves normally again', () => {
    mountContainer({ 'data-wakesys-url': URL_A });
    const link = document.createElement('a');
    link.href = URL_A;
    document.body.appendChild(link);

    instance = bootFromDom();
    instance!.destroy();

    const e = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it('destroy() stops binding elements added to the DOM after teardown', async () => {
    mountContainer({ 'data-wakesys-url': URL_A });
    instance = bootFromDom();
    instance!.destroy();

    const btn = document.createElement('button');
    btn.setAttribute('data-wakesys-book', '');
    document.body.appendChild(btn);

    // Give a still-connected MutationObserver's 100ms debounce time to fire,
    // if teardown failed to disconnect it.
    await new Promise((resolve) => setTimeout(resolve, 150));

    const e = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    btn.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it('re-binds elements on a fresh boot after a previous destroy', () => {
    mountContainer({ 'data-wakesys-url': URL_A });
    const btn = document.createElement('button');
    btn.setAttribute('data-wakesys-book', '');
    document.body.appendChild(btn);

    const first = bootFromDom()!;
    first.destroy();

    instance = bootFromDom();
    btn.click();
    expect(instance!.isOpen()).toBe(true);
  });
});

describe('double-bind guard', () => {
  it('binds a trigger only once, even after a MutationObserver batch re-runs bindAll()', async () => {
    mountContainer({ 'data-wakesys-url': URL_A });
    const btn = document.createElement('button');
    btn.setAttribute('data-wakesys-book', '');
    document.body.appendChild(btn);

    const openSpy = vi.fn();
    const realCreateBookingPanel = core.createBookingPanel;
    vi.spyOn(core, 'createBookingPanel').mockImplementation((config) => {
      const panel = realCreateBookingPanel(config);
      const realOpen = panel.open.bind(panel);
      panel.open = (...args: Parameters<typeof realOpen>) => {
        openSpy(...args);
        return realOpen(...args);
      };
      return panel;
    });

    instance = bootFromDom();

    // Any DOM mutation makes the MutationObserver's 100ms-debounced bindAll()
    // re-run against the same, already-bound <button>. Without the
    // `bound.has(el)` guard in bind(), this attaches a second click listener,
    // so one click below would call panel.open() twice and re-navigate the
    // iframe mid-booking.
    document.body.appendChild(document.createElement('div'));
    await new Promise((resolve) => setTimeout(resolve, 150));

    btn.click();
    expect(openSpy).toHaveBeenCalledTimes(1);
  });
});
