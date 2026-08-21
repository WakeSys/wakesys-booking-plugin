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
  interface HTMLElement {
    __wakesysBound?: boolean;
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

  function resolveUrl(offer: string | null): string {
    if (!offer) return bookingUrl;
    const sep = bookingUrl.includes('?') ? '&' : '?';
    return `${bookingUrl}${sep}offer=${encodeURIComponent(offer)}`;
  }

  // getUrl runs at click time: elements stay bound for their lifetime, but SPA
  // re-renders mutate href / data-wakesys-book in place. Returning null hands
  // the click back to the browser.
  function bind(el: HTMLElement, getUrl: () => string | null): void {
    if (el.__wakesysBound) return;
    el.__wakesysBound = true;

    el.addEventListener('click', (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const url = getUrl();
      if (!url || !isAllowedUrl(url)) return;
      e.preventDefault();
      panel.open(url);
    });
  }

  function bindAll(): void {
    for (const el of document.querySelectorAll<HTMLElement>('[data-wakesys-book]')) {
      bind(el, () => resolveUrl(el.getAttribute('data-wakesys-book')));
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

  if (typeof MutationObserver !== 'undefined') {
    let timer: ReturnType<typeof setTimeout> | null = null;
    new MutationObserver(() => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        bindAll();
      }, 100);
    }).observe(document.body, { childList: true, subtree: true });
  }

  window.BookingPanel = {
    open: (url?: string) => panel.open(url),
    close: () => panel.close(),
    isOpen: () => panel.isOpen(),
    setBookingUrl: (url: string) => panel.setBookingUrl(url),
  };

  return panel;
}
