import {
  useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode,
} from 'react';
import { createBookingPanel } from './core';
import type { BookingPanelInstance } from './core/types';

/**
 * Module-level store rather than context: the provider commonly renders as a
 * later sibling of the buttons that open it, not as their ancestor.
 * One panel instance per application, matching the vanilla plugin.
 */
let instance: BookingPanelInstance | null = null;
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const getSnapshot = () => version;
const getServerSnapshot = () => 0;

export interface MobileFallbackArgs {
  url: string;
  confirm: () => void;
  cancel: () => void;
}

export interface BookingPanelProviderProps {
  bookingUrl: string;
  mobileBreakpoint?: number;
  position?: 'left' | 'right';
  title?: string;
  /** Rendered instead of opening a new tab when below the breakpoint. */
  renderMobileFallback?: (args: MobileFallbackArgs) => ReactNode;
}

export function BookingPanelProvider({
  bookingUrl,
  mobileBreakpoint,
  position,
  title,
  renderMobileFallback,
}: BookingPanelProviderProps) {
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const fallbackRef = useRef(renderMobileFallback);
  fallbackRef.current = renderMobileFallback;

  useEffect(() => {
    const panel = createBookingPanel({
      bookingUrl,
      mobileBreakpoint,
      position,
      title,
      onMobileOpen: (url) => {
        if (!fallbackRef.current) return false;
        setPendingUrl(url);
        return true;
      },
    });
    instance = panel;
    emit();

    return () => {
      panel.destroy();
      if (instance === panel) instance = null;
      emit();
    };
    // Recreated only on structural config change; URL updates go through the
    // effect below so open panels are not torn down mid-booking.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileBreakpoint, position, title]);

  useEffect(() => {
    instance?.setBookingUrl(bookingUrl);
  }, [bookingUrl]);

  if (!pendingUrl || !renderMobileFallback) return null;

  return (
    <>
      {renderMobileFallback({
        url: pendingUrl,
        confirm: () => {
          window.open(pendingUrl, '_blank', 'noopener');
          setPendingUrl(null);
        },
        cancel: () => setPendingUrl(null),
      })}
    </>
  );
}

export function useBookingPanel() {
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const open = useCallback((url?: string) => { instance?.open(url); emit(); }, []);
  const close = useCallback(() => { instance?.close(); emit(); }, []);
  /** Appends ?offer= to whichever bookingUrl the mounted provider is using. */
  const openOffer = useCallback((offer: string) => {
    const base = instance?.getBookingUrl();
    if (!base) return;
    const sep = base.includes('?') ? '&' : '?';
    instance?.open(`${base}${sep}offer=${encodeURIComponent(offer)}`);
  }, []);
  const isOpen = instance?.isOpen() ?? false;

  return { open, close, openOffer, isOpen };
}

export type { BookingPanelInstance } from './core/types';
