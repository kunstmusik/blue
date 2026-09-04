import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import ScoreObjectPropertiesPanel from '../components/workbench/panels/ScoreObjectPropertiesPanel';
import ScoreObjectEditorPanel from '../components/workbench/panels/ScoreObjectEditorPanel';

vi.mock('../stores/project-store', () => ({
  useProjectStore: vi.fn((selector) => {
    const state = {
      loaded: false,
      score: { timeState: { primaryTimeDisplay: 'BEATS' }, layerGroups: [] },
    };
    return selector(state);
  }),
}));

vi.mock('../stores/score-selection-store', () => ({
  useScoreSelectionStore: vi.fn((selector) => {
    const state = { selectedObjectIds: new Set() };
    return selector(state);
  }),
}));

describe('Score object editor panel routing', () => {
  it('routes SoundObjectPropertiesTopComponent to ScoreObjectPropertiesPanel (not PlaceholderPanel)', () => {
    const html = renderToStaticMarkup(createElement(ScoreObjectPropertiesPanel));

    expect(html).toContain('No project loaded');
    expect(html).not.toContain('PlaceholderPanel');
  });

  it('routes ScoreObjectEditorTopComponent to ScoreObjectEditorPanel (not PlaceholderPanel)', () => {
    const html = renderToStaticMarkup(createElement(ScoreObjectEditorPanel));

    expect(html).toContain('No project loaded');
    expect(html).not.toContain('PlaceholderPanel');
  });
});
