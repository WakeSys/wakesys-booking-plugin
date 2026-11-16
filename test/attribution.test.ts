import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  persistAttributionFromUrl, withAttribution, STORAGE_KEY, STORAGE_TTL_MS,
} from '../src/core/attribution';

const BOOK = 'https://wakesys.app/park-a/booking';
const NOW = 1_800_000_000_000;
const FBP = 'fb.1.1700000000000.1234567890';
const GA = 'GA1.1.123456789.1700000000';

function memoryStorage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    data,
  };
}

function stored(params: Record<string, string>, ts = NOW) {
  return memoryStorage({ [STORAGE_KEY]: JSON.stringify({ params, ts }) });
}

/** No page params, no cookies, empty storage: the identity baseline. */
const empty = () => ({ search: '', cookie: '', storage: memoryStorage(), now: NOW });

describe('withAttribution', () => {
  it('returns the url unchanged when there is nothing to forward', () => {
    expect(withAttribution(BOOK, empty())).toBe(BOOK);
    expect(withAttribution(`${BOOK}?offerId=1#x`, empty())).toBe(`${BOOK}?offerId=1#x`);
  });

  it('forwards click IDs and UTMs from the current page URL', () => {
    const out = withAttribution(BOOK, {
      ...empty(),
      search: '?fbclid=IwAR1abc&gclid=Cj0K-x_y&utm_source=facebook&utm_medium=paid&utm_campaign=summer',
    });
    expect(out).toBe(
      `${BOOK}?fbclid=IwAR1abc&gclid=Cj0K-x_y&utm_source=facebook&utm_medium=paid&utm_campaign=summer`,
    );
  });

  it('forwards every supported click ID', () => {
    const ids = ['fbclid', 'gclid', 'gad_source', 'gbraid', 'wbraid', 'msclkid', 'ttclid', 'twclid', 'li_fat_id'];
    const out = new URL(withAttribution(BOOK, {
      ...empty(), search: ids.map((k) => `${k}=v-${k}`).join('&'),
    }));
    for (const k of ids) expect(out.searchParams.get(k)).toBe(`v-${k}`);
  });

  it('ignores page params that are not attribution', () => {
    expect(withAttribution(BOOK, { ...empty(), search: '?page=2&ref=nav' })).toBe(BOOK);
  });

  it('url-encodes forwarded values', () => {
    const out = withAttribution(BOOK, { ...empty(), search: '?utm_campaign=Summer%20Sale%20%26%20more%23x' });
    expect(out).toBe(`${BOOK}?utm_campaign=Summer%20Sale%20%26%20more%23x`);
    expect(new URL(out).searchParams.get('utm_campaign')).toBe('Summer Sale & more#x');
  });

  it('places params before a #fragment', () => {
    expect(withAttribution(`${BOOK}#step2`, { ...empty(), search: '?gclid=abc' }))
      .toBe(`${BOOK}?gclid=abc#step2`);
    expect(withAttribution(`${BOOK}?offerId=1#step2`, { ...empty(), search: '?gclid=abc' }))
      .toBe(`${BOOK}?offerId=1&gclid=abc#step2`);
  });

  it('leaves the target\'s existing query byte-for-byte intact', () => {
    // URLSearchParams would re-serialize %20 as "+"; the existing query must
    // not be touched at all.
    const target = `${BOOK}/email?offerId=a%20b&productId=2`;
    expect(withAttribution(target, { ...empty(), search: '?gclid=abc' }))
      .toBe(`${target}&gclid=abc`);
  });

  it('joins cleanly onto a trailing ? or &', () => {
    expect(withAttribution(`${BOOK}?`, { ...empty(), search: '?gclid=abc' })).toBe(`${BOOK}?gclid=abc`);
    expect(withAttribution(`${BOOK}?a=1&`, { ...empty(), search: '?gclid=abc' })).toBe(`${BOOK}?a=1&gclid=abc`);
  });

  it('never overrides a param already on the target', () => {
    const out = new URL(withAttribution(`${BOOK}?fbclid=mine&_fbp=fb.1.1.1&_ga=GA1.1.1.1`, {
      ...empty(),
      search: '?fbclid=page',
      cookie: `_fbc=fb.1.1700000000000.cookie; _fbp=${FBP}; _ga=${GA}`,
    }));
    expect(out.searchParams.getAll('fbclid')).toEqual(['mine']);
    expect(out.searchParams.getAll('_fbp')).toEqual(['fb.1.1.1']);
    expect(out.searchParams.getAll('_ga')).toEqual(['GA1.1.1.1']);
  });

  it('prefers the current URL over storage', () => {
    const out = new URL(withAttribution(BOOK, {
      ...empty(), search: '?gclid=fromUrl', storage: stored({ gclid: 'fromStorage', msclkid: 'ms' }),
    }));
    expect(out.searchParams.get('gclid')).toBe('fromUrl');
    expect(out.searchParams.get('msclkid')).toBe('ms');
  });

  it('falls back to stored params when the page URL has none', () => {
    const out = new URL(withAttribution(BOOK, {
      ...empty(), storage: stored({ fbclid: 'stored', utm_source: 'facebook', utm_campaign: 'c' }),
    }));
    expect(out.searchParams.get('fbclid')).toBe('stored');
    expect(out.searchParams.get('utm_source')).toBe('facebook');
    expect(out.searchParams.get('utm_campaign')).toBe('c');
  });

  it('ignores stored params older than 30 days', () => {
    const out = withAttribution(BOOK, {
      ...empty(), storage: stored({ gclid: 'old' }, NOW - STORAGE_TTL_MS - 1),
    });
    expect(out).toBe(BOOK);
  });

  it('ignores corrupt storage', () => {
    for (const raw of ['{not json', 'null', '{"params":{"gclid":"x"}}', '{"ts":1,"params":"x"}']) {
      expect(withAttribution(BOOK, { ...empty(), storage: memoryStorage({ [STORAGE_KEY]: raw }) })).toBe(BOOK);
    }
  });

  it('takes UTMs as one group: the URL\'s set never mixes with a stored set', () => {
    const out = new URL(withAttribution(BOOK, {
      ...empty(),
      search: '?utm_source=google',
      storage: stored({ utm_source: 'facebook', utm_campaign: 'meta-summer' }),
    }));
    expect(out.searchParams.get('utm_source')).toBe('google');
    expect(out.searchParams.has('utm_campaign')).toBe(false);
  });

  it('forwards no UTMs when the target carries its own campaign tagging', () => {
    const out = new URL(withAttribution(`${BOOK}?utm_source=newsletter`, {
      ...empty(), search: '?utm_source=facebook&utm_campaign=summer',
    }));
    expect(out.searchParams.getAll('utm_source')).toEqual(['newsletter']);
    expect(out.searchParams.has('utm_campaign')).toBe(false);
  });

  it('recovers fbclid from the _fbc cookie', () => {
    const out = new URL(withAttribution(BOOK, {
      ...empty(), cookie: 'other=1; _fbc=fb.1.1700000000000.IwAR_x-y.z',
    }));
    expect(out.searchParams.get('fbclid')).toBe('IwAR_x-y.z');
  });

  it('prefers the page URL fbclid over the _fbc cookie', () => {
    const out = new URL(withAttribution(BOOK, {
      ...empty(), search: '?fbclid=fresh', cookie: '_fbc=fb.1.1700000000000.old',
    }));
    expect(out.searchParams.getAll('fbclid')).toEqual(['fresh']);
  });

  it('drops a malformed _fbc rather than forwarding garbage', () => {
    for (const fbc of ['garbage', 'fb.1.notanumber.abc', 'fb.1.170.', 'fb.1.170.a<b']) {
      expect(withAttribution(BOOK, { ...empty(), cookie: `_fbc=${fbc}` })).toBe(BOOK);
    }
  });

  it('forwards _fbp and _ga from cookies when they match the receiving formats', () => {
    const out = new URL(withAttribution(BOOK, { ...empty(), cookie: `_fbp=${FBP}; _ga=${GA}` }));
    expect(out.searchParams.get('_fbp')).toBe(FBP);
    expect(out.searchParams.get('_ga')).toBe(GA);
  });

  it('drops _fbp and _ga that fail the receiving formats', () => {
    for (const cookie of [
      '_fbp=fb.1.abc.123', '_fbp=fb.1.1', '_fbp=xfb.1.1.1',
      '_ga=GA1.2.3', '_ga=GA1.1.1.1.1', '_ga=GS1.1.1.1', '_ga=GA1.1.1.1%3Bdomain%3Devil',
    ]) {
      expect(withAttribution(BOOK, { ...empty(), cookie })).toBe(BOOK);
    }
  });

  it('does not match cookies whose name merely ends in _ga or _fbp', () => {
    expect(withAttribution(BOOK, { ...empty(), cookie: `x_ga=${GA}; my_fbp=${FBP}` })).toBe(BOOK);
  });

  it('returns an unparseable url unchanged', () => {
    expect(withAttribution('not a url', { ...empty(), search: '?gclid=abc' })).toBe('not a url');
  });

  it('survives storage that throws', () => {
    const storage = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('SecurityError'); },
    };
    expect(withAttribution(BOOK, { ...empty(), storage, search: '?gclid=abc' }))
      .toBe(`${BOOK}?gclid=abc`);
  });

  it('works with storage unavailable', () => {
    expect(withAttribution(BOOK, { ...empty(), storage: null, search: '?gclid=abc' }))
      .toBe(`${BOOK}?gclid=abc`);
  });
});

