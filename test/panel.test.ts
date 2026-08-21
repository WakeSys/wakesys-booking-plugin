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

  it('clears the pending post-open focus timer, so it cannot steal focus after teardown (m1)', () => {
    vi.useFakeTimers();
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();

    const closeBtnEl = document.querySelector('.ws-close')! as HTMLElement;
    // jsdom no-ops .focus() on an element once it's disconnected from the
    // document, so a leaked callback wouldn't observably move
    // document.activeElement here — spy on the call itself instead.
    const focusSpy = vi.spyOn(closeBtnEl, 'focus');

    // Destroy before the 100ms post-open focus-the-close-button timer fires.
    panel.destroy();

    // Advance well past the timeout. If it wasn't cleared, the leaked
    // callback still fires against the torn-down close button.
    vi.advanceTimersByTime(200);

    expect(focusSpy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('detaches every listener it attached, by the exact same function reference (no silent no-op leaks)', () => {
    type Entry = { target: EventTarget; type: string; listener: EventListenerOrEventListenerObject };
    const added: Entry[] = [];
    const removed: Entry[] = [];

    // window.addEventListener/removeEventListener are own properties in
    // jsdom (not inherited via EventTarget.prototype), so it needs its own
    // spy; document and plain Elements go through the prototype. Capture the
    // real implementations *before* installing any spy, since spyOn replaces
    // the property in place and a later read would see the spy, not the
    // original (causing infinite recursion through the mock).
    const protoAdd = EventTarget.prototype.addEventListener;
    const protoRemove = EventTarget.prototype.removeEventListener;
    const windowAdd = window.addEventListener.bind(window);
    const windowRemove = window.removeEventListener.bind(window);

    function recordingAdd(record: Entry[], original: typeof protoAdd) {
      return function (
        this: EventTarget,
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions,
      ) {
        if (listener) record.push({ target: this, type, listener });
        return original.call(this, type, listener, options);
      };
    }
    function recordingRemove(record: Entry[], original: typeof protoRemove) {
      return function (
        this: EventTarget,
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | EventListenerOptions,
      ) {
        if (listener) record.push({ target: this, type, listener });
        return original.call(this, type, listener, options);
      };
    }

    vi.spyOn(EventTarget.prototype, 'addEventListener').mockImplementation(recordingAdd(added, protoAdd));
    vi.spyOn(EventTarget.prototype, 'removeEventListener').mockImplementation(recordingRemove(removed, protoRemove));
    vi.spyOn(window, 'addEventListener').mockImplementation(recordingAdd(added, windowAdd));
    vi.spyOn(window, 'removeEventListener').mockImplementation(recordingRemove(removed, windowRemove));

    panel = createPanel({ bookingUrl: URL_A });

    const overlayEl = document.querySelector('.ws-overlay')!;
    const closeBtnEl = document.querySelector('.ws-close')!;
    const iframeEl = document.querySelector('iframe')!;

    const expectedTargets: [EventTarget, string][] = [
      [window, 'popstate'],
      [window, 'resize'],
      [document, 'keydown'],
      [overlayEl, 'click'],
      [closeBtnEl, 'click'],
      [iframeEl, 'load'],
    ];

    panel.destroy();

    for (const [target, type] of expectedTargets) {
      const addedEntry = added.find((e) => e.target === target && e.type === type);
      expect(addedEntry, `expected an addEventListener('${type}') call on the target`).toBeDefined();

      const removedMatch = removed.some(
        (e) => e.target === target && e.type === type && e.listener === addedEntry!.listener,
      );
      expect(removedMatch, `expected removeEventListener('${type}') with the same listener reference`).toBe(true);
    }
  });
});

describe('onOpenChange', () => {
  it('fires true on open and false on close()', () => {
    const onOpenChange = vi.fn();
    panel = createPanel({ bookingUrl: URL_A, onOpenChange });

    panel.open();
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    onOpenChange.mockClear();
    panel.close();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('fires false when closed via the close button', () => {
    const onOpenChange = vi.fn();
    panel = createPanel({ bookingUrl: URL_A, onOpenChange });
    panel.open();
    onOpenChange.mockClear();

    (document.querySelector('.ws-close') as HTMLElement).click();

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('fires false when closed via the overlay', () => {
    const onOpenChange = vi.fn();
    panel = createPanel({ bookingUrl: URL_A, onOpenChange });
    panel.open();
    onOpenChange.mockClear();

    (document.querySelector('.ws-overlay') as HTMLElement).click();

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('fires false when closed via Escape', () => {
    const onOpenChange = vi.fn();
    panel = createPanel({ bookingUrl: URL_A, onOpenChange });
    panel.open();
    onOpenChange.mockClear();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('fires false when closed via browser back (popstate)', () => {
    const onOpenChange = vi.fn();
    panel = createPanel({ bookingUrl: URL_A, onOpenChange });
    panel.open();
    onOpenChange.mockClear();

    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('fires false when closed via the mobile-resize auto-close', () => {
    vi.useFakeTimers();
    const onOpenChange = vi.fn();
    panel = createPanel({ bookingUrl: URL_A, onOpenChange });
    panel.open();
    onOpenChange.mockClear();

    setWidth(500);
    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(200);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    vi.useRealTimers();
  });

  it('fires false when destroyed while open', () => {
    const onOpenChange = vi.fn();
    panel = createPanel({ bookingUrl: URL_A, onOpenChange });
    panel.open();
    onOpenChange.mockClear();

    panel.destroy();

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not fire on a no-op close (already closed)', () => {
    const onOpenChange = vi.fn();
    panel = createPanel({ bookingUrl: URL_A, onOpenChange });

    panel.close();

    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe('getNoticeSlot', () => {
  it('returns an element sitting between the header and the body', () => {
    panel = createPanel({ bookingUrl: URL_A });
    const notice = panel.getNoticeSlot();

    expect(notice.className).toBe('ws-notice');
    expect(notice.parentElement).toBe(document.querySelector('.ws-panel'));
    expect(notice.previousElementSibling?.className).toBe('ws-header');
    expect(notice.nextElementSibling?.className).toBe('ws-body');
  });

  it('is empty and carries no inline styling when untouched', () => {
    panel = createPanel({ bookingUrl: URL_A });
    const notice = panel.getNoticeSlot();

    expect(notice.childElementCount).toBe(0);
    expect(notice.textContent).toBe('');
    expect(notice.getAttribute('style')).toBeNull();
  });

  it('has no CSS rule of its own, so an untouched slot has no visible chrome', () => {
    // A bare <div> with no matching CSS rule already has zero size and no
    // border/padding/background by default; asserting the stylesheet has no
    // .ws-notice rule at all is what actually pins that down against a
    // future edit that gives the slot default visual chrome.
    panel = createPanel({ bookingUrl: URL_A });
    const css = document.head.querySelector('style[data-wakesys-booking]')!.textContent ?? '';
    expect(css).not.toContain('.ws-notice');
  });

  it('returns the same element on repeated calls', () => {
    panel = createPanel({ bookingUrl: URL_A });
    expect(panel.getNoticeSlot()).toBe(panel.getNoticeSlot());
  });

  it('is removed along with the rest of the panel on destroy', () => {
    panel = createPanel({ bookingUrl: URL_A });
    const notice = panel.getNoticeSlot();
    panel.destroy();
    expect(document.body.contains(notice)).toBe(false);
  });
});
