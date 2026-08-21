import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { StrictMode } from 'react';
import { BookingPanelProvider, useBookingPanel } from '../src/react';
import { resetDepth } from '../src/core/history';

const URL_A = 'https://wakesys.app/park-a/booking';
const URL_B = 'https://wakesys.app/park-b/booking';

function Trigger() {
  const { open, isOpen } = useBookingPanel();
  return (
    <button onClick={() => open()}>{isOpen ? 'open' : 'closed'}</button>
  );
}

function OfferTrigger() {
  const { openOffer } = useBookingPanel();
  return <button onClick={() => openOffer('SUMMER10')}>offer</button>;
}

function CloseTrigger() {
  const { close } = useBookingPanel();
  return <button onClick={() => close()}>close-hook</button>;
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  resetDepth();
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
  vi.spyOn(history, 'pushState').mockImplementation(() => {});
  vi.spyOn(history, 'back').mockImplementation(() => {});
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('BookingPanelProvider', () => {
  it('mounts the panel DOM on body', () => {
    render(<BookingPanelProvider bookingUrl={URL_A} />);
    expect(document.querySelector('.ws-panel')).not.toBeNull();
  });

  it('tears the panel down on unmount', () => {
    const { unmount } = render(<BookingPanelProvider bookingUrl={URL_A} />);
    unmount();
    expect(document.querySelector('.ws-panel')).toBeNull();
  });

  it('survives StrictMode double-mounting', () => {
    render(
      <StrictMode>
        <BookingPanelProvider bookingUrl={URL_A} />
      </StrictMode>,
    );
    expect(document.querySelectorAll('.ws-panel')).toHaveLength(1);
  });

  it('does not tear the panel down when only bookingUrl changes', () => {
    const { rerender } = render(<BookingPanelProvider bookingUrl={URL_A} />);
    const before = document.querySelector('.ws-panel');
    rerender(<BookingPanelProvider bookingUrl={URL_B} />);
    expect(document.querySelector('.ws-panel')).toBe(before);
  });

  it('a bookingUrl change on one provider does not retarget a different mounted provider', () => {
    // Two providers mounted at once is not the supported shape (one instance
    // per app), but a bug here means the *first* provider's URL prop silently
    // overwrites the *second* provider's live panel, opening the wrong park.
    const URL_C = 'https://wakesys.app/park-c/booking';
    const first = render(<BookingPanelProvider bookingUrl={URL_A} />);
    render(
      <>
        <Trigger />
        <BookingPanelProvider bookingUrl={URL_B} />
      </>,
    );

    first.rerender(<BookingPanelProvider bookingUrl={URL_C} />);

    act(() => { screen.getByRole('button', { name: /^(closed|open)$/ }).click(); });
    // Two panels are mounted; the second-rendered provider's DOM (the one
    // Trigger's `open()` call targets, via the module-level `instance` it
    // last set) is appended after the first's.
    const secondIframe = document.querySelectorAll('iframe')[1];
    expect(secondIframe.getAttribute('src')).toBe(URL_B);
  });

  it('unmounting an earlier provider does not clobber a still-mounted later one', () => {
    const first = render(<BookingPanelProvider bookingUrl={URL_A} />);
    render(
      <>
        <Trigger />
        <BookingPanelProvider bookingUrl={URL_B} />
      </>,
    );

    first.unmount();

    act(() => { screen.getByRole('button', { name: /^(closed|open)$/ }).click(); });
    expect(document.querySelector('iframe')!.getAttribute('src')).toBe(URL_B);
  });
});

describe('useBookingPanel', () => {
  it('works from a component that is not a descendant of the provider', () => {
    render(
      <>
        <Trigger />
        <BookingPanelProvider bookingUrl={URL_A} />
      </>,
    );
    const trigger = screen.getByRole('button', { name: /^(closed|open)$/ });
    act(() => { trigger.click(); });
    expect(trigger.textContent).toBe('open');
    expect(document.querySelector('iframe')!.getAttribute('src')).toBe(URL_A);
  });

  it('reflects the latest bookingUrl prop', () => {
    const { rerender } = render(
      <>
        <Trigger />
        <BookingPanelProvider bookingUrl={URL_A} />
      </>,
    );
    rerender(
      <>
        <Trigger />
        <BookingPanelProvider bookingUrl={URL_B} />
      </>,
    );
    act(() => { screen.getByRole('button', { name: /^(closed|open)$/ }).click(); });
    expect(document.querySelector('iframe')!.getAttribute('src')).toBe(URL_B);
  });

  it('open is a safe no-op with no provider mounted', () => {
    render(<Trigger />);
    expect(() => act(() => { screen.getByRole('button').click(); })).not.toThrow();
  });

  it('close is a safe no-op with no provider mounted', () => {
    render(<CloseTrigger />);
    expect(() => act(() => { screen.getByRole('button').click(); })).not.toThrow();
  });

  it('openOffer is a safe no-op with no provider mounted', () => {
    render(<OfferTrigger />);
    expect(() => act(() => { screen.getByRole('button').click(); })).not.toThrow();
  });

  it('openOffer resolves against the live provider bookingUrl, not a hardcoded default', () => {
    const { rerender } = render(
      <>
        <OfferTrigger />
        <BookingPanelProvider bookingUrl={URL_A} />
      </>,
    );
    rerender(
      <>
        <OfferTrigger />
        <BookingPanelProvider bookingUrl={URL_B} />
      </>,
    );
    act(() => { screen.getByRole('button', { name: 'offer' }).click(); });
    expect(document.querySelector('iframe')!.getAttribute('src')).toBe(`${URL_B}?offer=SUMMER10`);
  });

  it('openOffer puts the offer in the query, before a URL fragment', () => {
    const URL_WITH_HASH = 'https://wakesys.app/park-a/booking#step2';
    render(
      <>
        <OfferTrigger />
        <BookingPanelProvider bookingUrl={URL_WITH_HASH} />
      </>,
    );
    act(() => { screen.getByRole('button', { name: 'offer' }).click(); });
    expect(document.querySelector('iframe')!.getAttribute('src')).toBe(
      'https://wakesys.app/park-a/booking?offer=SUMMER10#step2',
    );
  });

  it('openOffer also keeps isOpen in sync (subsumed by the same onOpenChange path)', () => {
    render(
      <>
        <Trigger />
        <OfferTrigger />
        <BookingPanelProvider bookingUrl={URL_A} />
      </>,
    );
    const trigger = screen.getByRole('button', { name: /^(closed|open)$/ });
    expect(trigger.textContent).toBe('closed');
    act(() => { screen.getByRole('button', { name: 'offer' }).click(); });
    expect(trigger.textContent).toBe('open');
  });

  it('open/close via the hook keep isOpen in sync', () => {
    render(
      <>
        <Trigger />
        <CloseTrigger />
        <BookingPanelProvider bookingUrl={URL_A} />
      </>,
    );
    const trigger = screen.getByRole('button', { name: /^(closed|open)$/ });
    act(() => { trigger.click(); });
    expect(trigger.textContent).toBe('open');

    act(() => { screen.getByRole('button', { name: 'close-hook' }).click(); });
    expect(trigger.textContent).toBe('closed');
  });
});

describe('isOpen reflects native close routes (not just hook close())', () => {
  it('updates when closed via the panel close button', () => {
    render(
      <>
        <Trigger />
        <BookingPanelProvider bookingUrl={URL_A} />
      </>,
    );
    const trigger = screen.getByRole('button', { name: /^(closed|open)$/ });
    act(() => { trigger.click(); });
    expect(trigger.textContent).toBe('open');

    act(() => { (document.querySelector('.ws-close') as HTMLElement).click(); });
    expect(trigger.textContent).toBe('closed');
  });

  it('updates when closed via the overlay', () => {
    render(
      <>
        <Trigger />
        <BookingPanelProvider bookingUrl={URL_A} />
      </>,
    );
    const trigger = screen.getByRole('button', { name: /^(closed|open)$/ });
    act(() => { trigger.click(); });
    expect(trigger.textContent).toBe('open');

    act(() => { (document.querySelector('.ws-overlay') as HTMLElement).click(); });
    expect(trigger.textContent).toBe('closed');
  });

  it('updates when closed via Escape', () => {
    render(
      <>
        <Trigger />
        <BookingPanelProvider bookingUrl={URL_A} />
      </>,
    );
    const trigger = screen.getByRole('button', { name: /^(closed|open)$/ });
    act(() => { trigger.click(); });
    expect(trigger.textContent).toBe('open');

    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(trigger.textContent).toBe('closed');
  });

  it('updates when closed via browser back (popstate)', () => {
    render(
      <>
        <Trigger />
        <BookingPanelProvider bookingUrl={URL_A} />
      </>,
    );
    const trigger = screen.getByRole('button', { name: /^(closed|open)$/ });
    act(() => { trigger.click(); });
    expect(trigger.textContent).toBe('open');

    act(() => { window.dispatchEvent(new PopStateEvent('popstate', { state: null })); });
    expect(trigger.textContent).toBe('closed');
  });

  it('updates when closed via the mobile-resize auto-close', () => {
    vi.useFakeTimers();
    render(
      <>
        <Trigger />
        <BookingPanelProvider bookingUrl={URL_A} />
      </>,
    );
    const trigger = screen.getByRole('button', { name: /^(closed|open)$/ });
    act(() => { trigger.click(); });
    expect(trigger.textContent).toBe('open');

    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
      window.dispatchEvent(new Event('resize'));
      vi.advanceTimersByTime(200);
    });
    expect(trigger.textContent).toBe('closed');
    vi.useRealTimers();
  });
});

describe('renderMobileFallback', () => {
  it('renders instead of opening a tab on mobile', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    render(
      <>
        <Trigger />
        <BookingPanelProvider
          bookingUrl={URL_A}
          renderMobileFallback={({ url, confirm, cancel }) => (
            <div>
              <span>fallback:{url}</span>
              <button onClick={confirm}>go</button>
              <button onClick={cancel}>no</button>
            </div>
          )}
        />
      </>,
    );

    act(() => { screen.getAllByRole('button')[0].click(); });
    expect(screen.getByText(`fallback:${URL_A}`)).toBeTruthy();
    expect(openSpy).not.toHaveBeenCalled();

    act(() => { screen.getByText('go').click(); });
    expect(openSpy).toHaveBeenCalledWith(URL_A, '_blank', 'noopener');
  });

  it('falls through to window.open on mobile when no fallback is registered', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    render(
      <>
        <Trigger />
        <BookingPanelProvider bookingUrl={URL_A} />
      </>,
    );

    act(() => { screen.getByRole('button', { name: /^(closed|open)$/ }).click(); });
    expect(openSpy).toHaveBeenCalledWith(URL_A, '_blank', 'noopener');
  });
});
