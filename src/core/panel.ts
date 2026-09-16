import type { BookingPanelConfig, BookingPanelInstance } from './types';
import { isAllowedUrl } from './allowlist';
import { isMobile, normalizeBreakpoint } from './viewport';
import { buildCss, ensureStyles, releaseStyles } from './styles';
import { handleTabKey } from './focus-trap';

const CLOSE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

const SPINNER_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>';

export function createPanel(config: BookingPanelConfig): BookingPanelInstance {
  const breakpoint = normalizeBreakpoint(config.mobileBreakpoint);
  const position = config.position === 'left' ? 'left' : 'right';
  const title = config.title ?? 'Booking';
  const resumeLabel = config.resumeLabel ?? 'Continue booking';

  let bookingUrl = config.bookingUrl;
  let lastFocused: HTMLElement | null = null;
  let destroyed = false;
  let focusTimer: ReturnType<typeof setTimeout> | null = null;

  // The document currently loaded in the iframe. Closing the panel no longer
  // blanks the iframe, so a later open() with the same URL resumes the
  // booking where the visitor left it instead of restarting on step one.
  let loadedUrl: string | null = null;
  // The resume pill shows only when the booking app sits on a different page
  // from the one it started on. Two signals, both reset on every real load:
  //  - exact: `wakesys:route` postMessages from the booking app, if it sends
  //    them (startPath / currentPath);
  //  - fallback: history.length. The tab's session history is shared between
  //    host and frame, so a client-side step inside the cross-origin frame
  //    grows it. Growth is only counted while the panel is open, because the
  //    host page may route while the panel is shut and the frame is inert.
  let startPath: string | null = null;
  let currentPath: string | null = null;
  let lengthAtOpen = 0;
  let grewWhileOpen = false;

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

  const resume = document.createElement('div');
  resume.className = `ws-resume ws-resume-${position}`;

  const resumeOpenBtn = document.createElement('button');
  resumeOpenBtn.className = 'ws-resume-open';
  resumeOpenBtn.type = 'button';
  resumeOpenBtn.textContent = resumeLabel;

  const resumeDismissBtn = document.createElement('button');
  resumeDismissBtn.className = 'ws-resume-dismiss';
  resumeDismissBtn.type = 'button';
  resumeDismissBtn.setAttribute('aria-label', 'Dismiss and start over');
  resumeDismissBtn.title = 'Dismiss and start over';
  resumeDismissBtn.innerHTML = CLOSE_ICON;

  resume.append(resumeOpenBtn, resumeDismissBtn);

  // Mounted on body: position:fixed resolves against a transformed, filtered,
  // or contained ancestor rather than the viewport, and host themes routinely
  // wrap injected markup in exactly that.
  document.body.append(overlay, panel, resume);

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

  function hasNavigated(): boolean {
    if (startPath !== null && currentPath !== null) return currentPath !== startPath;
    return grewWhileOpen;
  }

  function updateResume(): void {
    const show = !destroyed && !isShown() && loadedUrl !== null && hasNavigated();
    resume.classList.toggle('ws-show', show);
  }

  function resetTracking(): void {
    startPath = null;
    currentPath = null;
    lengthAtOpen = history.length;
    grewWhileOpen = false;
  }

  function load(target: string): void {
    loadedUrl = target;
    resetTracking();
    spinner.classList.remove('ws-hidden');
    iframe.src = target;
  }

  /** Discards the booking document: the next open() cold-loads. Cannot touch
   *  anything the booking app persisted on its own origin (cookies, storage). */
  function unload(): void {
    loadedUrl = null;
    resetTracking();
    iframe.removeAttribute('src');
    updateResume();
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

    // Same URL as the document already in the iframe: resume it as-is. Any
    // other URL (an offer deep link, a park switch) is a fresh navigation.
    if (target !== loadedUrl) load(target);

    if (wasOpen) return; // already shown: the URL swap above is all there is to do

    lengthAtOpen = history.length;
    lastFocused = document.activeElement as HTMLElement | null;
    overlay.classList.add('ws-show');
    panel.classList.add('ws-show');
    panel.removeAttribute('inert');
    document.body.classList.add('ws-lock');
    updateResume();
    config.onOpenChange?.(true);

    focusTimer = setTimeout(() => {
      focusTimer = null;
      closeBtn.focus({ preventScroll: true });
    }, 100);
  }

  /** Visual close. Callable even after destroyed has been set, so destroy()
   *  can route through it. Never touches browser history: the booking app
   *  pushes its own steps into the same shared list, so a history.back()
   *  from here would rewind the booking rather than undo anything of ours. */
  function hide(): void {
    if (!isShown()) return;

    if (history.length > lengthAtOpen) grewWhileOpen = true;

    overlay.classList.remove('ws-show');
    panel.classList.remove('ws-show');
    panel.setAttribute('inert', '');
    document.body.classList.remove('ws-lock');
    // The iframe keeps its document: a same-URL open() resumes the booking.
    updateResume();
    config.onOpenChange?.(false);

    if (lastFocused && document.contains(lastFocused)) {
      lastFocused.focus({ preventScroll: true });
    }
    lastFocused = null;
  }

  function close(): void {
    if (destroyed) return;
    hide();
  }

  const onOverlayClick = () => close();
  const onCloseClick = () => close();
  overlay.addEventListener('click', onOverlayClick);
  closeBtn.addEventListener('click', onCloseClick);

  const onResumeOpen = () => {
    if (loadedUrl) open(loadedUrl);
  };
  const onResumeDismiss = () => unload();
  resumeOpenBtn.addEventListener('click', onResumeOpen);
  resumeDismissBtn.addEventListener('click', onResumeDismiss);

  // The booking app is cross-origin, so its client-side route changes are
  // invisible from here; it posts `{ type: 'wakesys:route', path }` on each
  // one. Only the panel's own iframe on an allowlisted origin is trusted.
  const onMessage = (e: MessageEvent) => {
    if (destroyed || loadedUrl === null) return;
    if (e.source !== iframe.contentWindow) return;
    if (!isAllowedUrl(e.origin)) return;
    const data = e.data as { type?: unknown; path?: unknown } | null;
    if (!data || data.type !== 'wakesys:route' || typeof data.path !== 'string') return;

    if (startPath === null) startPath = data.path;
    currentPath = data.path;
    updateResume();
  };
  window.addEventListener('message', onMessage);

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

      // Route through the real close path first: restores focus and clears
      // ws-lock. A stale destroyed instance must never later touch body
      // classList again (see close(), which is gated on destroyed).
      hide();

      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = null;
      if (focusTimer) clearTimeout(focusTimer);
      focusTimer = null;

      overlay.removeEventListener('click', onOverlayClick);
      closeBtn.removeEventListener('click', onCloseClick);
      resumeOpenBtn.removeEventListener('click', onResumeOpen);
      resumeDismissBtn.removeEventListener('click', onResumeDismiss);
      iframe.removeEventListener('load', onIframeLoad);
      window.removeEventListener('message', onMessage);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);

      resume.classList.remove('ws-show');
      overlay.remove();
      panel.remove();
      resume.remove();
      releaseStyles();
    },
  };
}
