import { describe, expect, it } from 'vitest';
import {
  libraryEditorPanelId,
  libraryEditorSessionIdFromPanel,
} from '../stores/library-editor-store';

describe('library editor workbench routing', () => {
  it('uses stable dynamic panel IDs that survive Dockview serialization', () => {
    const id = libraryEditorPanelId('session:instrument/42');
    expect(id).toBe('library-item:session%3Ainstrument%2F42');
    expect(libraryEditorSessionIdFromPanel(id)).toBe('session:instrument/42');
    expect(libraryEditorSessionIdFromPanel('LibrariesTopComponent')).toBeNull();

    const serialized = JSON.stringify({ panels: { [id]: { id, title: 'Warm Pad' } } });
    expect(libraryEditorSessionIdFromPanel(JSON.parse(serialized).panels[id].id))
      .toBe('session:instrument/42');
  });
});
