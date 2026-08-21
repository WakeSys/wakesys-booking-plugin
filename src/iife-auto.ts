// src/iife-auto.ts — the CDN entry point, not imported by tests
import { bootFromDom } from './iife';

if (typeof window !== 'undefined' && !window.__wakesysPluginLoaded) {
  window.__wakesysPluginLoaded = true;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bootFromDom(), { once: true });
  } else {
    bootFromDom();
  }
}
