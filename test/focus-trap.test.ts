import { describe, it, expect, beforeEach } from 'vitest';
import { handleTabKey } from '../src/core/focus-trap';

let container: HTMLElement;
let first: HTMLButtonElement;
let last: HTMLButtonElement;

beforeEach(() => {
  document.body.innerHTML = '';
  container = document.createElement('div');
  first = document.createElement('button');
  last = document.createElement('button');
  container.append(first, last);
  document.body.appendChild(container);
});

function tab(shiftKey = false) {
  return new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true });
}

describe('handleTabKey', () => {
  it('wraps forward from the last element to the first', () => {
    last.focus();
    const e = tab();
    handleTabKey(e, container);
    expect(document.activeElement).toBe(first);
    expect(e.defaultPrevented).toBe(true);
  });

  it('wraps backward from the first element to the last', () => {
    first.focus();
    const e = tab(true);
    handleTabKey(e, container);
    expect(document.activeElement).toBe(last);
    expect(e.defaultPrevented).toBe(true);
  });

  it('leaves interior tabbing to the browser', () => {
    first.focus();
    const e = tab();
    handleTabKey(e, container);
    expect(e.defaultPrevented).toBe(false);
  });

  it('does nothing when the container has no focusable children', () => {
    const empty = document.createElement('div');
    document.body.appendChild(empty);
    const e = tab();
    expect(() => handleTabKey(e, empty)).not.toThrow();
    expect(e.defaultPrevented).toBe(false);
  });
});