describe('persistAttributionFromUrl', () => {
  it('stores click IDs and UTMs with a timestamp', () => {
    const storage = memoryStorage();
    persistAttributionFromUrl({ search: '?fbclid=a&utm_source=fb&page=2', storage, now: NOW });
    expect(JSON.parse(storage.data.get(STORAGE_KEY)!)).toEqual({
      params: { fbclid: 'a', utm_source: 'fb' },
      ts: NOW,
    });
  });

  it('writes nothing when the URL carries no attribution', () => {
    const storage = memoryStorage();
    persistAttributionFromUrl({ search: '?page=2', storage, now: NOW });
    expect(storage.data.has(STORAGE_KEY)).toBe(false);
  });

  it('accumulates click IDs individually', () => {
    const storage = stored({ fbclid: 'meta' }, NOW - 1000);
    persistAttributionFromUrl({ search: '?gclid=google', storage, now: NOW });
    expect(JSON.parse(storage.data.get(STORAGE_KEY)!).params).toEqual({ fbclid: 'meta', gclid: 'google' });
  });

  it('replaces stored UTMs as a group', () => {
    const storage = stored({ utm_source: 'facebook', utm_campaign: 'meta-summer', fbclid: 'm' });
    persistAttributionFromUrl({ search: '?utm_source=google', storage, now: NOW });
    expect(JSON.parse(storage.data.get(STORAGE_KEY)!).params).toEqual({ fbclid: 'm', utm_source: 'google' });
  });

  it('drops an expired stored set instead of merging into it', () => {
    const storage = stored({ fbclid: 'old' }, NOW - STORAGE_TTL_MS - 1);
    persistAttributionFromUrl({ search: '?gclid=new', storage, now: NOW });
    expect(JSON.parse(storage.data.get(STORAGE_KEY)!).params).toEqual({ gclid: 'new' });
  });

  it('round-trips: a later page without params still forwards the landing params', () => {
    const storage = memoryStorage();
    persistAttributionFromUrl({ search: '?fbclid=land&utm_source=facebook', storage, now: NOW });
    expect(withAttribution(BOOK, { search: '', cookie: '', storage, now: NOW + 86_400_000 }))
      .toBe(`${BOOK}?fbclid=land&utm_source=facebook`);
  });

  it('never throws when storage throws', () => {
    const storage = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('QuotaExceededError'); },
    };
    expect(() => persistAttributionFromUrl({ search: '?gclid=a', storage, now: NOW })).not.toThrow();
  });
});

