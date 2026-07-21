import { describe, expect, it } from 'vitest';
import { PANEL_MAP, getDefaultEditorPanels } from '../components/workbench/panel-registry';
import {
  createStoredWorkbenchLayout,
  createDefaultAuxiliaryLayoutState,
  parseStoredWorkbenchLayout,
} from '../components/workbench/auxiliary-layout';

describe('Unified Libraries workbench integration', () => {
  it('registers Libraries without turning the standalone Welcome screen into an editor', () => {
    expect(PANEL_MAP.get('LibrariesTopComponent')).toMatchObject({
      title: 'Libraries',
      auxiliaryGroupId: 'properties-main',
    });
    expect(PANEL_MAP.has('WelcomeTopComponent')).toBe(false);
    expect(PANEL_MAP.get('SoundObjectLibraryTopComponent')).toMatchObject({
      title: 'Project SoundObjects',
      auxiliaryGroupId: 'properties-main',
      openAtStartup: false,
    });
    expect(getDefaultEditorPanels().map((panel) => panel.id)).not.toContain('WelcomeTopComponent');
  });

  it('preserves separate Libraries and Project SoundObject Library layout IDs', () => {
    const stored = createStoredWorkbenchLayout({
      grid: { root: { type: 'branch' }, height: 900, width: 1400, orientation: 'horizontal' },
      panels: {
        LibrariesTopComponent: {
          id: 'LibrariesTopComponent',
          contentComponent: 'default',
          tabComponent: 'default',
          title: 'Libraries',
        },
        SoundObjectLibraryTopComponent: {
          id: 'SoundObjectLibraryTopComponent',
          contentComponent: 'default',
          tabComponent: 'default',
          title: 'Sound Object Library',
        },
      },
      activeGroup: 'properties-main',
    } as never, createDefaultAuxiliaryLayoutState(), {
      floatingOrigins: { legacyPopout: {
        kind: 'auxiliary',
        edge: 'right',
        groupInstanceId: 'properties-main',
        panelId: 'SoundObjectLibraryTopComponent',
        index: 0,
      } },
    });
    const parsed = parseStoredWorkbenchLayout(JSON.stringify(stored));
    expect(JSON.stringify(parsed)).toContain('SoundObjectLibraryTopComponent');
    expect(JSON.stringify(parsed)).toContain('LibrariesTopComponent');
  });
});
