# Changelog

## 1.0.1

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
