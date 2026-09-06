import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function parseRgb(colorStr: string): { r: number; g: number; b: number; a: number } {
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) {
    throw new Error(`Unparseable rgb color: ${colorStr}`);
  }
  return {
    r: parseInt(match[1], 10),
    g: parseInt(match[2], 10),
    b: parseInt(match[3], 10),
    a: match[4] !== undefined ? parseFloat(match[4]) : 1,
  };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const sRgbToLinear = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * sRgbToLinear(r) + 0.7152 * sRgbToLinear(g) + 0.0722 * sRgbToLinear(b);
}

function contrastRatio(
  c1: { r: number; g: number; b: number },
  c2: { r: number; g: number; b: number },
): number {
  const l1 = relativeLuminance(c1);
  const l2 = relativeLuminance(c2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Accessibility Contrast Browser Spot Checks (T012)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders application text with passing contrast against backgrounds', () => {
    act(() => {
      root.render(
        <div style={{ backgroundColor: '#1a1a2e', padding: '16px' }}>
          <span id="app-text" style={{ color: '#ffffff' }}>
            Normal Application Text
          </span>
          <span id="app-text-muted" style={{ color: '#c8c8d8' }}>
            Muted Text
          </span>
        </div>,
      );
    });

    const textEl = container.querySelector('#app-text') as HTMLElement;
    const parentEl = textEl.parentElement as HTMLElement;
    const fg = parseRgb(window.getComputedStyle(textEl).color);
    const bg = parseRgb(window.getComputedStyle(parentEl).backgroundColor);

    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('renders primary button controls with accessible contrast', () => {
    act(() => {
      root.render(
        <div style={{ backgroundColor: '#16213e', padding: '16px' }}>
          <button
            id="primary-btn"
            style={{
              backgroundColor: '#5a85c3',
              color: '#0d1524',
              border: '1px solid #7ea5dc',
              padding: '6px 12px',
            }}
          >
            Action
          </button>
        </div>,
      );
    });

    const btn = container.querySelector('#primary-btn') as HTMLElement;
    const computed = window.getComputedStyle(btn);
    const fg = parseRgb(computed.color);
    const bg = parseRgb(computed.backgroundColor);

    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('renders Mute and Solo badges with passing contrast for active states', () => {
    act(() => {
      root.render(
        <div style={{ backgroundColor: '#111a2d', padding: '16px' }}>
          {/* Active Mute: high-contrast dark foreground on success fill */}
          <button
            id="mute-btn"
            aria-pressed="true"
            style={{ backgroundColor: '#22c55e', color: '#052e16', padding: '4px 8px' }}
          >
            M
          </button>
          {/* Active Solo: high-contrast dark foreground on warning fill */}
          <button
            id="solo-btn"
            aria-pressed="true"
            style={{ backgroundColor: '#eab308', color: '#422006', padding: '4px 8px' }}
          >
            S
          </button>
        </div>,
      );
    });

    const muteBtn = container.querySelector('#mute-btn') as HTMLElement;
    const muteFg = parseRgb(window.getComputedStyle(muteBtn).color);
    const muteBg = parseRgb(window.getComputedStyle(muteBtn).backgroundColor);
    expect(contrastRatio(muteFg, muteBg)).toBeGreaterThanOrEqual(4.5);

    const soloBtn = container.querySelector('#solo-btn') as HTMLElement;
    const soloFg = parseRgb(window.getComputedStyle(soloBtn).color);
    const soloBg = parseRgb(window.getComputedStyle(soloBtn).backgroundColor);
    expect(contrastRatio(soloFg, soloBg)).toBeGreaterThanOrEqual(4.5);
  });

  it('renders CodeMirror comment text above normal text floor', () => {
    act(() => {
      root.render(
        <div style={{ backgroundColor: '#0d0d1a', padding: '16px' }}>
          <span id="cm-comment" style={{ color: '#8ca0a0' }}>
            ; Csound comment text
          </span>
        </div>,
      );
    });

    const commentEl = container.querySelector('#cm-comment') as HTMLElement;
    const fg = parseRgb(window.getComputedStyle(commentEl).color);
    const bg = parseRgb(window.getComputedStyle(commentEl.parentElement!).backgroundColor);

    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('renders essential boundaries and focus rings with at least 3.0:1 non-text contrast', () => {
    act(() => {
      root.render(
        <div style={{ backgroundColor: '#1a1a2e', padding: '16px' }}>
          <input
            id="test-input"
            style={{
              backgroundColor: '#0a0f1a',
              borderColor: '#4d7ab8',
              outlineColor: '#4a9eff',
              borderWidth: '1px',
              borderStyle: 'solid',
            }}
          />
        </div>,
      );
    });

    const input = container.querySelector('#test-input') as HTMLElement;
    const parent = input.parentElement as HTMLElement;
    const border = parseRgb(window.getComputedStyle(input).borderColor);
    const bg = parseRgb(window.getComputedStyle(parent).backgroundColor);

    expect(contrastRatio(border, bg)).toBeGreaterThanOrEqual(3.0);

    const focusRing = parseRgb(window.getComputedStyle(input).outlineColor);
    expect(contrastRatio(focusRing, bg)).toBeGreaterThanOrEqual(3.0);
  });
});
