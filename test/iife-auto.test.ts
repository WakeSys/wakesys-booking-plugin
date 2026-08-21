import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const URL_A = 'https://wakesys.app/park-a/booking';

function mountContainer() {
  const div = document.createElement('div');
  div.id = 'wakesys-app';
  div.setAttribute('data-wakesys-url', URL_A);
  document.body.appendChild(div);
  return div;
}

function setReadyState(state: DocumentReadyState) {
  Object.defineProperty(document, 'readyState', { value: state, configurable: true });
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  delete (window as { __wakesysPluginLoaded?: boolean }).__wakesysPluginLoaded;
  delete (window as { BookingPanel?: unknown }).BookingPanel;
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
  vi.spyOn(history, 'pushState').mockImplementation(() => {});
  vi.spyOn(history, 'back').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('iife-auto', () => {
  it('boots immediately when the document is already ready', async () => {
    mountContainer();
    setReadyState('complete');

    await import('../src/iife-auto');

    expect(window.__wakesysPluginLoaded).toBe(true);
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
  });

  it('waits for DOMContentLoaded when the document is still loading', async () => {
    mountContainer();
    setReadyState('loading');

    await import('../src/iife-auto');
    expect(document.querySelectorAll('iframe')).toHaveLength(0);

    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
  });

  it('boots only once even if the bundle is included twice', async () => {
    mountContainer();
    setReadyState('complete');

    await import('../src/iife-auto');
    expect(document.querySelectorAll('iframe')).toHaveLength(1);

    // Simulates a second <script> tag: a fresh module instance re-executes
    // the guard check, but __wakesysPluginLoaded lives on the real window and
    // survives the module registry reset.
    vi.resetModules();
    await import('../src/iife-auto');
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
  });
});
