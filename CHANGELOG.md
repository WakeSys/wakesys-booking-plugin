# Changelog

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
- Mobile detection uses viewport width only; short desktop windows are no
  longer misread as mobile.
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
