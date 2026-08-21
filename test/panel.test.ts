import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createPanel } from '../src/core/panel';
import { resetDepth, getDepth } from '../src/core/history';

const URL_A = 'https://wakesys.app/park-a/booking';
const URL_B = 'https://wakesys.app/park-b/booking';

function setWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
}

let panel: ReturnType<typeof createPanel>;

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  resetDepth();
  setWidth(1280);
  vi.spyOn(history, 'pushState').mockImplementation(() => {});
  vi.spyOn(history, 'back').mockImplementation(() => {});
});

afterEach(() => {
  panel?.destroy();
  vi.restoreAllMocks();
});

describe('panel mounting', () => {
  it('mounts on body, not on an arbitrary container', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    panel = createPanel({ bookingUrl: URL_A });

    const el = document.querySelector('.ws-panel')!;
    expect(el.parentElement).toBe(document.body);
    expect(host.children).toHaveLength(0);
  });

  it('marks the closed panel inert', () => {
    panel = createPanel({ bookingUrl: URL_A });
    expect(document.querySelector('.ws-panel')!.hasAttribute('inert')).toBe(true);
  });
});

describe('open / close', () => {
  it('shows the panel and loads the url', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();

    const el = document.querySelector('.ws-panel')!;
    expect(panel.isOpen()).toBe(true);
    expect(el.classList.contains('ws-show')).toBe(true);
    expect(el.hasAttribute('inert')).toBe(false);
    expect(document.body.classList.contains('ws-lock')).toBe(true);
    expect(document.querySelector('iframe')!.getAttribute('src')).toBe(URL_A);
  });

  it('refuses a disallowed url', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.open('https://evil.com/booking');
    expect(panel.isOpen()).toBe(false);
  });

  it('pushes exactly one history entry even if open is called twice', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();
    panel.open(URL_B);
    expect(history.pushState).toHaveBeenCalledTimes(1);
  });

  it('unlocks the body and clears the iframe on close', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();
    panel.close();
    expect(panel.isOpen()).toBe(false);
    expect(document.body.classList.contains('ws-lock')).toBe(false);
    expect(document.querySelector('iframe')!.hasAttribute('src')).toBe(false);
    expect(history.back).toHaveBeenCalledTimes(1);
  });

  it('reapplies inert to the panel on close', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();
    expect(document.querySelector('.ws-panel')!.hasAttribute('inert')).toBe(false);

    panel.close();
    expect(document.querySelector('.ws-panel')!.hasAttribute('inert')).toBe(true);
  });

  it('restores focus to the previously focused element', () => {
    vi.useFakeTimers();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    panel = createPanel({ bookingUrl: URL_A });
    panel.open();

    // Let the panel's own post-open focus move actually happen first, so
    // closing genuinely has to move focus back rather than merely leaving
    // it where it already was.
    vi.advanceTimersByTime(150);
    expect(document.activeElement).toBe(document.querySelector('.ws-close'));

    panel.close();
    expect(document.activeElement).toBe(trigger);
    vi.useRealTimers();
  });
});

describe('mobile', () => {
  it('opens a new tab instead of the panel', () => {
    setWidth(375);
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();

    expect(openSpy).toHaveBeenCalledWith(URL_A, '_blank', 'noopener');
    expect(panel.isOpen()).toBe(false);
  });

  it('defers to onMobileOpen when it returns true', () => {
    setWidth(375);
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const onMobileOpen = vi.fn().mockReturnValue(true);
    panel = createPanel({ bookingUrl: URL_A, onMobileOpen });

    panel.open();
    expect(onMobileOpen).toHaveBeenCalledWith(URL_A);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('falls through to window.open when onMobileOpen returns nothing', () => {
    setWidth(375);
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    panel = createPanel({ bookingUrl: URL_A, onMobileOpen: () => undefined });
    panel.open();
    expect(openSpy).toHaveBeenCalled();
  });
});

describe('resize', () => {
  it('closes and unlocks when the viewport drops below the breakpoint', () => {
    vi.useFakeTimers();
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();

    setWidth(500);
    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(200);

    expect(panel.isOpen()).toBe(false);
    expect(document.body.classList.contains('ws-lock')).toBe(false);
    vi.useRealTimers();
  });
});

describe('popstate', () => {
  it('hides without calling history.back when the browser pops the entry', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();
    expect(getDepth()).toBe(1);

    // Simulate the browser's own back navigation: the entry is already gone
    // by the time this fires, so the handler must not navigate again.
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));

    expect(panel.isOpen()).toBe(false);
    expect(document.body.classList.contains('ws-lock')).toBe(false);
    expect(getDepth()).toBe(0);
    expect(history.back).not.toHaveBeenCalled();
  });
});

