import { describe, expect, it } from 'vitest';
import type { DockviewApi, DockviewGroupPanel } from 'dockview';
import {
  libraryEditorPanelId,
  libraryEditorSessionIdFromPanel,
} from '../stores/library-editor-store';
import {
  findLibraryEditorPanelsToClose,
  findLibraryEditorTargetGroup,
} from '../stores/workbench-store';

describe('library editor workbench routing', () => {
  it('uses stable dynamic panel IDs that survive Dockview serialization', () => {
    const id = libraryEditorPanelId('session:instrument/42');
    expect(id).toBe('library-item:session%3Ainstrument%2F42');
    expect(libraryEditorSessionIdFromPanel(id)).toBe('session:instrument/42');
    expect(libraryEditorSessionIdFromPanel('LibrariesTopComponent')).toBeNull();

    const serialized = JSON.stringify({ panels: { [id]: { id, title: 'Library Item' } } });
    expect(libraryEditorSessionIdFromPanel(JSON.parse(serialized).panels[id].id)).toBe(
      'session:instrument/42',
    );
  });

  it('routes Library Item editors to the central document group', () => {
    const centralGroup = {
      id: 'documents',
      api: { location: { type: 'grid' } },
      panels: [{ id: 'ScoreTopComponent' }],
    } as unknown as DockviewGroupPanel;
    const propertiesGroup = {
      id: 'properties',
      api: { location: { type: 'grid' } },
      panels: [{ id: 'LibrariesTopComponent' }, { id: libraryEditorPanelId('legacy-right-group') }],
    } as unknown as DockviewGroupPanel;

    expect(
      findLibraryEditorTargetGroup({
        groups: [propertiesGroup, centralGroup],
      } as Pick<DockviewApi, 'groups'>),
    ).toBe(centralGroup);
  });

  it('keeps only the requested Library Item tab and removes restored transient tabs', () => {
    const first = { id: libraryEditorPanelId('session-1') };
    const second = { id: libraryEditorPanelId('session-2') };
    const score = { id: 'ScoreTopComponent' };
    const api = { panels: [score, first, second] } as unknown as Pick<DockviewApi, 'panels'>;

    expect(findLibraryEditorPanelsToClose(api, second.id)).toEqual([first]);
    expect(findLibraryEditorPanelsToClose(api, null)).toEqual([first, second]);
  });
});
