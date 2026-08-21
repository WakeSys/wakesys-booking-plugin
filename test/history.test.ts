import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  pushPanelState, popPanelState, notePopped, getDepth, resetDepth,
} from '../src/core/history';

beforeEach(() => {
  resetDepth();
  vi.restoreAllMocks();
});

describe('panel history', () => {
  it('pushes an entry and tracks depth', () => {
    const push = vi.spyOn(history, 'pushState').mockImplementation(() => {});
    pushPanelState();
    expect(push).toHaveBeenCalledTimes(1);
    expect(getDepth()).toBe(1);
  });

  it('pops only what it pushed', () => {
    vi.spyOn(history, 'pushState').mockImplementation(() => {});
    const back = vi.spyOn(history, 'back').mockImplementation(() => {});
    pushPanelState();
    popPanelState();
    expect(back).toHaveBeenCalledTimes(1);
    expect(getDepth()).toBe(0);
  });

  it('does not call back() when it pushed nothing', () => {
    const back = vi.spyOn(history, 'back').mockImplementation(() => {});
    popPanelState();
    expect(back).not.toHaveBeenCalled();
    expect(getDepth()).toBe(0);
  });

  it('survives a host replaceState wiping the state object', () => {
    vi.spyOn(history, 'pushState').mockImplementation(() => {});
    const back = vi.spyOn(history, 'back').mockImplementation(() => {});
    pushPanelState();
    history.replaceState({ somethingElse: true }, ''); // Next.js scroll restore
    popPanelState();
    expect(back).toHaveBeenCalledTimes(1); // depth counter, not history.state
  });

  it('notePopped decrements without calling back', () => {
    vi.spyOn(history, 'pushState').mockImplementation(() => {});
    const back = vi.spyOn(history, 'back').mockImplementation(() => {});
    pushPanelState();
    notePopped();
    expect(getDepth()).toBe(0);
    expect(back).not.toHaveBeenCalled();
  });

  it('swallows SecurityError on opaque origins', () => {
    vi.spyOn(history, 'pushState').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(() => pushPanelState()).not.toThrow();
    expect(getDepth()).toBe(0);
  });
});
