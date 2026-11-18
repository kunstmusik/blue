import { describe, expect, it } from 'vite-plus/test';
import {
  getAuxiliaryEdgeDropTarget,
  getAuxiliaryEdgeFromBounds,
  getAuxiliaryEdgeFromGroupElement,
} from '../components/workbench/auxiliary-drag';

const bounds = {
  left: 0,
  top: 0,
  right: 1200,
  bottom: 800,
};

describe('getAuxiliaryEdgeDropTarget', () => {
  it('detects left, right, and bottom edge targets', () => {
    expect(
      getAuxiliaryEdgeDropTarget(bounds, {
        x: 24,
        y: 220,
      }),
    ).toBe('left');

    expect(
      getAuxiliaryEdgeDropTarget(bounds, {
        x: 1176,
        y: 220,
      }),
    ).toBe('right');

    expect(
      getAuxiliaryEdgeDropTarget(bounds, {
        x: 620,
        y: 782,
      }),
    ).toBe('bottom');
  });

  it('prefers the nearest edge when hovering near a corner', () => {
    expect(
      getAuxiliaryEdgeDropTarget(bounds, {
        x: 12,
        y: 720,
      }),
    ).toBe('left');

    expect(
      getAuxiliaryEdgeDropTarget(bounds, {
        x: 620,
        y: 798,
      }),
    ).toBe('bottom');
  });

  it('returns undefined away from supported docking edges', () => {
    expect(
      getAuxiliaryEdgeDropTarget(bounds, {
        x: 600,
        y: 200,
      }),
    ).toBeUndefined();
  });
});

describe('getAuxiliaryEdgeFromBounds', () => {
  const containerBounds = {
    left: 100,
    top: 40,
    right: 1100,
    bottom: 760,
  };

  it('detects docked left, right, and bottom groups', () => {
    expect(
      getAuxiliaryEdgeFromBounds(containerBounds, {
        left: 100,
        top: 40,
        right: 332,
        bottom: 760,
      }),
    ).toBe('left');

    expect(
      getAuxiliaryEdgeFromBounds(containerBounds, {
        left: 868,
        top: 40,
        right: 1100,
        bottom: 760,
      }),
    ).toBe('right');

    expect(
      getAuxiliaryEdgeFromBounds(containerBounds, {
        left: 360,
        top: 548,
        right: 840,
        bottom: 760,
      }),
    ).toBe('bottom');
  });

  it('returns undefined for centered groups', () => {
    expect(
      getAuxiliaryEdgeFromBounds(containerBounds, {
        left: 380,
        top: 220,
        right: 820,
        bottom: 520,
      }),
    ).toBeUndefined();
  });
});

describe('getAuxiliaryEdgeFromGroupElement', () => {
  it('prefers the explicit auxiliary edge marker', () => {
    const leftGroup = { dataset: { auxEdge: 'left' } } as HTMLElement;
    const bottomGroup = { dataset: { auxEdge: 'bottom' } } as HTMLElement;

    expect(getAuxiliaryEdgeFromGroupElement(leftGroup)).toBe('left');
    expect(getAuxiliaryEdgeFromGroupElement(bottomGroup)).toBe('bottom');
  });

  it('returns undefined for non-auxiliary group elements', () => {
    const group = { dataset: {} } as HTMLElement;

    expect(getAuxiliaryEdgeFromGroupElement(group)).toBeUndefined();
    expect(getAuxiliaryEdgeFromGroupElement(undefined)).toBeUndefined();
  });
});
