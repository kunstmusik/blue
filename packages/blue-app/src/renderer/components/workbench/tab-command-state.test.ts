import { describe, expect, it } from 'vitest';
import {
  computeTabCommandState,
  type TabCommandContext,
} from './tab-command-state';

function baselineContext(
  overrides: Partial<TabCommandContext> = {},
): TabCommandContext {
  return {
    panelId: 'MixerTopComponent',
    groupId: 'group-1',
    groupPanelIds: ['ScoreObjectEditorTopComponent', 'MixerTopComponent', 'OutputTopComponent'],
    activePanelId: 'MixerTopComponent',
    location: 'docked',
    mode: 'editor',
    isAuxiliary: false,
    isClosable: true,
    isFloatable: true,
    isMaximized: false,
    ...overrides,
  };
}

function kinds(state: ReturnType<typeof computeTabCommandState>): string[] {
  return state.commands.map((c) => c.kind);
}

function enabledKind(state: ReturnType<typeof computeTabCommandState>, kind: string) {
  return state.commands.find((c) => c.kind === kind)?.enabled;
}

describe('computeTabCommandState — close family', () => {
  it('enables Close when the context panel is closable', () => {
    const state = computeTabCommandState(baselineContext());
    expect(state.canClose).toBe(true);
    expect(enabledKind(state, 'close')).toBe(true);
  });

  it('disables Close for a non-closable panel with a reason', () => {
    const state = computeTabCommandState(baselineContext({ isClosable: false }));
    expect(state.canClose).toBe(false);
    expect(enabledKind(state, 'close')).toBe(false);
    expect(state.commands.find((c) => c.kind === 'close')?.reasonDisabled).toBeTruthy();
  });

  it('enables Close Other only when a closable sibling exists', () => {
    expect(computeTabCommandState(baselineContext()).canCloseOther).toBe(true);

    const onlyClosableSelf = computeTabCommandState(
      baselineContext({
        siblingClosable: (id) => id === 'MixerTopComponent',
      }),
    );
    expect(onlyClosableSelf.canCloseOther).toBe(false);
  });

  it('disables Close Other for a single-tab group', () => {
    const state = computeTabCommandState(
      baselineContext({ groupPanelIds: ['MixerTopComponent'], panelId: 'MixerTopComponent' }),
    );
    expect(state.canCloseOther).toBe(false);
  });

  it('enables Close All when at least one panel in the group is closable', () => {
    expect(computeTabCommandState(baselineContext()).canCloseAll).toBe(true);

    const noneClosable = computeTabCommandState(
      baselineContext({
        isClosable: false,
        siblingClosable: () => false,
      }),
    );
    expect(noneClosable.canCloseAll).toBe(false);
  });
});

describe('computeTabCommandState — shift commands', () => {
  it('disables Shift Left for the first tab and Shift Right for the last tab', () => {
    const first = computeTabCommandState(
      baselineContext({ panelId: 'ScoreObjectEditorTopComponent' }),
    );
    expect(first.canShiftLeft).toBe(false);
    expect(first.canShiftRight).toBe(true);

    const last = computeTabCommandState(
      baselineContext({ panelId: 'OutputTopComponent' }),
    );
    expect(last.canShiftLeft).toBe(true);
    expect(last.canShiftRight).toBe(false);
  });

  it('enables both shifts for a middle tab', () => {
    const state = computeTabCommandState(baselineContext({ panelId: 'MixerTopComponent' }));
    expect(state.canShiftLeft).toBe(true);
    expect(state.canShiftRight).toBe(true);
  });

  it('disables both shifts for a single-tab group', () => {
    const state = computeTabCommandState(
      baselineContext({ groupPanelIds: ['SoloTopComponent'], panelId: 'SoloTopComponent' }),
    );
    expect(state.canShiftLeft).toBe(false);
    expect(state.canShiftRight).toBe(false);
  });
});

