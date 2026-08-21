import { type ReactNode } from 'react';
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
export declare function BookingPanelProvider({ bookingUrl, mobileBreakpoint, position, title, renderMobileFallback, }: BookingPanelProviderProps): import("react").JSX.Element | null;
export declare function useBookingPanel(): {
    open: (url?: string) => void;
    close: () => void;
    openOffer: (offer: string) => void;
    isOpen: boolean;
};
export type { BookingPanelInstance } from './core/types';
