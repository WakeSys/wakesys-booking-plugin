import { createBookingPanel } from './core';
import { isAllowedUrl } from './core/allowlist';
import { normalizeBreakpoint } from './core/viewport';
import type { BookingPanelInstance } from './core/types';

declare global {
  interface Window {
    __wakesysPluginLoaded?: boolean;
    BookingPanel?: {
      open: (url?: string) => void;
      close: () => void;
      isOpen: () => boolean;
      setBookingUrl: (url: string) => void;
    };
  }
}

const BOOKING_LINK_RE = /^https:\/\/(staging\.)?wakesys\.app\/[^/]+\/booking(?:[/?#]|$)/;

/** Always defined, so documented API calls never throw on a failed boot. */
function installNoopGlobal(reason: string): void {
  const warn = () => console.warn(`[wakesys] BookingPanel is inactive: ${reason}`);
  window.BookingPanel = {
    open: warn,
    close: warn,
    isOpen: () => false,
    setBookingUrl: warn,
  };
}

export function bootFromDom(): BookingPanelInstance | null {
  try {
    return boot();
  } catch (err) {
    // A hostile or misconfigured host page (monkeypatched document.createElement,
    // missing document.body, etc.) must not leave window.BookingPanel undefined —
    // that's the one invariant documented API callers rely on.
    installNoopGlobal(`boot failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

function boot(): BookingPanelInstance | null {
  const container = document.getElementById('wakesys-app');
  if (!container) {
    installNoopGlobal('#wakesys-app element not found');
    return null;
  }

  const bookingUrl = container.getAttribute('data-wakesys-url') ?? '';
  if (!bookingUrl) {
    installNoopGlobal('data-wakesys-url is required on #wakesys-app');
    return null;
  }
  if (!isAllowedUrl(bookingUrl)) {
    installNoopGlobal('data-wakesys-url must point to wakesys.app or staging.wakesys.app');
    return null;
  }

  const rawPosition = container.getAttribute('data-wakesys-position');
  const panel = createBookingPanel({
    bookingUrl,
    mobileBreakpoint: normalizeBreakpoint(container.getAttribute('data-wakesys-mobile')),
    position: rawPosition === 'left' ? 'left' : 'right',
  });

  // Offer query goes before any fragment: wakesys.app/<park>/booking#step2 with
  // offer=aqua must become ...booking?offer=aqua#step2, not ...#step2?offer=aqua
  // (a query string inside the fragment never reaches the server).
  function resolveUrl(offer: string | null): string {
    if (!offer) return bookingUrl;
    const hashIndex = bookingUrl.indexOf('#');
    const base = hashIndex === -1 ? bookingUrl : bookingUrl.slice(0, hashIndex);
    const hash = hashIndex === -1 ? '' : bookingUrl.slice(hashIndex);
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}offer=${encodeURIComponent(offer)}${hash}`;
  }

  // Owned by this boot rather than stamped on the element: a permanent flag
  // would survive destroy() and silently orphan every trigger on the next boot
  // against the same DOM (SPA remount after teardown).
  const bound = new WeakSet<HTMLElement>();
  const listeners: Array<{ el: HTMLElement; handler: (e: MouseEvent) => void }> = [];

  // getUrl runs at click time: elements stay bound for their lifetime, but SPA
  // re-renders mutate href / data-wakesys-book in place. Returning null hands
  // the click back to the browser.
  function bind(el: HTMLElement, getUrl: () => string | null): void {
    if (bound.has(el)) return;
    bound.add(el);

    const handler = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const url = getUrl();
      if (!url || !isAllowedUrl(url)) return;
      e.preventDefault();
      panel.open(url);
    };
    el.addEventListener('click', handler);
    listeners.push({ el, handler });
  }

  function bindAll(): void {
    for (const el of document.querySelectorAll<HTMLElement>('[data-wakesys-book]')) {
      bind(el, () => {
        // null = attribute was removed since binding (SPA re-render dropped
        // the trigger role) -> hand the click back rather than opening the
        // default URL. '' = attribute present but empty -> open the default.
        const offer = el.getAttribute('data-wakesys-book');
        return offer === null ? null : resolveUrl(offer);
      });
    }
    for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      const href = link.getAttribute('href') ?? '';
      if (!BOOKING_LINK_RE.test(href) || link.hasAttribute('data-wakesys-book')) continue;
      bind(link, () => {
        const current = link.getAttribute('href') ?? '';
        return BOOKING_LINK_RE.test(current) ? current : null;
      });
    }
  }

  bindAll();

  let observer: MutationObserver | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(() => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        bindAll();
      }, 100);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  let destroyed = false;

  const wrapped: BookingPanelInstance = {
    open: (url?: string) => panel.open(url),
    close: () => panel.close(),
    isOpen: () => panel.isOpen(),
    setBookingUrl: (url: string) => panel.setBookingUrl(url),
    getBookingUrl: () => panel.getBookingUrl(),
    destroy: () => {
      if (destroyed) return;
      destroyed = true;

      observer?.disconnect();
      observer = null;
      if (timer) clearTimeout(timer);
      timer = null;

      for (const { el, handler } of listeners) el.removeEventListener('click', handler);
      listeners.length = 0;

      panel.destroy();
    },
  };

  window.BookingPanel = {
    open: (url?: string) => wrapped.open(url),
    close: () => wrapped.close(),
    isOpen: () => wrapped.isOpen(),
    setBookingUrl: (url: string) => wrapped.setBookingUrl(url),
  };

  return wrapped;
}
