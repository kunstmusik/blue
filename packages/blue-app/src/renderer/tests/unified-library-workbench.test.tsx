import { describe, expect, it } from 'vitest';
import { PANEL_MAP, getDefaultEditorPanels } from '../components/workbench/panel-registry';
import {
  createStoredWorkbenchLayout,
  createDefaultAuxiliaryLayoutState,
  parseStoredWorkbenchLayout,
} from '../components/workbench/auxiliary-layout';

describe('Unified Libraries workbench integration', () => {
  it('registers an always-available Libraries panel and a Welcome editor', () => {
    expect(PANEL_MAP.get('LibrariesTopComponent')).toMatchObject({
      title: 'Libraries',
      auxiliaryGroupId: 'properties-main',
    });
    expect(getDefaultEditorPanels().map((panel) => panel.id)).toContain('WelcomeTopComponent');
  });

  it('migrates every legacy SoundObject library layout ID', () => {
    const stored = createStoredWorkbenchLayout({
      grid: { root: { type: 'branch' }, height: 900, width: 1400, orientation: 'horizontal' },
      panels: {
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
    const legacy = JSON.stringify(stored).replaceAll('LibrariesTopComponent', 'SoundObjectLibraryTopComponent');
    const parsed = parseStoredWorkbenchLayout(legacy);
    expect(JSON.stringify(parsed)).not.toContain('SoundObjectLibraryTopComponent');
    expect(JSON.stringify(parsed)).toContain('LibrariesTopComponent');
  });
});
