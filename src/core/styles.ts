import { mobileMediaQuery } from './viewport';

export function buildCss(breakpoint: number, position: 'left' | 'right'): string {
  const translateOut = position === 'left' ? 'translateX(-100%)' : 'translateX(100%)';
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
@media${mobileMediaQuery(breakpoint)}{.ws-panel{display:none!important}.ws-overlay{display:none!important}}
body.ws-lock{overflow:hidden;touch-action:none;overscroll-behavior:contain}
`.trim();
}

let refCount = 0;
let styleEl: HTMLStyleElement | null = null;

/** Idempotent. Refcounted so StrictMode double-mounts don't duplicate or strip. */
export function ensureStyles(css: string): void {
  refCount += 1;
  if (styleEl) return;
  styleEl = document.createElement('style');
  styleEl.setAttribute('data-wakesys-booking', '');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
}

export function releaseStyles(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && styleEl) {
    styleEl.remove();
    styleEl = null;
  }
}
