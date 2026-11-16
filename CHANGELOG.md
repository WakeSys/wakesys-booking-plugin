# Changelog

## 1.2.0

### Added
- Ad attribution is forwarded to the booking app. The park's marketing page
  usually receives the ad click, but its click IDs and cookies live on the
  park's domain, so the wakesys GTM container saw every plugin booking as
  unattributed and Meta / Google Ads purchases could not be tied back to the
  ad. The panel now appends, when present: click IDs (`fbclid`, `gclid`,
  `gad_source`, `gbraid`, `wbraid`, `msclkid`, `ttclid`, `twclid`,
  `li_fat_id`) and `utm_*` from the page URL; `fbclid` recovered from the
  `_fbc` cookie; and the `_fbp` / `_ga` cookies, only when they match the
  formats the booking side accepts. Landing-page click IDs and UTMs are kept
  in `localStorage` (`wakesys_attribution`, 30 days) so a visitor who browses
  before booking still carries them. Params already on the booking URL win,
  and UTMs travel as one set, never mixed from two campaigns. Applies to the
  iframe, the mobile new tab, and the URL handed to `onMobileOpen` /
  `renderMobileFallback`. `withAttribution(url)` is exported for custom
  triggers. See README, "Ad attribution".

### Unchanged
- Resuming. Whether an open resumes the existing booking or loads fresh is
  still decided on the configured URL, never the decorated one, so a cookie
  the park's Pixel sets after the first open cannot reload the iframe and
  discard an in-progress booking.

## 1.1.0

### Changed
- Closing the panel no longer discards the booking. The iframe keeps its
  document, and a later open with the same URL resumes exactly where the
  visitor left off instead of restarting on step one. Opening a different URL
  (an offer deep link, a park switch) still loads fresh.

- The panel no longer pushes a history entry on open or calls `history.back()`
  on close, and the browser Back button no longer closes it. The booking app
  pushes its own steps into the tab's shared history, so the old `back()`
  rewound the booking by one step on every close once the frame was kept
  alive. Back now steps the booking back while the panel is open. See README,
  "Browser history", for the remaining trade-off after closing mid-booking.

### Added
- A "Continue booking" pill in the bottom corner, shown after the panel is
  closed while the booking app sits on a page other than the one it started
  on. Clicking it reopens the panel; its X discards the booking so the next
  open starts on the first page (state the booking app keeps on its own
  origin is untouched). The label is configurable via `data-wakesys-resume-label`, the
  `resumeLabel` prop, or the `resumeLabel` config field. Detection uses
  `history.length` growth while the panel is open, which the booking app can
  make exact with the optional `wakesys:route` postMessage (see README).
- Local development support: a page that is itself served from `localhost`,
  `127.0.0.1`, or `[::1]` may now open a booking URL on any of those hosts
  (any port). Pages on every other host keep the exact-origin allowlist
  (`wakesys.app`, `staging.wakesys.app`), so production behavior is
  unchanged — a live site can never frame localhost.

## 1.0.1

### Documentation
- Corrected the offer-deep-link docs. The plugin appends `?offer=<slug>` to the
  booking URL, but the wakesys booking app does not read that parameter — it
  deep-links by `offerId` + `productId` on a different route — so a customer
  following the previous instructions landed on the normal first step. The
  behaviour is unchanged and correct; only the claim about what it achieves was
  wrong. Documented the working alternative.

### Fixed
- Every documented CDN URL returned 404. jsDelivr's `/gh/` endpoint is
  case-sensitive on the org segment (`WakeSys`, not `wakesys`), and an exact
  version pin must use the tag name itself — `@1.0.0` does not resolve against
  a tag named `v1.0.0`. The install snippet, the release script's own
  verification URL, and its README-rewrite pattern were all corrected.
- `npm run release` now fails fast when npm authentication is missing, instead
  of pushing the tag first and dying at publish — which left a released tag
  with no package behind it.
- `npm publish --provenance` is now used only under CI. Provenance needs an
  OIDC token from a supported runner and errors outright on a workstation.

### Added
- `npm run release -- <version> --no-npm` tags and pushes for CDN and
  git-dependency consumers without publishing to npm.

## 1.0.0

First public release. Extracted from the wakesys demos site into a standalone
versioned package.

### Added
- Framework-agnostic core, vanilla IIFE build for script-tag embedding, and a
  React adapter (`wakesys-booking-plugin/react`).
- `setBookingUrl()` and `destroy()`, so the panel works under client-side
  routing and React unmount.
- `onMobileOpen` / `renderMobileFallback` for custom mobile handling.

### Fixed
- Panel mounts on `<body>`; `position: fixed` no longer resolves against a
  transformed or clipped ancestor.
- Mobile detection is width-based, with a coarse-pointer check added for
  landscape phones (wide but short viewports on a touch device); a short
  desktop window with a fine pointer is not misread as mobile.
- Trigger URLs resolve at click time, so SPA re-renders cannot fire a stale offer.
- Modified clicks (Cmd/Ctrl/Shift/Alt, middle-click) open a new tab as expected.
- Resizing below the breakpoint no longer leaves the page scroll-locked.
- History uses an internal depth counter, so a host `replaceState` cannot
  strand a phantom entry; `open()` no longer pushes duplicates.
- The closed panel is `inert`, hiding it from assistive technology.
- `window.BookingPanel` is always defined.
- A malformed `data-wakesys-mobile` falls back to 768 instead of disabling
  mobile handling; an invalid `data-wakesys-position` falls back to `right`.
- Link auto-upgrade no longer matches paths like `/booking-terms`.
