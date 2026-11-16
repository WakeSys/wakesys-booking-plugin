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

export const CLICK_ID_PARAMS: readonly string[] = [
  'fbclid',
  'gclid',
  'gad_source',
  'gbraid',
  'wbraid',
  'msclkid',
  'ttclid',
  'twclid',
  'li_fat_id',
];

export const UTM_PARAMS: readonly string[] = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
];

export const STORAGE_KEY = 'wakesys_attribution';
/** 30 days: Meta's maximum click-attribution window. */
export const STORAGE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// The receiving side's own regexes (app_observer, rehydrateCrossDomainCookies).
// A value that fails them is dropped there, so forwarding it only adds noise.
const FBP_RE = /^fb\.\d+\.\d+\.\d+$/;
const GA_RE = /^GA\d+\.\d+\.\d+\.\d+$/;
const FBCLID_RE = /^[A-Za-z0-9_.-]{1,400}$/;
// _fbc: fb.<subdomainIndex>.<creationTimeMs>.<fbclid>
const FBC_RE = /^fb\.\d+\.\d+\.(.+)$/;

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

interface Resolved {
  search: URLSearchParams;
  cookie: string;
  storage: StorageLike | null;
  now: number;
}

function resolve(src: AttributionSources = {}): Resolved {
  let search = src.search;
  if (search === undefined) {
    try {
      search = typeof window === 'undefined' ? '' : window.location.search;
    } catch {
      search = '';
    }
  }

  let cookie = src.cookie;
  if (cookie === undefined) {
    try {
      cookie = typeof document === 'undefined' ? '' : document.cookie;
    } catch {
      cookie = ''; // sandboxed document without allow-same-origin throws here
    }
  }

  let storage: StorageLike | null;
  if (src.storage !== undefined) {
    storage = src.storage;
  } else {
    try {
      // The getter itself throws (SecurityError) when site data is blocked.
      storage = typeof window === 'undefined' ? null : window.localStorage;
    } catch {
      storage = null;
    }
  }

  return { search: new URLSearchParams(search), cookie, storage, now: src.now ?? Date.now() };
}

function readCookie(cookie: string, name: string): string | null {
  for (const part of cookie.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1 || part.slice(0, eq).trim() !== name) continue;
    const raw = part.slice(eq + 1).trim();
    if (!raw) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw; // malformed %-escape: use it raw, the format checks decide
    }
  }
  return null;
}

function safeGet(storage: StorageLike | null, key: string): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function readPersisted(r: Resolved): Record<string, string> {
  const raw = safeGet(r.storage, STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as { params?: unknown; ts?: unknown };
    if (typeof parsed?.ts !== 'number' || r.now - parsed.ts > STORAGE_TTL_MS) return {};
    if (!parsed.params || typeof parsed.params !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed.params as Record<string, unknown>)) {
      if (typeof v === 'string' && v) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function fbclidFromFbc(r: Resolved): string | null {
  const fbc = readCookie(r.cookie, '_fbc') ?? safeGet(r.storage, '_fbc');
  const m = fbc ? FBC_RE.exec(fbc) : null;
  return m && FBCLID_RE.test(m[1]) ? m[1] : null;
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
export function persistAttributionFromUrl(src?: AttributionSources): void {
  try {
    const r = resolve(src);
    if (!r.storage) return;

    const captured: Record<string, string> = {};
    let touched = false;
    for (const key of CLICK_ID_PARAMS) {
      const v = r.search.get(key);
      if (v) { captured[key] = v; touched = true; }
    }
    const hasUtm = UTM_PARAMS.some((k) => r.search.get(k));
    if (hasUtm) {
      for (const key of UTM_PARAMS) {
        const v = r.search.get(key);
        if (v) captured[key] = v;
      }
      touched = true;
    }
    if (!touched) return;

    const merged = readPersisted(r);
    if (hasUtm) for (const key of UTM_PARAMS) delete merged[key];
    Object.assign(merged, captured);
    r.storage.setItem(STORAGE_KEY, JSON.stringify({ params: merged, ts: r.now }));
  } catch {
    // quota exceeded / storage disabled: nothing to persist, nothing to break
  }
}

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
export function withAttribution(url: string, src?: AttributionSources): string {
  let existing: URLSearchParams;
  try {
    existing = new URL(url).searchParams;
  } catch {
    return url;
  }

  let add: Array<[string, string]>;
  try {
    add = collect(existing, resolve(src));
  } catch {
    return url;
  }
  if (add.length === 0) return url;

  const hashIndex = url.indexOf('#');
  const base = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
  const query = add.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const sep = !base.includes('?') ? '?' : base.endsWith('?') || base.endsWith('&') ? '' : '&';
  return `${base}${sep}${query}${hash}`;
}

function collect(existing: URLSearchParams, r: Resolved): Array<[string, string]> {
  const persisted = readPersisted(r);
  const add: Array<[string, string]> = [];
  const has = (k: string) => existing.has(k) || add.some(([a]) => a === k);

  for (const key of CLICK_ID_PARAMS) {
    if (existing.has(key)) continue;
    const v = r.search.get(key) || persisted[key];
    if (v) add.push([key, v]);
  }

  // UTMs travel as one group from one source, never mixed: the target's own
  // campaign tagging wins outright, then the current URL's, then storage's.
  const targetHasUtm = UTM_PARAMS.some((k) => existing.has(k));
  if (!targetHasUtm) {
    const fromUrl = UTM_PARAMS.some((k) => r.search.get(k));
    for (const key of UTM_PARAMS) {
      const v = fromUrl ? r.search.get(key) : persisted[key];
      if (v) add.push([key, v]);
    }
  }

  if (!has('fbclid')) {
    const fbclid = fbclidFromFbc(r);
    if (fbclid) add.push(['fbclid', fbclid]);
  }

  if (!has('_fbp')) {
    const fbp = readCookie(r.cookie, '_fbp');
    if (fbp && FBP_RE.test(fbp)) add.push(['_fbp', fbp]);
  }

  if (!has('_ga')) {
    const ga = readCookie(r.cookie, '_ga');
    if (ga && GA_RE.test(ga)) add.push(['_ga', ga]);
  }

  return add;
}

/** Every query parameter `withAttribution` can add. */
export const FORWARDED_PARAMS: readonly string[] = [...CLICK_ID_PARAMS, ...UTM_PARAMS, '_fbp', '_ga'];

/**
 * `url` with every parameter `withAttribution` could have added removed.
 * Used only as a comparison key ("is this the booking already in the
 * iframe?"), never navigated to: a booking link decorated in place by the
 * link forwarder must still resume the booking it points at. Unparseable
 * input comes back as is.
 */
export function withoutAttribution(url: string): string {
  try {
    const u = new URL(url);
    for (const k of FORWARDED_PARAMS) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return url;
  }
}
