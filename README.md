# wakesys-booking-plugin

Drop-in booking panel for any website. One script tag, one container.

## Version History

| Version | Released   | Notes              |
| ------- | ---------- | ------------------- |
| 1.2.0   | 2026-11-16 | Ad clicks (fbclid, gclid, UTMs, _fbp, _ga) are forwarded to the booking, in the panel and on every wakesys link; the script also works without a panel, for parks that only link out. |
| 1.1.0   | 2026-09-16 | Closing keeps the booking; "Continue booking" pill; browser Back no longer closes the panel; localhost allowed in local development. |
| 1.0.1   | 2026-08-21 | CDN URL and release-script fixes; corrected `?offer=` docs. |
| 1.0.0   | 2026-08-20 | First public release. |

## Installation

### CDN

```html
<div id="wakesys-app" data-wakesys-url="https://wakesys.app/your-park/booking"></div>
<script src="https://cdn.jsdelivr.net/gh/WakeSys/wakesys-booking-plugin@v1.2.0/dist/plugin.js" async></script>
```

Pin an exact version. `@1` is available if you prefer automatic patch updates, but this widget sits in a payment flow — pinning is the safer default.

### npm (from GitHub)

The package is not published to the npm registry. Install it from a GitHub tag instead:

```bash
npm install github:WakeSys/wakesys-booking-plugin#v1.1.0
```

The built `dist/` output is committed, so no build step runs on install. Pin an exact tag; unlike the CDN there is no `@1` alias for git dependencies, so bump the tag deliberately when you want a new version.

Vanilla:

```js
import { createBookingPanel } from 'wakesys-booking-plugin';

const panel = createBookingPanel({
  bookingUrl: 'https://wakesys.app/your-park/booking',
});

panel.open();
```

