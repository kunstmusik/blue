// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import type { LibraryEditorSessionSnapshot } from '../../shared/unified-library';
import { LibraryBreadcrumbs } from '../components/libraries/LibraryBreadcrumbs';
import { LibraryEditorToolbar } from '../components/libraries/LibraryEditorToolbar';
import { LibrarySessionDialog } from '../components/libraries/LibrarySessionDialog';
import { LibraryControlledEditor } from '../components/libraries/editor-registry';
import { validateLibraryNodeName } from '../components/libraries/LibraryTree';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const session: LibraryEditorSessionSnapshot = {
  sessionId: 'session-1',
  key: { scope: 'user', libraryType: 'instrument', nodeId: 'node-1' },
  displayName: 'Warm Pad',
  objectType: 'GenericInstrument',
  breadcrumb: ['Instruments', 'Pads', 'Warm Pad'],
  baseRevision: 2,
  draftXml: '<instrument><name>Warm Pad</name></instrument>',
  savedXml: '<instrument><name>Warm Pad</name></instrument>',
  dirty: true,
  pinned: true,
  status: 'ready',
};

describe('library editing UI', () => {
  it('validates names and renders accessible breadcrumbs', () => {
    expect(validateLibraryNodeName('')).toMatch(/required/i);
    expect(validateLibraryNodeName('  Pad  ')).toBeNull();
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(<LibraryBreadcrumbs parts={session.breadcrumb} />));
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Library location');
    expect(container.textContent).toContain('Pads');
    act(() => root.unmount());
  });

  it('keeps XML controlled and exposes dirty Save/Revert actions', () => {
    const onChange = vi.fn();
    const onSave = vi.fn();
    const onRevert = vi.fn();
    const onResolveConflict = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(<>
      <LibraryEditorToolbar session={session} onSave={onSave} onRevert={onRevert} onResolveConflict={onResolveConflict} />
      <LibraryControlledEditor session={session} onChange={onChange} />
    </>));
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe(session.draftXml);
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(
        textarea,
        '<instrument><name>Edited</name></instrument>',
      );
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith('<instrument><name>Edited</name></instrument>');
    const buttons = [...container.querySelectorAll('button')];
    act(() => buttons.find((button) => button.textContent === 'Save')?.click());
    act(() => buttons.find((button) => button.textContent === 'Revert')?.click());
    expect(onSave).toHaveBeenCalledOnce();
    expect(onRevert).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });

  it('offers reload, overwrite, and cancel as explicit conflict choices', () => {
    const onReload = vi.fn();
    const onOverwrite = vi.fn();
    const onCancel = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(
      <LibrarySessionDialog
        title="Library item changed"
        message="Choose a conflict resolution."
        primaryLabel="Reload latest"
        secondaryLabel="Overwrite latest"
        onPrimary={onReload}
        onSecondary={onOverwrite}
        onCancel={onCancel}
      />,
    ));
    for (const label of ['Reload latest', 'Overwrite latest', 'Cancel']) {
      act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === label)?.click());
    }
    expect(onReload).toHaveBeenCalledOnce();
    expect(onOverwrite).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });
});
