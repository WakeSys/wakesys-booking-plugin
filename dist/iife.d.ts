import type { BookingPanelInstance } from './core/types';
declare global {
    interface Window {
        __wakesysPluginLoaded?: boolean;
        /** Adds the visitor's ad attribution to a wakesys booking URL, for
         *  buttons that open the booking from the park's own code. */
        wakesysDecorateBookingUrl?: (url: string) => string;
        BookingPanel?: {
            open: (url?: string) => void;
            close: () => void;
            isOpen: () => boolean;
            setBookingUrl: (url: string) => void;
        };
    }
}
export declare function bootFromDom(): BookingPanelInstance | null;