describe('computeTabCommandState — NetBeans float / dock visibility', () => {
  it('shows Float/Float Group enabled and Dock/Dock Group disabled for docked tabs', () => {
    const state = computeTabCommandState(baselineContext({ location: 'docked' }));
    expect(kinds(state)).toContain('float');
    expect(kinds(state)).toContain('float-group');
    expect(kinds(state)).toContain('dock');
    expect(kinds(state)).toContain('dock-group');
    expect(state.canFloat).toBe(true);
    expect(state.canFloatGroup).toBe(true);
    expect(state.canDock).toBe(false);
    expect(state.canDockGroup).toBe(false);
    expect(enabledKind(state, 'float')).toBe(true);
    expect(enabledKind(state, 'float-group')).toBe(true);
    expect(enabledKind(state, 'dock')).toBe(false);
    expect(enabledKind(state, 'dock-group')).toBe(false);
  });

  it('disables Float for a non-floatable panel', () => {
    const state = computeTabCommandState(baselineContext({ isFloatable: false }));
    expect(state.canFloat).toBe(false);
    expect(enabledKind(state, 'float')).toBe(false);
  });

  it('disables Float Group when any panel in the group cannot float', () => {
    const state = computeTabCommandState(
      baselineContext({ siblingFloatable: (id) => id !== 'OutputTopComponent' }),
    );
    expect(state.canFloat).toBe(true);
    expect(state.canFloatGroup).toBe(false);
    expect(enabledKind(state, 'float')).toBe(true);
    expect(enabledKind(state, 'float-group')).toBe(false);
  });

  it('shows Dock/Dock Group enabled and Float/Float Group disabled for floating tabs', () => {
    const state = computeTabCommandState(baselineContext({ location: 'floating' }));
    expect(kinds(state)).toContain('dock');
    expect(kinds(state)).toContain('dock-group');
    expect(kinds(state)).toContain('float');
    expect(kinds(state)).toContain('float-group');
    expect(state.canDock).toBe(true);
    expect(state.canDockGroup).toBe(true);
    expect(state.canFloat).toBe(false);
    expect(state.canFloatGroup).toBe(false);
    expect(enabledKind(state, 'dock')).toBe(true);
    expect(enabledKind(state, 'dock-group')).toBe(true);
    expect(enabledKind(state, 'float')).toBe(false);
    expect(enabledKind(state, 'float-group')).toBe(false);
  });

  it('offers Float for minimized and slide-out contexts (FR-014 auxiliary floatability)', () => {
    const minimized = computeTabCommandState(baselineContext({ location: 'minimized' }));
    expect(kinds(minimized)).toContain('float');
    expect(kinds(minimized)).toContain('dock');
    expect(enabledKind(minimized, 'float')).toBe(true);
    expect(enabledKind(minimized, 'dock')).toBe(false);

    const slideout = computeTabCommandState(baselineContext({ location: 'slideout' }));
    expect(kinds(slideout)).toContain('float');
    expect(kinds(slideout)).toContain('dock');
    expect(enabledKind(slideout, 'float')).toBe(true);
    expect(enabledKind(slideout, 'dock')).toBe(false);
  });
});

describe('computeTabCommandState — maximize / restore', () => {
  it('shows Maximize (not Restore) for a non-maximized docked group', () => {
    const state = computeTabCommandState(baselineContext({ location: 'docked', isMaximized: false }));
    expect(kinds(state)).toContain('maximize');
    expect(kinds(state)).not.toContain('restore');
    expect(state.canMaximize).toBe(true);
  });

  it('shows Restore (not Maximize) for a maximized group', () => {
    const state = computeTabCommandState(baselineContext({ isMaximized: true }));
    expect(kinds(state)).toContain('restore');
    expect(kinds(state)).not.toContain('maximize');
    expect(state.canRestore).toBe(true);
  });

  it('shows Restore for the maximized location', () => {
    const state = computeTabCommandState(baselineContext({ location: 'maximized', isMaximized: false }));
    expect(state.canRestore).toBe(true);
    expect(kinds(state)).toContain('restore');
  });
});

describe('computeTabCommandState — command ordering and identity', () => {
  it('records the context panel and group id', () => {
    const state = computeTabCommandState(baselineContext());
    expect(state.contextPanelId).toBe('MixerTopComponent');
    expect(state.contextGroupId).toBe('group-1');
  });

  it('emits close family first, then maximize/restore, then float/dock, then shifts and document actions', () => {
    const state = computeTabCommandState(baselineContext());
    const order = kinds(state);
    const closeIdx = order.indexOf('close');
    const floatIdx = order.indexOf('float');
    const shiftIdx = order.indexOf('shift-left');
    const cloneIdx = order.indexOf('clone');
    expect(closeIdx).toBeLessThanOrEqual(floatIdx);
    expect(floatIdx).toBeLessThanOrEqual(shiftIdx);
    expect(shiftIdx).toBeLessThanOrEqual(cloneIdx);
  });
});

describe('computeTabCommandState — document and view extras', () => {
  it('shows Clone and document tab-group commands for editor tabs', () => {
    const state = computeTabCommandState(
      baselineContext({ dockedEditorGroupCount: 2 }),
    );
    expect(kinds(state)).toContain('clone');
    expect(kinds(state)).toContain('new-document-tab-group');
    expect(kinds(state)).toContain('collapse-document-tab-group');
    expect(enabledKind(state, 'clone')).toBe(false);
    expect(enabledKind(state, 'new-document-tab-group')).toBe(true);
    expect(enabledKind(state, 'collapse-document-tab-group')).toBe(true);
  });

  it('disables document tab-group commands when there is no split target', () => {
    const state = computeTabCommandState(
      baselineContext({
        groupPanelIds: ['MixerTopComponent'],
        dockedEditorGroupCount: 1,
      }),
    );
    expect(enabledKind(state, 'new-document-tab-group')).toBe(false);
    expect(enabledKind(state, 'collapse-document-tab-group')).toBe(false);
  });

  it('uses the view-mode menu family for auxiliary panels', () => {
    const state = computeTabCommandState(
      baselineContext({
        mode: 'output',
        isAuxiliary: true,
      }),
    );
    expect(kinds(state)).toContain('close-group');
    expect(kinds(state)).toContain('minimize');
    expect(kinds(state)).toContain('minimize-group');
    expect(kinds(state)).toContain('move');
    expect(kinds(state)).toContain('move-group');
    expect(kinds(state)).toContain('size-group');
    expect(kinds(state)).not.toContain('new-document-tab-group');
    expect(enabledKind(state, 'minimize')).toBe(true);
    expect(enabledKind(state, 'minimize-group')).toBe(true);
  });
});
