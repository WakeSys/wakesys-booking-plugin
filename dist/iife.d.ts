import type { BookingPanelInstance } from './core/types';
declare global {
    interface Window {
        __wakesysPluginLoaded?: boolean;
        BookingPanel?: {
            open: (url?: string) => void;
            close: () => void;
            isOpen: () => boolean;
            setBookingUrl: (url: string) => void;
        };
    }
}
export declare function bootFromDom(): BookingPanelInstance | null;
