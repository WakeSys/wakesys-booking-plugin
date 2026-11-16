/**
 * Ad-attribution forwarding across the park-site -> wakesys.app hop.
 *
 * The ad click lands on the park's own marketing page: its URL carries
 * fbclid / gclid / utm_*, and the park's Meta Pixel and GA4 set _fbc, _fbp
 * and _ga on the park's domain. wakesys.app is a different site and can read
 * none of it, so without forwarding every plugin booking is unattributed in
 * the wakesys GTM container (Meta and Google Ads purchases cannot be tied
 * back to the ad).
 *
 * The receiving side is the wakesys GTM container's app_observer, which
 * rebuilds _fbc from ?fbclid, and writes _fbp / _ga from ?_fbp / ?_ga only
 * when they match the format regexes below. GA4 reads utm_* from
 * page_location; Google Ads' conversion linker reads gclid / gbraid / wbraid
 * from the URL.
 *
 * Mirrors the Charleston marketing site's cross-domain-attribution.ts (the
 * reference implementation of the contract): same parameter lists, 30-day
 * localStorage persistence of landing params, UTMs replaced as a group,
 * precedence "already on the target > current page URL > storage", fbclid
 * recovered from the _fbc cookie, _fbp and _ga forwarded from cookies.
 *
 * Every storage and cookie access is guarded: Safari private mode, blocked
 * site data, or a sandboxed host document can make the accessor itself throw.
 * A failure anywhere means "forward less", never "break the booking open".
 */
export declare const CLICK_ID_PARAMS: readonly string[];
export declare const UTM_PARAMS: readonly string[];
export declare const STORAGE_KEY = "wakesys_attribution";
/** 30 days: Meta's maximum click-attribution window. */
export declare const STORAGE_TTL_MS: number;
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
/**
 * Injectable inputs, so tests can pin them. Callers omit them and get the
 * live page: location.search, document.cookie, localStorage, Date.now().
 */
export interface AttributionSources {
    /** Query string of the host page, with or without the leading '?'. */
    search?: string;
    /** A document.cookie-shaped string. */
    cookie?: string;
    /** null = storage unavailable. */
    storage?: StorageLike | null;
    now?: number;
}
/**
 * Captures click IDs and UTMs from the host page's URL into localStorage, so
 * a visitor who lands on an ad URL, browses (client-side routing often drops
 * the query string) and books later still carries the attribution.
 *
 * UTMs are replaced as a group: any UTM on the URL discards all stored UTMs,
 * so a later Google ad's utm_source never sits beside a Meta utm_campaign.
 * Click IDs accumulate individually. Called by the panel on creation.
 */
export declare function persistAttributionFromUrl(src?: AttributionSources): void;
/**
 * Returns `url` with the visitor's ad attribution appended: click IDs and
 * UTMs from the current page URL or storage, fbclid recovered from _fbc,
 * and _fbp / _ga from cookies when they pass the receiving side's format
 * checks.
 *
 * Params already on `url` always win and the URL's existing query is left
 * byte-for-byte as it was: new params are appended before any #fragment
 * (see offer.ts for why the order matters). Returns `url` unchanged when
 * there is nothing to forward or it does not parse.
 */
export declare function withAttribution(url: string, src?: AttributionSources): string;
/** Every query parameter `withAttribution` can add. */
export declare const FORWARDED_PARAMS: readonly string[];
/**
 * `url` with every parameter `withAttribution` could have added removed.
 * Used only as a comparison key ("is this the booking already in the
 * iframe?"), never navigated to: a booking link decorated in place by the
 * link forwarder must still resume the booking it points at. Unparseable
 * input comes back as is.
 */
export declare function withoutAttribution(url: string): string;
export {};
