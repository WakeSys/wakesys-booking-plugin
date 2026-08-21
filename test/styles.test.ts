import { describe, it, expect, beforeEach } from 'vitest';
import { buildCss, ensureStyles, releaseStyles } from '../src/core/styles';

const sheets = () => document.head.querySelectorAll('style[data-wakesys-booking]');

beforeEach(() => {
  document.head.innerHTML = '';
});

describe('buildCss', () => {
  it('anchors the panel to the configured side', () => {
    expect(buildCss(768, 'right')).toContain('right:0');
    expect(buildCss(768, 'right')).toContain('translateX(100%)');
    expect(buildCss(768, 'left')).toContain('left:0');
    expect(buildCss(768, 'left')).toContain('translateX(-100%)');
  });

  it('derives the media query from the breakpoint', () => {
    expect(buildCss(1024, 'right')).toContain('(max-width:1023px)');
  });

  it('keeps the documented panel dimensions', () => {
    const css = buildCss(768, 'right');
    expect(css).toContain('width:428px');
    expect(css).toContain('z-index:10000');
  });
});

describe('ensureStyles / releaseStyles', () => {
  it('injects exactly once and removes on the last release', () => {
    ensureStyles('.x{}');
    ensureStyles('.x{}');
    expect(sheets()).toHaveLength(1);

    releaseStyles();
    expect(sheets()).toHaveLength(1); // still one holder

    releaseStyles();
    expect(sheets()).toHaveLength(0);
  });

  it('never goes negative on extra releases', () => {
    ensureStyles('.x{}');
    releaseStyles();
    releaseStyles();
    ensureStyles('.x{}');
    expect(sheets()).toHaveLength(1);
  });
});
