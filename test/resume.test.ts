import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createPanel } from '../src/core/panel';

const URL_A = 'https://wakesys.app/park-a/booking';
const URL_B = 'https://wakesys.app/park-b/booking';
const OFFER_URL = 'https://wakesys.app/park-a/booking/email?offerId=1&productId=2';

function setWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
}

let panel: ReturnType<typeof createPanel>;

const iframe = () => document.querySelector('iframe')!;
const pill = () => document.querySelector<HTMLElement>('.ws-resume')!;
const pillShown = () => pill().classList.contains('ws-show');

/** What the booking app posts on every client-side route change. */
function route(path: string, opts: { origin?: string; source?: Window | null } = {}) {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { type: 'wakesys:route', path },
      origin: opts.origin ?? 'https://wakesys.app',
      source: 'source' in opts ? opts.source : iframe().contentWindow,
    }),
  );
}

/**
 * A client-side step inside the (cross-origin) booking app. The plugin cannot
 * see it, but it lands in the tab's shared history, so history.length grows.
 * jsdom's pushState is real here: nothing in this file mocks history.
 */
function frameNavigates() {
  history.pushState(null, '', `#step-${history.length}`);
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  setWidth(1280);
});

afterEach(() => {
  panel?.destroy();
  vi.restoreAllMocks();
});

describe('keeping the booking alive across close', () => {
  it('leaves the iframe src in place on close', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();
    panel.close();
    expect(iframe().getAttribute('src')).toBe(URL_A);
  });

  it('does not reload when reopened with the URL already loaded', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();
    iframe().dispatchEvent(new Event('load'));
    panel.close();

    const srcSetter = vi.fn();
    const proto = Object.getPrototypeOf(iframe()) as HTMLIFrameElement;
    const original = Object.getOwnPropertyDescriptor(proto, 'src')!;
    Object.defineProperty(iframe(), 'src', {
      configurable: true,
      get: () => original.get!.call(iframe()),
      set: (v: string) => { srcSetter(v); original.set!.call(iframe(), v); },
    });

    panel.open();
    expect(srcSetter).not.toHaveBeenCalled();
    expect(panel.isOpen()).toBe(true);
    // No load is coming, so the spinner must not be brought back.
    expect(document.querySelector('.ws-spinner')!.classList.contains('ws-hidden')).toBe(true);
  });

  it('reloads when reopened with a different URL', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();
    panel.close();
    panel.open(OFFER_URL);
    expect(iframe().getAttribute('src')).toBe(OFFER_URL);
    expect(document.querySelector('.ws-spinner')!.classList.contains('ws-hidden')).toBe(false);
  });
});

