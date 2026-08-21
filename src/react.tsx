import {
  useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { createBookingPanel } from './core';
import { appendOffer } from './core/offer';
import type { BookingPanelInstance } from './core/types';

/**
 * Module-level store rather than context: the provider commonly renders as a
 * later sibling of the buttons that open it, not as their ancestor.
 * One panel instance per application, matching the vanilla plugin.
 *
 * `isOpen` is published as the useSyncExternalStore snapshot itself (rather
 * than read from mutable module state during render), driven by the panel's
 * onOpenChange callback so it stays true for every real transition -
 * including ones that bypass the hook entirely, like the close button, the
 * overlay, Escape, browser back, and the mobile-resize auto-close. Reading
 * it as the snapshot (instead of computing it mid-render from `instance`)
 * is also what prevents two simultaneously-rendered consumers from tearing.
 */
let instance: BookingPanelInstance | null = null;
let moduleIsOpen = false;
const listeners = new Set<() => void>();

function setModuleIsOpen(next: boolean) {
  if (moduleIsOpen === next) return;
  moduleIsOpen = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const getIsOpen = () => moduleIsOpen;
const getServerSnapshot = () => false;

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
  /**
   * Portaled into the panel's notice slot, between the header and the
   * iframe (e.g. a demo-mode banner). Absent renders nothing — the package
   * has no opinion on what, if anything, goes there.
   */
  renderNotice?: () => ReactNode;
}

export function BookingPanelProvider({
  bookingUrl,
  mobileBreakpoint,
  position,
  title,
  renderMobileFallback,
  renderNotice,
}: BookingPanelProviderProps) {
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [noticeSlot, setNoticeSlot] = useState<HTMLElement | null>(null);
  const fallbackRef = useRef(renderMobileFallback);
  // Panel this specific provider instance created, so the bookingUrl-sync
  // effect below updates *this* panel even if a second provider is mounted
  // and has since become the module-level `instance` the hook reads from.
  const panelRef = useRef<BookingPanelInstance | null>(null);

  useEffect(() => {
    fallbackRef.current = renderMobileFallback;
  }, [renderMobileFallback]);

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
      onOpenChange: setModuleIsOpen,
    });
    instance = panel;
    panelRef.current = panel;
    setNoticeSlot(panel.getNoticeSlot());

    return () => {
      panel.destroy();
      if (instance === panel) instance = null;
      if (panelRef.current === panel) panelRef.current = null;
      setModuleIsOpen(false);
      setNoticeSlot(null);
    };
    // Recreated only on structural config change; URL updates go through the
    // effect below so open panels are not torn down mid-booking.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileBreakpoint, position, title]);

  useEffect(() => {
    panelRef.current?.setBookingUrl(bookingUrl);
  }, [bookingUrl]);

  return (
    <>
      {noticeSlot && renderNotice && createPortal(renderNotice(), noticeSlot)}
      {pendingUrl && renderMobileFallback && renderMobileFallback({
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
  const isOpen = useSyncExternalStore(subscribe, getIsOpen, getServerSnapshot);

  const open = useCallback((url?: string) => { instance?.open(url); }, []);
  const close = useCallback(() => { instance?.close(); }, []);
  /** Appends ?offer= to whichever bookingUrl the mounted provider is using. */
  const openOffer = useCallback((offer: string) => {
    const base = instance?.getBookingUrl();
    if (!base) return;
    instance?.open(appendOffer(base, offer));
  }, []);

  return { open, close, openOffer, isOpen };
}

export type { BookingPanelInstance } from './core/types';