`createBookingPanel` accepts the same `bookingUrl` / `mobileBreakpoint` / `position` / `title` / `resumeLabel` config as the CDN attributes, plus `onMobileOpen` and `onOpenChange` callbacks for custom handling. It returns:

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
| `resumeLabel`          | No       | Label of the resume pill. Default `'Continue booking'`. See [Resuming a booking](#resuming-a-booking). |
| `renderMobileFallback` | No       | `(args: { url, confirm, cancel }) => ReactNode`, rendered instead of opening a new tab below the breakpoint. Call `args.confirm()` to proceed to `args.url`, or `args.cancel()` to dismiss. |
| `renderNotice`         | No       | `() => ReactNode`, portaled into the panel between the header and the iframe (e.g. a demo-mode banner). Absent renders nothing. |

Changing `title`, `position`, `mobileBreakpoint`, or `resumeLabel` recreates the panel instance and closes an open booking. `bookingUrl` deliberately does not — it updates the existing panel in place, so an in-progress booking survives a URL change (e.g. a route-driven park switch).

An invalid `bookingUrl` **throws** from `BookingPanelProvider` (and from `createBookingPanel` generally), where the vanilla script-tag adapter degrades to a console warning and a no-op `window.BookingPanel` instead. This is deliberate: the React prop is a typed value supplied by the app's own author, so a bad URL is a bug worth failing loudly on; the vanilla adapter boots from `data-` attributes on a page it doesn't control, so it degrades gracefully rather than breaking a stranger's page.

`useBookingPanel()` returns:

| Member       | Description                                                                 |
| ------------- | ------------------------------------------------------------------------------ |
| `open(url?)`  | Opens the panel, optionally with a different booking URL for this call only.  |
| `close()`     | Closes the panel.                                                              |
| `openOffer(offer)` | Opens the panel at `<bookingUrl>?offer=<offer>`, using whichever `bookingUrl` the mounted provider currently has. Note the booking app does not currently read `?offer=` — see [Triggering](#triggering). |
| `isOpen`      | Boolean, kept in sync with every real open/close transition — including the close button, the overlay, Escape, and the mobile-resize auto-close, not just calls made through this hook. |

## Configuration

Set as attributes on the `#wakesys-app` container element (CDN usage) or as props on `BookingPanelProvider` / fields on the `createBookingPanel` config object (package usage).

| Attribute                | Required | Default | Values          | Description                                                     |
| ------------------------- | -------- | ------- | ---------------- | ----------------------------------------------------------------- |
| `data-wakesys-url`        | Yes      | —       | URL              | The booking page to display, e.g. `https://wakesys.app/your-park/booking`. |
| `data-wakesys-mobile`     | No       | `768`   | number (px)      | Viewport width below which booking opens in a new tab instead of the panel. |
| `data-wakesys-position`   | No       | `right` | `right` \| `left`| Side the panel slides in from.                                    |
| `data-wakesys-resume-label` | No     | `Continue booking` | text    | Label of the resume pill (see [Resuming a booking](#resuming-a-booking)). |

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

## Resuming a booking

Closing the panel does not discard the booking. The iframe keeps its document, so opening the panel again with the same URL (the default "Book now" button) brings the visitor back to the exact step they left. Opening a different URL, such as an offer deep link, loads fresh.

When the panel is closed while the booking app is on a page other than the one it started on, a small "Continue booking" pill appears in the bottom corner on the panel's side. Clicking it reopens the panel. Its X discards the booking: the frame is blanked and the next open starts on the first page. Anything the booking app persisted on its own origin, such as a cookie-backed cart, is untouched, since the plugin cannot reach it. The pill is never shown on mobile, where booking opens in a new tab.

The plugin cannot see inside the cross-origin frame, so it detects "moved to another page" from the tab's shared session history: a client-side step inside the booking app grows `history.length`, and growth while the panel is open counts. This is approximate. A step made with a replace-navigation is invisible, and a return to the first page still counts as having moved on. The booking app can make it exact with the message below.

### Browser history

The panel does not push a history entry and never calls `history.back()`. The booking app pushes its own steps into the same shared history as the host page, so a `back()` from the panel would rewind the booking instead of closing the panel. Consequences: the browser Back button steps the booking back while the panel is open, and leaves the page when the booking is on its first page. After closing mid-booking, Back first rewinds the hidden frame's steps before it leaves the host page. That last point is inherent to keeping the booking alive across close, and only the booking app can remove it by navigating with replace when framed.

### Booking app contract (optional)

The booking app can tell the plugin exactly which page it is on by posting a message to its parent on every route change, including the first render. When these messages arrive they take precedence over the history heuristic:

```ts
// In the booking layout of the booking app (React Router shown)
const { pathname } = useLocation();
useEffect(() => {
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'wakesys:route', path: pathname }, '*');
  }
}, [pathname]);
```

The plugin accepts the message only from its own iframe and only from `wakesys.app`, `staging.wakesys.app`, or localhost during local development. The path is the only field read; a wildcard target origin is fine because the message carries nothing sensitive.

## Ad attribution

The ad click usually lands on the park's own site, while the purchase happens on `wakesys.app`. Browsers keep each site's URL parameters and cookies to that site, so without help the booking looks unattributed to Meta, Google Ads and GA4. The plugin carries the attribution across by appending it to the booking URL it opens (iframe, mobile new tab, and the URL passed to `onMobileOpen` / `renderMobileFallback`):

| Forwarded | From |
| --------- | ---- |
| `fbclid`, `gclid`, `gad_source`, `gbraid`, `wbraid`, `msclkid`, `ttclid`, `twclid`, `li_fat_id` | The page URL, else the visitor's landing page (stored for 30 days in `localStorage` under `wakesys_attribution`). `fbclid` is also recovered from the `_fbc` cookie. |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `utm_id` | The same, as one set: a newer campaign replaces the whole stored set, so values from two ads are never mixed. |
| `_fbp`, `_ga` | The Meta Pixel and GA4 cookies on the park's site, only when they have the expected format. |

A parameter already on the booking URL is never overridden, and none of this changes when an open resumes an existing booking. Nothing is sent anywhere else: the values only go into the booking URL. Storage or cookies that the browser blocks are skipped silently.

The wakesys booking app turns these back into cookies and attribution on its side.

Links to `wakesys.app` are decorated too, at the moment they are pressed: plain links, links the site adds later, and Cmd/Ctrl/middle-clicks and "open in new tab" on panel links, which the panel leaves to the browser. A booking resumes whether or not its link was decorated in place.

### Parks that only link to wakesys

A park that links out to its booking page instead of embedding the panel loads the same script and nothing else. With no `#wakesys-app` element on the page, no panel is created; the script only forwards attribution on wakesys links:

```html
<script src="https://cdn.jsdelivr.net/gh/WakeSys/wakesys-booking-plugin@v1.2.0/dist/plugin.js" async></script>
```

Put it on every page of the site (Webflow: Site settings → Custom code → Footer code), so a visitor who lands on one page and books from another still carries the click. **One script either way:** don't add a separate attribution snippet next to the plugin.

For a button that opens the booking from your own code, use the helper the script installs:

```js
window.open(window.wakesysDecorateBookingUrl('https://wakesys.app/your-park/booking'), '_blank');
```

From npm, the same pieces are exports: `withAttribution(url)`, and `installLinkForwarding()` for a link-only setup.

```js
import { withAttribution } from 'wakesys-booking-plugin';
window.open(withAttribution('https://wakesys.app/your-park/booking'), '_blank');
```

**Parks on an older embed need to update the pinned version** in their script tag (or `npm install` tag) to get this. A pinned `@v1.1.0` keeps the old behaviour.

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