describe('resume pill', () => {
  it('renders hidden, with the default label, on the panel side', () => {
    panel = createPanel({ bookingUrl: URL_A, position: 'left' });
    expect(pill()).not.toBeNull();
    expect(pillShown()).toBe(false);
    expect(pill().textContent).toContain('Continue booking');
    expect(pill().classList.contains('ws-resume-left')).toBe(true);
  });

  it('uses a custom label', () => {
    panel = createPanel({ bookingUrl: URL_A, resumeLabel: 'Buchung fortsetzen' });
    expect(pill().textContent).toContain('Buchung fortsetzen');
  });

  it('stays hidden after close when nothing happened inside the frame', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();
    panel.close();
    expect(pillShown()).toBe(false);
  });

  describe('without route messages: shared history growth', () => {
    it('shows after close when the shared history grew while the panel was open', () => {
      panel = createPanel({ bookingUrl: URL_A });
      panel.open();
      frameNavigates();
      panel.close();
      expect(pillShown()).toBe(true);
    });

    it('ignores history growth that happened while the panel was closed (host navigation)', () => {
      panel = createPanel({ bookingUrl: URL_A });
      panel.open();
      panel.close();
      frameNavigates(); // really the host app routing, with the panel shut
      panel.open();
      panel.close();
      expect(pillShown()).toBe(false);
    });

    it('keeps showing across later open/close cycles once the frame moved on', () => {
      panel = createPanel({ bookingUrl: URL_A });
      panel.open();
      frameNavigates();
      panel.close();
      panel.open();
      panel.close();
      expect(pillShown()).toBe(true);
    });

    it('forgets the growth when a new URL is loaded', () => {
      panel = createPanel({ bookingUrl: URL_A });
      panel.open();
      frameNavigates();
      panel.open(URL_B);
      panel.close();
      expect(pillShown()).toBe(false);
    });

    it('defers to route messages when the app sends them', () => {
      panel = createPanel({ bookingUrl: URL_A });
      panel.open();
      route('/park-a/booking');
      frameNavigates(); // e.g. a replace-then-push that lands back on the start page
      route('/park-a/booking');
      panel.close();
      expect(pillShown()).toBe(false);
    });
  });

  it('stays hidden after close when the app is still on the page it started on', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();
    route('/park-a/booking');
    panel.close();
    expect(pillShown()).toBe(false);
  });

  it('shows after close once the app has moved to a different page', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();
    route('/park-a/booking');
    route('/park-a/booking/email');
    panel.close();
    expect(pillShown()).toBe(true);
  });

  it('stays hidden if the app moved away and came back to the start page', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();
    route('/park-a/booking');
    route('/park-a/booking/email');
    route('/park-a/booking');
    panel.close();
    expect(pillShown()).toBe(false);
  });

  it('is hidden while the panel is open', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();
    route('/a');
    route('/b');
    panel.close();
    expect(pillShown()).toBe(true);
    panel.open();
    expect(pillShown()).toBe(false);
  });

  it('resumes the loaded document when clicked, even if it was an offer deep link', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.open(OFFER_URL);
    route('/a');
    route('/b');
    panel.close();

    pill().querySelector<HTMLButtonElement>('.ws-resume-open')!.click();

    expect(panel.isOpen()).toBe(true);
    expect(iframe().getAttribute('src')).toBe(OFFER_URL);
    expect(pillShown()).toBe(false);
  });

  it('discards the booking when dismissed: the frame is blanked and the pill hides', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();
    route('/a');
    route('/b');
    panel.close();

    pill().querySelector<HTMLButtonElement>('.ws-resume-dismiss')!.click();
    expect(pillShown()).toBe(false);
    expect(iframe().hasAttribute('src')).toBe(false);
  });

  it('cold-loads the original URL on the next open after a dismiss instead of resuming', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();
    iframe().dispatchEvent(new Event('load'));
    route('/a');
    route('/b');
    panel.close();
    pill().querySelector<HTMLButtonElement>('.ws-resume-dismiss')!.click();

    panel.open();
    expect(iframe().getAttribute('src')).toBe(URL_A);
    expect(document.querySelector('.ws-spinner')!.classList.contains('ws-hidden')).toBe(false);
    panel.close();
    expect(pillShown()).toBe(false); // fresh document, nothing to resume yet
  });

  it('shows again once the fresh booking has moved on after a dismiss', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();
    route('/a');
    route('/b');
    panel.close();
    pill().querySelector<HTMLButtonElement>('.ws-resume-dismiss')!.click();

    panel.open();
    route('/a');
    route('/b');
    panel.close();
    expect(pillShown()).toBe(true);
  });

  it('labels the dismiss button as starting over', () => {
    panel = createPanel({ bookingUrl: URL_A });
    const dismiss = pill().querySelector<HTMLButtonElement>('.ws-resume-dismiss')!;
    expect(dismiss.getAttribute('aria-label')).toBe('Dismiss and start over');
    expect(dismiss.title).toBe('Dismiss and start over');
  });

  it('forgets the route history when a new URL is loaded', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();
    route('/a');
    route('/b');
    panel.open(URL_B);
    panel.close();
    expect(pillShown()).toBe(false);
  });

  it('ignores route messages from a foreign origin', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();
    route('/a', { origin: 'https://evil.com' });
    route('/b', { origin: 'https://evil.com' });
    panel.close();
    expect(pillShown()).toBe(false);
  });

  it('ignores route messages that did not come from the panel iframe', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();
    route('/a', { source: window });
    route('/b', { source: window });
    panel.close();
    expect(pillShown()).toBe(false);
  });

  it('ignores messages of another type or without a string path', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();
    route('/a');
    window.dispatchEvent(new MessageEvent('message', {
      data: { type: 'wakesys:other', path: '/b' },
      origin: 'https://wakesys.app',
      source: iframe().contentWindow,
    }));
    window.dispatchEvent(new MessageEvent('message', {
      data: { type: 'wakesys:route', path: 42 },
      origin: 'https://wakesys.app',
      source: iframe().contentWindow,
    }));
    panel.close();
    expect(pillShown()).toBe(false);
  });

  it('is removed on destroy along with its message listener', () => {
    panel = createPanel({ bookingUrl: URL_A });
    panel.open();
    route('/a');
    route('/b');
    panel.close();
    const el = pill();
    panel.destroy();
    expect(document.querySelector('.ws-resume')).toBeNull();
    // A stale message after teardown must not resurrect the pill.
    window.dispatchEvent(new MessageEvent('message', {
      data: { type: 'wakesys:route', path: '/c' },
      origin: 'https://wakesys.app',
      source: window,
    }));
    expect(el.classList.contains('ws-show')).toBe(false);
  });
});
