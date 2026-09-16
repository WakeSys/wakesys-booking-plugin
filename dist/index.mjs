/**
 * wakesys Booking Plugin v1.1.0
 * Copyright (c) 2026 wakesys s.à.r.l.
 * Licensed under GPL-3.0
 * https://github.com/wakesys/wakesys-booking-plugin
 */

// src/core/allowlist.ts
var ALLOWED_ORIGINS = [
  "https://wakesys.app",
  "https://staging.wakesys.app"
];
var LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];
function isLocalHostname(hostname) {
  return LOCAL_HOSTNAMES.includes(hostname);
}
function isAllowedUrl(url, pageHostname = typeof window === "undefined" ? "" : window.location.hostname) {
  try {
    const parsed = new URL(url);
    if (ALLOWED_ORIGINS.includes(parsed.origin)) return true;
    return isLocalHostname(pageHostname) && (parsed.protocol === "http:" || parsed.protocol === "https:") && isLocalHostname(parsed.hostname);
  } catch (e) {
    return false;
  }
}

// src/core/viewport.ts
var DEFAULT_MOBILE_BREAKPOINT = 768;
function normalizeBreakpoint(value) {
  const n = typeof value === "number" ? value : parseInt(String(value != null ? value : ""), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MOBILE_BREAKPOINT;
}
function isMobile(breakpoint) {
  if (window.innerWidth < breakpoint) return true;
  const isCoarsePointer = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  if (!isCoarsePointer) return false;
  return Math.min(window.innerWidth, window.innerHeight) < breakpoint;
}
function mobileMediaQuery(breakpoint) {
  return `(max-width:${breakpoint - 1}px)`;
}

// src/core/styles.ts
function buildCss(breakpoint, position) {
  const translateOut = position === "left" ? "translateX(-100%)" : "translateX(100%)";
  return `
.ws-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);opacity:0;pointer-events:none;transition:opacity 200ms ease;z-index:9999}
.ws-overlay.ws-show{opacity:1;pointer-events:auto}
.ws-panel{position:fixed;top:0;${position}:0;height:100dvh;width:428px;max-width:100vw;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.06),0 20px 50px rgba(0,0,0,.35);transform:${translateOut};transition:transform 280ms ease;z-index:10000;display:flex;flex-direction:column}
.ws-panel.ws-show{transform:translateX(0)}
.ws-header{display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.75rem;border-bottom:1px solid rgba(0,0,0,.08);position:relative;z-index:2}
.ws-title{font-size:.95rem;font-weight:700;letter-spacing:.02em;color:#0f172a}
.ws-close{appearance:none;border:0;background:transparent;cursor:pointer;padding:.5rem;border-radius:.5rem;position:relative;z-index:10;line-height:0}
.ws-close:hover{background:rgba(0,0,0,.06)}
.ws-close:focus{outline:2px solid #60a5fa;outline-offset:2px}
.ws-close svg{width:22px;height:22px;display:block}
.ws-body{position:relative;flex:1;display:flex;flex-direction:column}
.ws-frame{width:100%;flex:1;border:0}
.ws-spinner{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#fff;transition:opacity 200ms ease}
.ws-spinner.ws-hidden{opacity:0;pointer-events:none}
@keyframes ws-spin{to{transform:rotate(360deg)}}
.ws-spinner svg{animation:ws-spin .8s linear infinite}
.ws-resume{position:fixed;bottom:1.25rem;${position}:1.25rem;display:none;align-items:center;gap:.25rem;padding:.25rem .25rem .25rem 1rem;background:#0f172a;color:#fff;border-radius:999px;box-shadow:0 10px 30px rgba(0,0,0,.3),0 0 0 1px rgba(255,255,255,.08);font:600 .9rem/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;z-index:9998}
.ws-resume.ws-show{display:flex}
.ws-resume button{appearance:none;border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;border-radius:999px;line-height:0}
.ws-resume-open{padding:.5rem .25rem .5rem 0;line-height:1.2}
.ws-resume-dismiss{padding:.5rem}
.ws-resume-dismiss:hover{background:rgba(255,255,255,.12)}
.ws-resume button:focus-visible{outline:2px solid #60a5fa;outline-offset:2px}
.ws-resume-dismiss svg{width:16px;height:16px;display:block}
@media${mobileMediaQuery(breakpoint)}{.ws-panel{display:none!important}.ws-overlay{display:none!important}.ws-resume{display:none!important}}
body.ws-lock{overflow:hidden;touch-action:none;overscroll-behavior:contain}
`.trim();
}
var refCount = 0;
var styleEl = null;
function ensureStyles(css) {
  refCount += 1;
  if (styleEl) return;
  styleEl = document.createElement("style");
  styleEl.setAttribute("data-wakesys-booking", "");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
}
function releaseStyles() {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && styleEl) {
    styleEl.remove();
    styleEl = null;
  }
}

