# wakesys-booking-plugin

Drop-in booking panel for any website. One script tag, one container.

## Version History

| Version | Released   | Notes              |
| ------- | ---------- | ------------------- |
| 1.0.0   | 2026-08-20 | First public release. |

## Installation

### CDN

```html
<div id="wakesys-app" data-wakesys-url="https://wakesys.app/your-park/booking"></div>
<script src="https://cdn.jsdelivr.net/gh/WakeSys/wakesys-booking-plugin@v1.0.1/dist/plugin.js" async></script>
```

Pin an exact version. `@1` is available if you prefer automatic patch updates, but this widget sits in a payment flow — pinning is the safer default.

### npm

```bash
npm install wakesys-booking-plugin
```

Vanilla:

```js
import { createBookingPanel } from 'wakesys-booking-plugin';

const panel = createBookingPanel({
  bookingUrl: 'https://wakesys.app/your-park/booking',
});

panel.open();
```

`createBookingPanel` accepts the same `bookingUrl` / `mobileBreakpoint` / `position` / `title` config as the CDN attributes, plus `onMobileOpen` and `onOpenChange` callbacks for custom handling. It returns:

| Member          | Description                                                       |
| ---------------- | --------------------------------------------------------------------- |
| `open(url?)`      | Opens the panel, optionally with a different booking URL.            |
| `close()`         | Closes the panel.                                                     |
| `isOpen()`        | Returns whether the panel is currently open.                          |
| `setBookingUrl(url)` | Replaces the default URL used by future `open()` calls.            |
| `getBookingUrl()` | Returns the current default URL.                                      |
| `getNoticeSlot()` | Returns the DOM element between the header and the iframe, for callers that want to render their own banner there (e.g. via a portal) without going through the React adapter. |
| `destroy()`       | Removes all DOM and listeners this instance created. Safe to call twice. |

The package also exports a few helpers, useful if you're building a custom trigger UI:

| Export                    | Description                                                          |
| -------------------------- | ------------------------------------------------------------------------ |
| `isAllowedUrl(url)`         | Returns `true` if `url` points at `wakesys.app` or `staging.wakesys.app`. Validate a URL yourself before calling `open()` with it. |
| `ALLOWED_ORIGINS`           | The `readonly string[]` of origins `isAllowedUrl` checks against.        |
| `DEFAULT_MOBILE_BREAKPOINT` | The default `mobileBreakpoint` value, `768`.                             |

React:

```tsx
import { BookingPanelProvider, useBookingPanel } from 'wakesys-booking-plugin/react';

function App() {
  return (
    <>
      <BookingPanelProvider bookingUrl="https://wakesys.app/your-park/booking" />
      <BookButton />
    </>
  );
}

function BookButton() {
  const { open, openOffer } = useBookingPanel();
  return (
    <>
      <button onClick={() => open()}>Book now</button>
      <button onClick={() => openOffer('summer-sale')}>Book the summer sale</button>
    </>
  );
}
```

`BookingPanelProvider` mounts one panel per application. It can render anywhere in the tree — it does not need to be an ancestor of the elements that open it.

| Prop                 | Required | Description                                                                 |
| --------------------- | -------- | ----------------------------------------------------------------------------- |
| `bookingUrl`           | Yes      | The booking page to display. Updates in place without recreating the panel. |
| `mobileBreakpoint`     | No       | Viewport width below which booking opens in a new tab. Default `768`.       |
| `position`             | No       | `'right'` \| `'left'`. Default `'right'`.                                   |
| `title`                | No       | Panel header text and `aria-label`. Default `'Booking'`.                    |
| `renderMobileFallback` | No       | `(args: { url, confirm, cancel }) => ReactNode`, rendered instead of opening a new tab below the breakpoint. Call `args.confirm()` to proceed to `args.url`, or `args.cancel()` to dismiss. |
| `renderNotice`         | No       | `() => ReactNode`, portaled into the panel between the header and the iframe (e.g. a demo-mode banner). Absent renders nothing. |

Changing `title`, `position`, or `mobileBreakpoint` recreates the panel instance and closes an open booking. `bookingUrl` deliberately does not — it updates the existing panel in place, so an in-progress booking survives a URL change (e.g. a route-driven park switch).

