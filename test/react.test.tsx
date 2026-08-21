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
});
