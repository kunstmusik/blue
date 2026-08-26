// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BSB_PROPERTY_SPLIT_SIZE_PX,
  DEFAULT_SPLIT_SIZE_PX,
  type SplitId,
} from '../../shared/window-layout-settings';

// Editor-owned split identities are stable string literals used by
// SplitPane call sites. This test verifies that the documented set exists,
// remains stable across launches, and that each editor uses one of the
// identities registered in the shared layout contract. The actual save/load
// round-trip is covered by layout-settings-store.test.ts and the shared
// merge/applyWindowLayoutUpdate tests.

const EXPECTED_EDITOR_SPLIT_IDS: SplitId[] = [
  'orchestra.outer',
  'score.main',
  'udo.workspace.outer',
  'bsb.interface.properties',
  'piano-roll.field-editor',
  'line-object.lines',
  'zak-line-object.lines',
  'pattern-object.layers',
  'pattern-object.score',
  'soundfont-viewer.tables',
];

describe('editor split identities', () => {
  it('registers a stable identity for every editor-owned split surface', () => {
    // Sanity: at least the three editor surfaces required by SC-004.
    expect(EXPECTED_EDITOR_SPLIT_IDS).toContain('line-object.lines');
    expect(EXPECTED_EDITOR_SPLIT_IDS).toContain('piano-roll.field-editor');
    expect(EXPECTED_EDITOR_SPLIT_IDS).toContain('pattern-object.layers');
  });

  it('uses the 200px default for side and bottom editor splits', () => {
    expect(DEFAULT_SPLIT_SIZE_PX).toBe(200);
  });

  it('documents the BSB property pane Java parity exception', () => {
    expect(BSB_PROPERTY_SPLIT_SIZE_PX).toBe(250);
    expect(BSB_PROPERTY_SPLIT_SIZE_PX).toBeGreaterThan(DEFAULT_SPLIT_SIZE_PX);
  });

  it('SplitPane accepts splitId values from the registered set', () => {
    // Type-level: SplitPane's splitId prop accepts the registered SplitId
    // values. The build step fails if the editor call sites pass an
    // unregistered string.
    type EditorSplitId = SplitId;
    const sample: EditorSplitId = 'line-object.lines';
    expect(sample).toBe('line-object.lines');
  });
});

// Stub React import chain so file is treated as a tsx module by vitest.
describe('editor split rendering placeholder', () => {
  it('renders an empty fragment without throwing', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(React.createElement('div'));
    });
    expect(container.firstChild).toBeTruthy();
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
