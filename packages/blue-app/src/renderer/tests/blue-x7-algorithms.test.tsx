// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALGORITHM_IMAGES, getAlgorithmImage } from '../assets/blue-x7/algorithm-images';
import { AlgorithmTopology } from '../components/instruments/blue-x7/algorithm-topology';
import { AlgorithmDialog } from '../components/instruments/blue-x7/algorithm-dialog';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('BlueX7 Algorithm Topology and Manifest', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    root = null;
  });

  it('has static asset mappings for all 32 DX7 algorithms as SVGs', () => {
    expect(Object.keys(ALGORITHM_IMAGES)).toHaveLength(32);
    for (let i = 1; i <= 32; i++) {
      const src = getAlgorithmImage(i);
      expect(src).toBeDefined();
      expect(typeof src).toBe('string');
      expect(src!.length).toBeGreaterThan(0);
      expect(src).toMatch(/\.svg|data:image\/svg\+xml/);
    }
  });

  it('renders AlgorithmTopology with interactive SVG diagram and toggles operators on click', () => {
    const onOpenModal = vi.fn();
    const onToggleOperator = vi.fn();
    const enables: [boolean, boolean, boolean, boolean, boolean, boolean] = [
      true,
      false,
      true,
      true,
      false,
      true,
    ];

    act(() => {
      root?.render(
        <AlgorithmTopology
          algorithm={19}
          operatorEnabled={enables}
          onToggleOperator={onToggleOperator}
          onOpenModal={onOpenModal}
        />,
      );
    });

    const svg = container?.querySelector('[data-testid="algorithm-img-19"]') as SVGSVGElement;
    expect(svg).not.toBeNull();

    expect(container?.textContent).toContain('Algorithm 19');

    // Click operator 2 box
    const op2Box = container?.querySelector('g[aria-label^="Operator 2"]') as SVGGElement;
    expect(op2Box).not.toBeNull();
    expect(op2Box.getAttribute('aria-pressed')).toBe('false');

    act(() => {
      op2Box.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onToggleOperator).toHaveBeenCalledWith(1); // 0-indexed operator 2

    // Click operator 1 box
    const op1Box = container?.querySelector('g[aria-label^="Operator 1"]') as SVGGElement;
    expect(op1Box).not.toBeNull();
    expect(op1Box.getAttribute('aria-pressed')).toBe('true');

    act(() => {
      op1Box.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onToggleOperator).toHaveBeenCalledWith(0); // 0-indexed operator 1

    // Clicking Change button triggers onOpenModal
    const btn = container?.querySelector('button[aria-label="Choose Algorithm Dialog"]') as HTMLButtonElement;
    act(() => {
      btn.click();
    });
    expect(onOpenModal).toHaveBeenCalledTimes(1);
  });

  it('renders AlgorithmDialog with 32 selectable algorithm cards and handles selection', () => {
    const onClose = vi.fn();
    const onSelectAlgorithm = vi.fn();

    act(() => {
      root?.render(
        <AlgorithmDialog
          currentAlgorithm={5}
          isOpen={true}
          onClose={onClose}
          onSelectAlgorithm={onSelectAlgorithm}
        />,
      );
    });

    const dialog = container?.querySelector('[data-testid="algorithm-dialog"]');
    expect(dialog).not.toBeNull();

    // 32 buttons
    const algButtons = container?.querySelectorAll('button[aria-label^="Select Algorithm"]');
    expect(algButtons?.length).toBe(32);

    // Click algorithm 14
    const alg14Btn = container?.querySelector('button[aria-label="Select Algorithm 14"]') as HTMLButtonElement;
    expect(alg14Btn).not.toBeNull();

    act(() => {
      alg14Btn.click();
    });

    expect(onSelectAlgorithm).toHaveBeenCalledWith(14);
    expect(onClose).toHaveBeenCalled();
  });
});
