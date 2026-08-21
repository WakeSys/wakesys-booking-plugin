import type { BookingPanelConfig, BookingPanelInstance } from './types';
import { isAllowedUrl } from './allowlist';
import { isMobile, normalizeBreakpoint } from './viewport';
import { buildCss, ensureStyles, releaseStyles } from './styles';
import { pushPanelState, popPanelState, notePopped } from './history';
import { handleTabKey } from './focus-trap';

const CLOSE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

const SPINNER_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>';

export function createPanel(config: BookingPanelConfig): BookingPanelInstance {
  const breakpoint = normalizeBreakpoint(config.mobileBreakpoint);
  const position = config.position === 'left' ? 'left' : 'right';
  const title = config.title ?? 'Booking';

  let bookingUrl = config.bookingUrl;
  let lastFocused: HTMLElement | null = null;
  let destroyed = false;
  let focusTimer: ReturnType<typeof setTimeout> | null = null;

  ensureStyles(buildCss(breakpoint, position));

  const overlay = document.createElement('div');
  overlay.className = 'ws-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const panel = document.createElement('aside');
  panel.className = 'ws-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', title);
  panel.setAttribute('inert', '');

  const header = document.createElement('div');
  header.className = 'ws-header';

  const titleEl = document.createElement('div');
  titleEl.className = 'ws-title';
  titleEl.textContent = title;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'ws-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', `Close ${title.toLowerCase()}`);
  closeBtn.innerHTML = CLOSE_ICON;

  header.append(titleEl, closeBtn);

  // Empty on purpose: no CSS rule targets .ws-notice, so an untouched slot
  // has zero size and no visual presence. A caller (e.g. the React adapter's
  // renderNotice) fills it; the package has no opinion on its contents.
  const notice = document.createElement('div');
  notice.className = 'ws-notice';

  const body = document.createElement('div');
  body.className = 'ws-body';

  const spinner = document.createElement('div');
  spinner.className = 'ws-spinner';
  spinner.innerHTML = SPINNER_ICON;

  const iframe = document.createElement('iframe');
  iframe.className = 'ws-frame';
  iframe.title = title;
  iframe.referrerPolicy = 'no-referrer-when-downgrade';

  const bookingOrigin = safeOrigin(bookingUrl);
  if (bookingOrigin) {
    iframe.allow = `payment ${bookingOrigin}; geolocation ${bookingOrigin}`;
  }
  iframe.setAttribute(
    'sandbox',
    'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox',
  );

  const onIframeLoad = () => spinner.classList.add('ws-hidden');
  iframe.addEventListener('load', onIframeLoad);

  body.append(spinner, iframe);
  panel.append(header, notice, body);

  // Mounted on body: position:fixed resolves against a transformed, filtered,
  // or contained ancestor rather than the viewport, and host themes routinely
  // wrap injected markup in exactly that.
  document.body.append(overlay, panel);

  function safeOrigin(url: string): string | null {
    try {
      return new URL(url).origin;
    } catch {
      return null;
    }
  }

  /** Panel DOM state, independent of the destroyed flag. Used internally so
   *  destroy() can route through hide() even after it has flipped destroyed. */
  function isShown(): boolean {
    return panel.classList.contains('ws-show');
  }

  function isOpen(): boolean {
    return !destroyed && isShown();
  }

  function open(url?: string): void {
    if (destroyed) return;
    const target = url ?? bookingUrl;

    if (!isAllowedUrl(target)) {
      console.warn('[wakesys] Blocked non-wakesys URL:', target);
      return;
    }

    if (isMobile(breakpoint)) {
      if (config.onMobileOpen?.(target) === true) return;
      window.open(target, '_blank', 'noopener');
      return;
    }

    const wasOpen = isShown();

    spinner.classList.remove('ws-hidden');
    iframe.src = target;

    if (wasOpen) return; // already shown: swap the URL, don't re-push history

    lastFocused = document.activeElement as HTMLElement | null;
    overlay.classList.add('ws-show');
    panel.classList.add('ws-show');
    panel.removeAttribute('inert');
    document.body.classList.add('ws-lock');
    pushPanelState();
    config.onOpenChange?.(true);

    focusTimer = setTimeout(() => {
      focusTimer = null;
      closeBtn.focus({ preventScroll: true });
    }, 100);
  }

  /** Visual close only. Callers decide whether history is popped. Callable
   *  even after destroyed has been set, so destroy() can route through it. */
  function hide(): void {
    if (!isShown()) return;

    overlay.classList.remove('ws-show');
    panel.classList.remove('ws-show');
    panel.setAttribute('inert', '');
    document.body.classList.remove('ws-lock');
    iframe.removeAttribute('src');
    config.onOpenChange?.(false);

    if (lastFocused && document.contains(lastFocused)) {
      lastFocused.focus({ preventScroll: true });
    }
    lastFocused = null;
  }

  function close(): void {
    if (destroyed) return;
    if (!isShown()) return;
    hide();
    popPanelState();
  }

  const onOverlayClick = () => close();
  const onCloseClick = () => close();
  overlay.addEventListener('click', onOverlayClick);
  closeBtn.addEventListener('click', onCloseClick);

  const onPopState = (e: PopStateEvent) => {
    if (!isOpen()) return;
    if ((e.state as { wakesysPanel?: boolean } | null)?.wakesysPanel) return;
    notePopped();
    hide(); // browser already navigated; don't call back() again
  };
  window.addEventListener('popstate', onPopState);

  const onKeyDown = (e: KeyboardEvent) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key === 'Tab') handleTabKey(e, panel);
  };
  document.addEventListener('keydown', onKeyDown);

  // Below the breakpoint the media query hides panel and overlay outright.
  // Without this the body keeps ws-lock, leaving the page unscrollable with
  // nothing visible to click.
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  const onResize = () => {
    if (resizeTimer) return;
    resizeTimer = setTimeout(() => {
      resizeTimer = null;
      if (isOpen() && isMobile(breakpoint)) close();
    }, 150);
  };
  window.addEventListener('resize', onResize);

  return {
    open,
    close,
    isOpen,
    setBookingUrl(url: string) {
      if (!isAllowedUrl(url)) {
        console.warn('[wakesys] Ignored non-wakesys booking URL:', url);
        return;
      }
      bookingUrl = url;
    },
    getBookingUrl() {
      return bookingUrl;
    },
    getNoticeSlot() {
      return notice;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;

      // Route through the real close path first: restores focus, clears
      // ws-lock, and pops any history entry this instance still owns. A
      // stale destroyed instance must never later touch body classList or
      // history state again (see close(), which is now gated on destroyed).
      //
      // popPanelState() calls history.back(), which — if destroy() ever ran
      // during a programmatic client-side navigation rather than a user
      // dismissal — would bounce the visitor back a page. This is treated as
      // near-unreachable and left as is: the overlay intercepts link clicks
      // and the focus trap holds Tab inside the panel while it's open, so
      // nothing under application control can navigate the host page out
      // from under an open panel. The alternative (skipping history.back()
      // here) resurrects the phantom-history-entry defect this depth-counter
      // design was built to fix — an entry pushed by open() that nothing
      // ever pops, so the user's next real back button press does nothing.
      if (isShown()) {
        hide();
        popPanelState();
      }

      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = null;
      if (focusTimer) clearTimeout(focusTimer);
      focusTimer = null;

      overlay.removeEventListener('click', onOverlayClick);
      closeBtn.removeEventListener('click', onCloseClick);
      iframe.removeEventListener('load', onIframeLoad);
      window.removeEventListener('popstate', onPopState);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);

      overlay.remove();
      panel.remove();
      releaseStyles();
    },
  };
}