describe('keyboard', () => {
  it('closes on Escape', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(panel.isOpen()).toBe(false);
  });

  it('ignores Escape when already closed', () => {
    panel = createPanel({ bookingUrl: URL_A });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(history.back).not.toHaveBeenCalled();
  });
});

describe('setBookingUrl / getBookingUrl', () => {
  it('changes the default target', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.setBookingUrl(URL_B);
    panel.open();
    expect(document.querySelector('iframe')!.getAttribute('src')).toBe(URL_B);
  });

  it('reports the current default url', () => {
    panel = createPanel({ bookingUrl: URL_A });
    expect(panel.getBookingUrl()).toBe(URL_A);
    panel.setBookingUrl(URL_B);
    expect(panel.getBookingUrl()).toBe(URL_B);
  });

  it('ignores a disallowed url', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.setBookingUrl('https://evil.com/booking');
    panel.open();
    expect(document.querySelector('iframe')!.getAttribute('src')).toBe(URL_A);
  });
});

describe('destroy', () => {
  it('removes DOM, styles and listeners, and is safe twice', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();
    panel.destroy();

    expect(document.querySelector('.ws-panel')).toBeNull();
    expect(document.querySelector('.ws-overlay')).toBeNull();
    expect(document.head.querySelector('style[data-wakesys-booking]')).toBeNull();
    expect(document.body.classList.contains('ws-lock')).toBe(false);
    expect(() => panel.destroy()).not.toThrow();
  });

  it('does not double-release the shared stylesheet when destroyed twice', () => {
    // The real risk isn't destroy() throwing (a Math.max clamp in styles.ts
    // would hide that either way) — it's a second, unguarded teardown
    // decrementing the shared style refcount again and pulling the
    // stylesheet out from under a sibling instance that is still mounted.
    const a = createPanel({ bookingUrl: URL_A });
    const b = createPanel({ bookingUrl: URL_A });
    panel = b; // let afterEach clean up b

    a.destroy();
    expect(document.head.querySelector('style[data-wakesys-booking]')).not.toBeNull();

    a.destroy(); // idempotent: must not release a second time
    expect(document.head.querySelector('style[data-wakesys-booking]')).not.toBeNull();

    b.destroy();
    expect(document.head.querySelector('style[data-wakesys-booking]')).toBeNull();
  });

  it('removes the iframe load listener so a stale load event no longer touches panel state', () => {
    panel = createPanel({ bookingUrl: URL_A });
    const iframeEl = document.querySelector('iframe')!;
    const spinnerEl = document.querySelector('.ws-spinner')!;
    panel.destroy();

    // The node was detached by destroy(), but the reference is still live in
    // this scope, so dispatching directly on it proves whether the 'load'
    // listener itself was removed (as opposed to merely being unreachable).
    iframeEl.dispatchEvent(new Event('load'));
    expect(spinnerEl.classList.contains('ws-hidden')).toBe(false);
  });

  it('pops its own history entry and restores focus when destroyed while open', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    panel = createPanel({ bookingUrl: URL_A });
    panel.open();
    expect(getDepth()).toBe(1);

    panel.destroy();

    expect(getDepth()).toBe(0);
    expect(document.body.classList.contains('ws-lock')).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('makes close() and isOpen() no-ops on a destroyed instance, without touching a live sibling', () => {
    const a = createPanel({ bookingUrl: URL_A });
    const b = createPanel({ bookingUrl: URL_A });
    panel = b; // let afterEach clean up b

    a.open();
    a.destroy(); // destroys while open: pops its own entry via the fixed teardown

    b.open();
    expect(document.body.classList.contains('ws-lock')).toBe(true);
    const depthBeforeStaleClose = getDepth();
    const backCallsBeforeStaleClose = (history.back as ReturnType<typeof vi.fn>).mock.calls.length;

    a.close(); // stale handle: must be a complete no-op

    expect(a.isOpen()).toBe(false);
    expect(b.isOpen()).toBe(true);
    expect(document.body.classList.contains('ws-lock')).toBe(true);
    expect(getDepth()).toBe(depthBeforeStaleClose);
    expect(history.back).toHaveBeenCalledTimes(backCallsBeforeStaleClose);
  });
});
