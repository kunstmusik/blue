import { describe, expect, it, vi } from 'vitest';
import { WorkbenchWindowManager } from './workbench-window-manager';

function createHandle(opts: { destroyed?: boolean; focusSpy?: () => void } = {}) {
  let destroyed = opts.destroyed ?? false;
  const focusSpy = opts.focusSpy ?? (() => undefined);
  return {
    focus: vi.fn(() => focusSpy()),
    isDestroyed: vi.fn(() => destroyed),
    __setDestroyed(value: boolean) {
      destroyed = value;
    },
  };
}

describe('WorkbenchWindowManager.register / updateOwnership', () => {
  it('registers a main window and assigns a stable windowId', () => {
    const manager = new WorkbenchWindowManager();
    const id = manager.register({ role: 'main' });
    expect(id).toMatch(/^wbw-\d+$/);
    expect(manager.getMainWindowId()).toBe(id);
    const entry = manager.getEntry(id)!;
    expect(entry.role).toBe('main');
    expect(entry.panelIds).toEqual([]);
  });

  it('registers floating windows with popout group and session metadata', () => {
    const manager = new WorkbenchWindowManager();
    manager.register({ role: 'main' });
    const floatId = manager.register({
      role: 'floating',
      popoutGroupId: 'popout-1',
      projectSessionId: 7,
    });
    const entry = manager.getEntry(floatId)!;
    expect(entry.role).toBe('floating');
    expect(entry.popoutGroupId).toBe('popout-1');
    expect(entry.projectSessionId).toBe(7);
    expect(manager.getByPopoutGroup('popout-1')).toBe(entry);
  });

  it('updates ownership without losing unrelated fields', () => {
    const manager = new WorkbenchWindowManager();
    const id = manager.register({
      role: 'floating',
      popoutGroupId: 'popout-1',
    });
    manager.updateOwnership({
      windowId: id,
      panelIds: ['MixerTopComponent', 'OutputTopComponent'],
      activePanelId: 'MixerTopComponent',
      projectSessionId: 9,
    });
    const entry = manager.getEntry(id)!;
    expect(entry.panelIds).toEqual(['MixerTopComponent', 'OutputTopComponent']);
    expect(entry.activePanelId).toBe('MixerTopComponent');
    expect(entry.projectSessionId).toBe(9);
    expect(entry.popoutGroupId).toBe('popout-1');
  });

  it('ignores ownership updates for unknown windows', () => {
    const manager = new WorkbenchWindowManager();
    manager.updateOwnership({ windowId: 'nope', panelIds: ['x'] });
    expect(manager.getAll()).toHaveLength(0);
  });
});

describe('WorkbenchWindowManager.resolveReveal', () => {
  it('focuses the live owner window and reports handled', () => {
    const manager = new WorkbenchWindowManager();
    manager.register({ role: 'main' });
    const handle = createHandle();
    const floatId = manager.register({
      role: 'floating',
      popoutGroupId: 'popout-1',
      handle,
    });
    manager.updateOwnership({
      windowId: floatId,
      panelIds: ['MixerTopComponent'],
      activePanelId: 'MixerTopComponent',
    });

    const result = manager.resolveReveal('MixerTopComponent');

    expect(result).toEqual({
      handled: true,
      focusedWindowId: floatId,
      openedInDefaultMode: false,
    });
    expect(handle.focus).toHaveBeenCalledTimes(1);
  });

  it('returns handled:false when no live owner exists so the caller routes to main', () => {
    const manager = new WorkbenchWindowManager();
    manager.register({ role: 'main' });
    expect(manager.resolveReveal('MixerTopComponent')).toEqual({ handled: false });
  });

  it('treats a destroyed owner as no owner', () => {
    const manager = new WorkbenchWindowManager();
    manager.register({ role: 'main' });
    const handle = createHandle({ destroyed: true });
    const floatId = manager.register({
      role: 'floating',
      popoutGroupId: 'popout-1',
      handle,
    });
    manager.updateOwnership({
      windowId: floatId,
      panelIds: ['MixerTopComponent'],
    });

    expect(manager.resolveReveal('MixerTopComponent')).toEqual({ handled: false });
    expect(handle.focus).not.toHaveBeenCalled();
  });
});

describe('WorkbenchWindowManager.requestClose', () => {
  it('allows the close when no policy is supplied', () => {
    const manager = new WorkbenchWindowManager();
    const id = manager.register({ role: 'floating' });
    expect(manager.requestClose({ windowId: id, panelIds: ['x'] })).toEqual({
      allowed: true,
    });
  });

  it('denies the close when policy blocks at least one panel', () => {
    const manager = new WorkbenchWindowManager();
    const id = manager.register({ role: 'floating' });
    manager.updateOwnership({
      windowId: id,
      panelIds: ['MixerTopComponent', 'OutputTopComponent'],
    });
    const policy = () => ({
      blockedPanelIds: ['OutputTopComponent'],
      requiresPrompt: false,
    });
    const result = manager.requestClose({
      windowId: id,
      panelIds: ['MixerTopComponent', 'OutputTopComponent'],
      policy,
    });
    expect(result.allowed).toBe(false);
    expect(result.blockedPanelIds).toEqual(['OutputTopComponent']);
  });

  it('cross-checks requested panelIds against the entry panelIds', () => {
    const manager = new WorkbenchWindowManager();
    const id = manager.register({ role: 'floating' });
    manager.updateOwnership({
      windowId: id,
      panelIds: ['MixerTopComponent'],
    });
    const policy = vi.fn(() => ({ blockedPanelIds: [], requiresPrompt: false }));
    // Request includes a panel not owned by this window; it should be filtered out.
    const result = manager.requestClose({
      windowId: id,
      panelIds: ['MixerTopComponent', 'OutputTopComponent'],
      policy,
    });
    expect(result.allowed).toBe(true);
    expect(policy).toHaveBeenCalledWith(['MixerTopComponent']);
  });

  it('allows the close but signals a prompt when required', () => {
    const manager = new WorkbenchWindowManager();
    const id = manager.register({ role: 'floating' });
    const policy = () => ({ blockedPanelIds: [], requiresPrompt: true });
    const result = manager.requestClose({
      windowId: id,
      panelIds: ['MixerTopComponent'],
      policy,
    });
    expect(result.allowed).toBe(true);
    expect(result.requiresPrompt).toBe(true);
  });
});

describe('WorkbenchWindowManager.dispose / pruneDestroyed', () => {
  it('removes an entry on dispose and clears the main window pointer', () => {
    const manager = new WorkbenchWindowManager();
    const mainId = manager.register({ role: 'main' });
    manager.dispose(mainId);
    expect(manager.getEntry(mainId)).toBeUndefined();
    expect(manager.getMainWindowId()).toBeUndefined();
  });

  it('prunes entries whose handle reports destroyed', () => {
    const manager = new WorkbenchWindowManager();
    manager.register({ role: 'main' });
    const handle = createHandle();
    const floatId = manager.register({
      role: 'floating',
      popoutGroupId: 'popout-1',
      handle,
    });
    handle.__setDestroyed(true);

    manager.pruneDestroyed();

    expect(manager.getEntry(floatId)).toBeUndefined();
    expect(manager.getByPopoutGroup('popout-1')).toBeUndefined();
  });
});
