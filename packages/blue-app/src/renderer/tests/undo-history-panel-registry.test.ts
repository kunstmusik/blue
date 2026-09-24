import { describe, expect, it } from 'vitest';
import { getPanel, getPanelsByMode } from '../../shared/workbench-menu';
import {
  AUXILIARY_SEED_DEFINITIONS,
  createDefaultSeededInstance,
} from '../components/workbench/auxiliary-layout-model';

describe('Undo History panel registration (spec 106, US1)', () => {
  it('registers in the properties mode and stays closed at startup', () => {
    const descriptor = getPanel('UndoHistoryTopComponent');
    expect(descriptor).toBeDefined();
    expect(descriptor?.title).toBe('Undo History');
    expect(descriptor?.mode).toBe('properties');
    expect(descriptor?.openAtStartup).toBe(false);
    expect(descriptor?.auxiliaryGroupId).toBe('properties-main');
    expect(getPanelsByMode('properties').map((panel) => panel.title)).toContain('Undo History');
  });

  it('joins the properties seed ordering but not the default seeded layout', () => {
    expect(AUXILIARY_SEED_DEFINITIONS['properties-main'].panelIds).toContain(
      'UndoHistoryTopComponent',
    );
    const seeded = createDefaultSeededInstance('properties-main', 0);
    expect(seeded.panelIds).not.toContain('UndoHistoryTopComponent');
    expect(seeded.dockedPanelIds).not.toContain('UndoHistoryTopComponent');
  });
});