describe('live page defaults', () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, '', '/');
  });
  afterEach(() => {
    vi.restoreAllMocks(); // first: the clean-up below uses the real accessors
    localStorage.clear();
    history.replaceState(null, '', '/');
    for (const c of ['_fbp', '_ga', '_fbc']) document.cookie = `${c}=; max-age=0; path=/`;
  });

  it('reads location.search, document.cookie and localStorage', () => {
    history.replaceState(null, '', '/landing?gclid=live');
    document.cookie = `_fbp=${FBP}; path=/`;
    persistAttributionFromUrl();
    history.replaceState(null, '', '/other-page');

    const out = new URL(withAttribution(BOOK));
    expect(out.searchParams.get('gclid')).toBe('live');
    expect(out.searchParams.get('_fbp')).toBe(FBP);
  });

  it('treats a throwing localStorage getter as no storage', () => {
    const getter = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    history.replaceState(null, '', '/?gclid=x');
    expect(() => persistAttributionFromUrl()).not.toThrow();
    expect(withAttribution(BOOK)).toBe(`${BOOK}?gclid=x`);
    expect(getter).toHaveBeenCalled();
  });

  it('treats a throwing document.cookie getter as no cookies', () => {
    document.cookie = `_fbp=${FBP}; path=/`; // would be forwarded if read
    vi.spyOn(document, 'cookie', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(withAttribution(BOOK)).toBe(BOOK);
  });
});
