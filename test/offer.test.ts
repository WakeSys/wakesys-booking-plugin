import { describe, it, expect } from 'vitest';
import { appendOffer } from '../src/core/offer';

describe('appendOffer', () => {
  it('appends a query string when there is no fragment or existing query', () => {
    expect(appendOffer('https://wakesys.app/park-a/booking', 'aqua')).toBe(
      'https://wakesys.app/park-a/booking?offer=aqua',
    );
  });

  it('puts the offer query before an existing fragment', () => {
    expect(appendOffer('https://wakesys.app/park-a/booking#step2', 'aqua')).toBe(
      'https://wakesys.app/park-a/booking?offer=aqua#step2',
    );
  });

  it('joins with & when a query string already exists', () => {
    expect(appendOffer('https://wakesys.app/park-a/booking?lang=fr', 'aqua')).toBe(
      'https://wakesys.app/park-a/booking?lang=fr&offer=aqua',
    );
  });

  it('joins with & and keeps the fragment last when both query and fragment exist', () => {
    expect(appendOffer('https://wakesys.app/park-a/booking?lang=fr#step2', 'aqua')).toBe(
      'https://wakesys.app/park-a/booking?lang=fr&offer=aqua#step2',
    );
  });

  it('percent-encodes characters that need it in the offer value', () => {
    expect(appendOffer('https://wakesys.app/park-a/booking', '#&/" ')).toBe(
      'https://wakesys.app/park-a/booking?offer=%23%26%2F%22%20',
    );
  });
});