An invalid `bookingUrl` **throws** from `BookingPanelProvider` (and from `createBookingPanel` generally), where the vanilla script-tag adapter degrades to a console warning and a no-op `window.BookingPanel` instead. This is deliberate: the React prop is a typed value supplied by the app's own author, so a bad URL is a bug worth failing loudly on; the vanilla adapter boots from `data-` attributes on a page it doesn't control, so it degrades gracefully rather than breaking a stranger's page.

`useBookingPanel()` returns:

| Member       | Description                                                                 |
| ------------- | ------------------------------------------------------------------------------ |
| `open(url?)`  | Opens the panel, optionally with a different booking URL for this call only.  |
| `close()`     | Closes the panel.                                                              |
| `openOffer(offer)` | Opens the panel at `<bookingUrl>?offer=<offer>`, using whichever `bookingUrl` the mounted provider currently has. Note the booking app does not currently read `?offer=` — see [Triggering](#triggering). |
| `isOpen`      | Boolean, kept in sync with every real open/close transition — including the close button, the overlay, Escape, browser back, and the mobile-resize auto-close, not just calls made through this hook. |

## Configuration

Set as attributes on the `#wakesys-app` container element (CDN usage) or as props on `BookingPanelProvider` / fields on the `createBookingPanel` config object (npm usage).

| Attribute                | Required | Default | Values          | Description                                                     |
| ------------------------- | -------- | ------- | ---------------- | ----------------------------------------------------------------- |
| `data-wakesys-url`        | Yes      | —       | URL              | The booking page to display, e.g. `https://wakesys.app/your-park/booking`. |
| `data-wakesys-mobile`     | No       | `768`   | number (px)      | Viewport width below which booking opens in a new tab instead of the panel. |
| `data-wakesys-position`   | No       | `right` | `right` \| `left`| Side the panel slides in from.                                    |

## Triggering

Any element with `data-wakesys-book` opens the panel on click:

```html
<button data-wakesys-book>Book now</button>
```

Giving the attribute a value appends it as `?offer=<slug>`:

```html
<button data-wakesys-book="summer-sale">Book the summer sale</button>
```

> **The wakesys booking app does not currently read `?offer=`.** The parameter
> is passed through to the booking URL and ignored, so the customer lands on the
> normal first step. To open a specific activity today, point at its full
> booking URL instead — the booking flow deep-links by id, not by slug:
>
> ```html
> <a href="https://wakesys.app/my-park/booking/email?offerId=...&productId=...">
>   Book the aqua park
> </a>
> ```
>
> Any `wakesys.app` URL opens in the panel, so an ordinary link is enough.

Links whose `href` already points at a booking page are upgraded automatically — no attribute needed:

```html
<a href="https://wakesys.app/your-park/booking">Book your visit</a>
```

Newly added triggers (e.g. from client-side routing) are picked up automatically; no re-initialization is required.

## JavaScript API

```js
window.BookingPanel.open(url);          // opens the panel, optionally with a different booking URL
window.BookingPanel.close();
window.BookingPanel.isOpen();           // boolean
window.BookingPanel.setBookingUrl(url); // replaces the default URL for subsequent open() calls
```

`window.BookingPanel` is always defined once the script has loaded, even if the plugin failed to boot (missing `#wakesys-app`, missing `data-wakesys-url`, or a disallowed URL). In that case its methods are warning no-ops — they log to the console and do nothing, rather than throwing.

## Security

The plugin only frames `wakesys.app` and `staging.wakesys.app`. This prevents a site owner from pointing the widget at the wrong origin; it is **not** an anti-embedding control, since anyone can write their own iframe tag. Restricting who may embed the booking app requires a server-side `frame-ancestors` policy.

The iframe is sandboxed with `allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox`, and `allow` is scoped to `payment` and `geolocation` on the booking origin only.

## Known limitations

Once focus moves inside the booking iframe, keystrokes belong to that cross-origin document, so <kbd>Esc</kbd> will not close the panel and the focus trap cannot follow. Fixing this requires the booking app to forward key events via `postMessage`; it is planned for a future release.

## Browser support

Evergreen browsers (recent Chrome, Firefox, Safari, Edge). The panel uses standard DOM APIs including `MutationObserver`; there is no legacy-browser (e.g. IE11) build.

## Licence

GPL-3.0

## Links

- Repository: https://github.com/wakesys/wakesys-booking-plugin
- Issues: https://github.com/wakesys/wakesys-booking-plugin/issues
