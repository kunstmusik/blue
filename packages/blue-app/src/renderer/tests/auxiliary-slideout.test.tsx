// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuxiliarySlideout from '../components/workbench/AuxiliarySlideout';
import type { AuxiliarySlideoutView } from '../components/workbench/auxiliary-layout';

vi.mock('../components/workbench/panels/output/OutputPanel', () => ({
  default: () => React.createElement('div', { 'data-testid': 'output-panel' }),
}));

vi.mock('../components/workbench/panels/MarkersPanel', () => ({
  default: () => React.createElement('div', { 'data-testid': 'markers-panel' }),
}));

vi.mock('../components/workbench/panels/LibrariesPanel', () => ({
  default: () => React.createElement('div', { 'data-testid': 'libraries-panel' }),
}));

vi.mock('../components/workbench/panels/audio-player/AudioPlayerPanel', () => ({
  default: () => React.createElement('div', { 'data-testid': 'audio-player-panel' }),
}));

vi.mock('../components/workbench/panels/ScratchPadPanel', () => ({
  default: () => React.createElement('div', { 'data-testid': 'scratch-pad-panel' }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderRoot(element: React.ReactElement): {
  container: HTMLDivElement;
  root: Root;
  unmount: () => void;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(element);
  });

  return {
    container,
    root,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('AuxiliarySlideout', () => {
  it('renders the output panel for the output slideout', () => {
    const slideout: AuxiliarySlideoutView = {
      edge: 'right',
      groupInstanceId: 'output-main',
      panelId: 'OutputTopComponent',
      size: 320,
    };

    const tree = renderRoot(
      <AuxiliarySlideout
        slideout={slideout}
        onClose={vi.fn()}
        onDock={vi.fn()}
        onResize={vi.fn()}
      />,
    );

    expect(tree.container.querySelector('[data-testid="output-panel"]')).not.toBeNull();
    expect(tree.container.textContent).not.toContain('Placeholder — to be implemented');

    tree.unmount();
  });

  it('renders the libraries panel for LibrariesTopComponent slideout', () => {
    const slideout: AuxiliarySlideoutView = {
      edge: 'right',
      groupInstanceId: 'properties-main',
      panelId: 'LibrariesTopComponent',
      size: 320,
    };

    const tree = renderRoot(
      <AuxiliarySlideout
        slideout={slideout}
        onClose={vi.fn()}
        onDock={vi.fn()}
        onResize={vi.fn()}
      />,
    );

    expect(tree.container.querySelector('[data-testid="libraries-panel"]')).not.toBeNull();
    expect(tree.container.textContent).not.toContain('Placeholder — to be implemented');

    tree.unmount();
  });

  it('renders audio player panel for AudioFilePlayerTopComponent slideout', () => {
    const slideout: AuxiliarySlideoutView = {
      edge: 'right',
      groupInstanceId: 'properties-main',
      panelId: 'AudioFilePlayerTopComponent',
      size: 320,
    };

    const tree = renderRoot(
      <AuxiliarySlideout
        slideout={slideout}
        onClose={vi.fn()}
        onDock={vi.fn()}
        onResize={vi.fn()}
      />,
    );

    expect(tree.container.querySelector('[data-testid="audio-player-panel"]')).not.toBeNull();
    expect(tree.container.textContent).not.toContain('Placeholder — to be implemented');

    tree.unmount();
  });

  it('renders the Scratch Pad panel', () => {
    const slideout: AuxiliarySlideoutView = {
      edge: 'right',
      groupInstanceId: 'properties-main',
      panelId: 'ScratchPadTopComponent',
      size: 320,
    };

    const tree = renderRoot(
      <AuxiliarySlideout
        slideout={slideout}
        onClose={vi.fn()}
        onDock={vi.fn()}
        onResize={vi.fn()}
      />,
    );

    expect(tree.container.querySelector('[data-testid="scratch-pad-panel"]')).not.toBeNull();
    expect(tree.container.textContent).not.toContain('Placeholder — to be implemented');

    tree.unmount();
  });

  it('renders the markers panel for the markers slideout', () => {
    const slideout: AuxiliarySlideoutView = {
      edge: 'right',
      groupInstanceId: 'properties-main',
      panelId: 'MarkersTopComponent',
      size: 320,
    };

    const tree = renderRoot(
      <AuxiliarySlideout
        slideout={slideout}
        onClose={vi.fn()}
        onDock={vi.fn()}
        onResize={vi.fn()}
      />,
    );

    expect(tree.container.querySelector('[data-testid="markers-panel"]')).not.toBeNull();
    expect(tree.container.textContent).not.toContain('Placeholder — to be implemented');

    tree.unmount();
  });
});