// src/core/focus-trap.ts
var FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])';
function handleTabKey(e, container) {
  const focusables = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    last.focus();
    e.preventDefault();
  } else if (!e.shiftKey && document.activeElement === last) {
    first.focus();
    e.preventDefault();
  }
}

// src/core/panel.ts
var CLOSE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
var SPINNER_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>';
function createPanel(config) {
  var _a, _b;
  const breakpoint = normalizeBreakpoint(config.mobileBreakpoint);
  const position = config.position === "left" ? "left" : "right";
  const title = (_a = config.title) != null ? _a : "Booking";
  const resumeLabel = (_b = config.resumeLabel) != null ? _b : "Continue booking";
  let bookingUrl = config.bookingUrl;
  let lastFocused = null;
  let destroyed = false;
  let focusTimer = null;
  let loadedUrl = null;
  let startPath = null;
  let currentPath = null;
  let lengthAtOpen = 0;
  let grewWhileOpen = false;
  ensureStyles(buildCss(breakpoint, position));
  const overlay = document.createElement("div");
  overlay.className = "ws-overlay";
  overlay.setAttribute("aria-hidden", "true");
  const panel = document.createElement("aside");
  panel.className = "ws-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", title);
  panel.setAttribute("inert", "");
  const header = document.createElement("div");
  header.className = "ws-header";
  const titleEl = document.createElement("div");
  titleEl.className = "ws-title";
  titleEl.textContent = title;
  const closeBtn = document.createElement("button");
  closeBtn.className = "ws-close";
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", `Close ${title.toLowerCase()}`);
  closeBtn.innerHTML = CLOSE_ICON;
  header.append(titleEl, closeBtn);
  const notice = document.createElement("div");
  notice.className = "ws-notice";
  const body = document.createElement("div");
  body.className = "ws-body";
  const spinner = document.createElement("div");
  spinner.className = "ws-spinner";
  spinner.innerHTML = SPINNER_ICON;
  const iframe = document.createElement("iframe");
  iframe.className = "ws-frame";
  iframe.title = title;
  iframe.referrerPolicy = "no-referrer-when-downgrade";
  const bookingOrigin = safeOrigin(bookingUrl);
  if (bookingOrigin) {
    iframe.allow = `payment ${bookingOrigin}; geolocation ${bookingOrigin}`;
  }
  iframe.setAttribute(
    "sandbox",
    "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
  );
  const onIframeLoad = () => spinner.classList.add("ws-hidden");
  iframe.addEventListener("load", onIframeLoad);
  body.append(spinner, iframe);
  panel.append(header, notice, body);
  const resume = document.createElement("div");
  resume.className = `ws-resume ws-resume-${position}`;
  const resumeOpenBtn = document.createElement("button");
  resumeOpenBtn.className = "ws-resume-open";
  resumeOpenBtn.type = "button";
  resumeOpenBtn.textContent = resumeLabel;
  const resumeDismissBtn = document.createElement("button");
  resumeDismissBtn.className = "ws-resume-dismiss";
  resumeDismissBtn.type = "button";
  resumeDismissBtn.setAttribute("aria-label", "Dismiss and start over");
  resumeDismissBtn.title = "Dismiss and start over";
  resumeDismissBtn.innerHTML = CLOSE_ICON;
  resume.append(resumeOpenBtn, resumeDismissBtn);
  document.body.append(overlay, panel, resume);
  function safeOrigin(url) {
    try {
      return new URL(url).origin;
    } catch (e) {
      return null;
    }
  }
  function isShown() {
    return panel.classList.contains("ws-show");
  }
  function isOpen() {
    return !destroyed && isShown();
  }
  function hasNavigated() {
    if (startPath !== null && currentPath !== null) return currentPath !== startPath;
    return grewWhileOpen;
  }
  function updateResume() {
    const show = !destroyed && !isShown() && loadedUrl !== null && hasNavigated();
    resume.classList.toggle("ws-show", show);
  }
  function resetTracking() {
    startPath = null;
    currentPath = null;
    lengthAtOpen = history.length;
    grewWhileOpen = false;
  }
  function load(target) {
    loadedUrl = target;
    resetTracking();
    spinner.classList.remove("ws-hidden");
    iframe.src = target;
  }
  function unload() {
    loadedUrl = null;
    resetTracking();
    iframe.removeAttribute("src");
    updateResume();
  }
  function open(url) {
    var _a2, _b2;
    if (destroyed) return;
    const target = url != null ? url : bookingUrl;
    if (!isAllowedUrl(target)) {
      console.warn("[wakesys] Blocked non-wakesys URL:", target);
      return;
    }
    if (isMobile(breakpoint)) {
      if (((_a2 = config.onMobileOpen) == null ? void 0 : _a2.call(config, target)) === true) return;
      window.open(target, "_blank", "noopener");
      return;
    }
    const wasOpen = isShown();
    if (target !== loadedUrl) load(target);
    if (wasOpen) return;
    lengthAtOpen = history.length;
    lastFocused = document.activeElement;
    overlay.classList.add("ws-show");
    panel.classList.add("ws-show");
    panel.removeAttribute("inert");
    document.body.classList.add("ws-lock");
    updateResume();
    (_b2 = config.onOpenChange) == null ? void 0 : _b2.call(config, true);
    focusTimer = setTimeout(() => {
      focusTimer = null;
      closeBtn.focus({ preventScroll: true });
    }, 100);
  }
  function hide() {
    var _a2;
    if (!isShown()) return;
    if (history.length > lengthAtOpen) grewWhileOpen = true;
    overlay.classList.remove("ws-show");
    panel.classList.remove("ws-show");
    panel.setAttribute("inert", "");
    document.body.classList.remove("ws-lock");
    updateResume();
    (_a2 = config.onOpenChange) == null ? void 0 : _a2.call(config, false);
    if (lastFocused && document.contains(lastFocused)) {
      lastFocused.focus({ preventScroll: true });
    }
    lastFocused = null;
  }
  function close() {
    if (destroyed) return;
    hide();
  }
  const onOverlayClick = () => close();
  const onCloseClick = () => close();
  overlay.addEventListener("click", onOverlayClick);
  closeBtn.addEventListener("click", onCloseClick);
  const onResumeOpen = () => {
    if (loadedUrl) open(loadedUrl);
  };
  const onResumeDismiss = () => unload();
  resumeOpenBtn.addEventListener("click", onResumeOpen);
  resumeDismissBtn.addEventListener("click", onResumeDismiss);
  const onMessage = (e) => {
    if (destroyed || loadedUrl === null) return;
    if (e.source !== iframe.contentWindow) return;
    if (!isAllowedUrl(e.origin)) return;
    const data = e.data;
    if (!data || data.type !== "wakesys:route" || typeof data.path !== "string") return;
    if (startPath === null) startPath = data.path;
    currentPath = data.path;
    updateResume();
  };
  window.addEventListener("message", onMessage);
  const onKeyDown = (e) => {
    if (!isOpen()) return;
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key === "Tab") handleTabKey(e, panel);
  };
  document.addEventListener("keydown", onKeyDown);
  let resizeTimer = null;
  const onResize = () => {
    if (resizeTimer) return;
    resizeTimer = setTimeout(() => {
      resizeTimer = null;
      if (isOpen() && isMobile(breakpoint)) close();
    }, 150);
  };
  window.addEventListener("resize", onResize);
  return {
    open,
    close,
    isOpen,
    setBookingUrl(url) {
      if (!isAllowedUrl(url)) {
        console.warn("[wakesys] Ignored non-wakesys booking URL:", url);
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
      hide();
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = null;
      if (focusTimer) clearTimeout(focusTimer);
      focusTimer = null;
      overlay.removeEventListener("click", onOverlayClick);
      closeBtn.removeEventListener("click", onCloseClick);
      resumeOpenBtn.removeEventListener("click", onResumeOpen);
      resumeDismissBtn.removeEventListener("click", onResumeDismiss);
      iframe.removeEventListener("load", onIframeLoad);
      window.removeEventListener("message", onMessage);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      resume.classList.remove("ws-show");
      overlay.remove();
      panel.remove();
      resume.remove();
      releaseStyles();
    }
  };
}

// src/core/index.ts
function createBookingPanel(config) {
  if (!isAllowedUrl(config.bookingUrl)) {
    throw new Error(
      `[wakesys] bookingUrl must point to wakesys.app or staging.wakesys.app, got: ${config.bookingUrl}`
    );
  }
  return createPanel(config);
}
export {
  ALLOWED_ORIGINS,
  DEFAULT_MOBILE_BREAKPOINT,
  createBookingPanel,
  isAllowedUrl
};
//# sourceMappingURL=index.mjs.map
