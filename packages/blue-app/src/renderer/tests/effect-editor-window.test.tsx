// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Effect } from '@blue/data';
import EffectEditorPage from '../components/effect-editor/EffectEditorPage';
import {
  createEffectEditorSnapshot,
  type EffectEditorSnapshot,
  type EffectEditorPatchRequest,
  type UdoDefinitionSnapshot,
} from '../../shared/project-editor';
import type { ProjectDocumentUpdatedEvent } from '../../shared/workbench-window-contract';

declare global {
  interface Window {
    blueAPI: {
      getEffectEditorDocument: (request: unknown) => Promise<EffectEditorSnapshot | null>;
      updateEffectEditorDocument: (request: EffectEditorPatchRequest) => Promise<EffectEditorSnapshot | null>;
      openEffectEditor: (request: unknown) => Promise<unknown> | unknown;
      onProjectDocumentUpdated: (
        callback: (event: ProjectDocumentUpdatedEvent) => void,
      ) => () => void;
    };
  }
}

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../components/workbench/panels/orchestra/bsb/BSBInterfaceEditor', () => ({
  default: ({ instrument }: { instrument: { name: string } }) => (
    <div data-testid="bsb-interface-editor">{instrument.name}</div>
  ),
}));

vi.mock('../components/workbench/panels/editors/SelectedCodeEditor', () => ({
  default: ({
    value,
    onChange,
    ariaLabel,
    javaBlueCompletionOptions,
  }: {
    value: string;
    onChange: (value: string) => void;
    ariaLabel: string;
    javaBlueCompletionOptions?: {
      contextUdos?: Array<{ name: string }>;
      projectUdos?: Array<{ name: string }>;
    };
  }) => (
    <div
      data-selected-code-editor
      data-aria-label={ariaLabel}
      data-udo-scope={`${javaBlueCompletionOptions?.contextUdos?.length ?? 0}:${javaBlueCompletionOptions?.projectUdos?.length ?? 0}`}
      data-context-udo-names={javaBlueCompletionOptions?.contextUdos?.map((udo) => udo.name).join(',') ?? ''}
      data-project-udo-names={javaBlueCompletionOptions?.projectUdos?.map((udo) => udo.name).join(',') ?? ''}
    >
      <label>
        <span>{ariaLabel}</span>
        <textarea aria-label={ariaLabel} value={value} readOnly />
      </label>
      <button type="button" onClick={() => onChange('aout = ain * 0.5')}>
        Apply code
      </button>
    </div>
  ),
}));

vi.mock('../components/workbench/panels/udo/UdoWorkspacePanel', () => ({
  default: ({
    udos,
    projectUdos,
  }: {
    udos: UdoDefinitionSnapshot[];
    projectUdos?: readonly UdoDefinitionSnapshot[];
  }) => (
    <div
      data-testid="udo-workspace-panel"
      data-udo-scope={`${udos.length}:${projectUdos?.length ?? 0}`}
      data-context-udo-names={udos.map((udo) => udo.name).join(',')}
      data-project-udo-names={projectUdos?.map((udo) => udo.name).join(',') ?? ''}
    />
  ),
}));

vi.mock('../hooks/use-udo-callbacks', () => ({
  useUdoCallbacks: () => ({}),
}));

function udoSnapshot(name: string): UdoDefinitionSnapshot {
  return {
    name,
    style: 'CLASSIC',
    outTypes: 'a',
    inTypes: 'a',
    inputArguments: '',
    code: '',
    comments: '',
  };
}

let projectDocumentUpdatedListener:
  | ((event: ProjectDocumentUpdatedEvent) => void)
  | null = null;

function createLoadedSnapshot(code = 'aout = ain'): EffectEditorSnapshot {
  const effect = new Effect();
  effect.setName('Delay');
  effect.setComments('Original note');
  effect.setCode(code);
  effect.setEnabled(true);
  effect.setNumIns(1);
  effect.setNumOuts(1);

  return {
    ...createEffectEditorSnapshot(effect, 'fx-1', 'library', {
      libraryRef: { libraryEffectId: 'fx-1' },
    }),
    udos: [udoSnapshot('LibraryEffectUDO')],
  };
}

function renderPage(): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<EffectEditorPage />);
  });

  return { container, root };
}

beforeEach(() => {
  projectDocumentUpdatedListener = null;
  const snapshot = createLoadedSnapshot();
  let currentSnapshot = snapshot;

  window.history.replaceState({}, '', '/effect-editor.html?ownerType=library&effectId=fx-1&libraryEffectId=fx-1');
  window.blueAPI = {
    getEffectEditorDocument: vi.fn().mockImplementation(async () => currentSnapshot),
    updateEffectEditorDocument: vi.fn().mockImplementation(async (request: EffectEditorPatchRequest) => {
      currentSnapshot = {
        ...currentSnapshot,
        ...request.patch,
      } as EffectEditorSnapshot;
      return currentSnapshot;
    }),
    openEffectEditor: vi.fn().mockResolvedValue(undefined),
    onProjectDocumentUpdated: vi.fn((callback) => {
      projectDocumentUpdatedListener = callback;
      return () => {
        if (projectDocumentUpdatedListener === callback) {
          projectDocumentUpdatedListener = null;
        }
      };
    }),
  };
});

afterEach(() => {
  window.history.replaceState({}, '', '/');
  delete window.blueAPI;
});

describe('EffectEditorPage', () => {
  it('loads the effect editor shell and shows the loaded snapshot', async () => {
    const { container, root } = renderPage();

    await act(async () => {
      await Promise.resolve();
    });

    expect(window.blueAPI.openEffectEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerType: 'library',
        effectId: 'fx-1',
        libraryRef: { libraryEffectId: 'fx-1' },
      }),
    );
    expect(document.title).toBe('Delay - Effect Editor');
    expect(container.textContent).toContain('Interface');
    expect(container.textContent).toContain('Code');
    expect(container.textContent).toContain('UDO');
    expect(container.textContent).toContain('Comments');
    expect(container.querySelector('[data-testid="bsb-interface-editor"]')).toBeTruthy();
    const effectNameInput = container.querySelector(
      'input[aria-label="Effect name"]',
    ) as HTMLInputElement | null;
    expect(effectNameInput?.value).toBe('Delay');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('shows a close action when the effect editor document cannot be loaded', async () => {
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => undefined);
    window.blueAPI.getEffectEditorDocument = vi.fn().mockResolvedValue(null);

    const { container, root } = renderPage();

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Unable to load effect editor document');

    await act(async () => {
      const button = Array.from(container.querySelectorAll('button')).find(
        (candidate) => candidate.textContent === 'Close Window',
      ) as HTMLButtonElement | undefined;
      button?.click();
      await Promise.resolve();
    });

    expect(closeSpy).toHaveBeenCalledOnce();

    closeSpy.mockRestore();
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('routes code edits back through the effect editor bridge', async () => {
    const { container, root } = renderPage();

    await act(async () => {
      await Promise.resolve();
    });

    const codeTab = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Code',
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      codeTab?.click();
      await Promise.resolve();
    });

    const codeEditor = container.querySelector('textarea[aria-label="Effect code editor"]') as HTMLTextAreaElement | null;
    expect(codeEditor).toBeTruthy();
    const codeScope = container.querySelector(
      '[data-selected-code-editor][data-aria-label="Effect code editor"]',
    );
    expect(codeScope?.getAttribute('data-udo-scope')).toBe('1:0');
    expect(codeScope?.getAttribute('data-context-udo-names')).toBe('LibraryEffectUDO');
    expect(window.blueAPI.onProjectDocumentUpdated).not.toHaveBeenCalled();

    await act(async () => {
      const applyButton = Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Apply code',
      ) as HTMLButtonElement | undefined;
      applyButton?.click();
      await Promise.resolve();
    });

    expect(window.blueAPI.updateEffectEditorDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerType: 'library',
        effectId: 'fx-1',
        patch: expect.objectContaining({
          code: 'aout = ain * 0.5',
        }),
      }),
    );

    const udoTab = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'UDO',
    ) as HTMLButtonElement | undefined;
    await act(async () => {
      udoTab?.click();
      await Promise.resolve();
    });
    const workspace = container.querySelector('[data-testid="udo-workspace-panel"]');
    expect(workspace?.getAttribute('data-udo-scope')).toBe('1:0');
    expect(workspace?.getAttribute('data-context-udo-names')).toBe('LibraryEffectUDO');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('keeps project effect Code and embedded-UDO scopes live through project document updates (US2, US4)', async () => {
    const effect = new Effect();
    effect.setName('ProjectDelay');
    effect.setCode('aout = ain');
    effect.setEnabled(true);
    effect.setNumIns(1);
    effect.setNumOuts(1);
    const projectUdo = {
      name: 'ProjectUDO',
      style: 'CLASSIC' as const,
      outTypes: 'a',
      inTypes: 'a',
      inputArguments: '',
      code: '',
      comments: '',
    };
    const snapshot: EffectEditorSnapshot = {
      ...createEffectEditorSnapshot(effect, 'fx-2', 'project', {
        projectRef: { channelId: 'ch-1', chain: 'pre', entryId: 'fx-2' },
      }),
      // The separate project effect window receives the project UDO projection
      // through the snapshot because it has no project-store access.
      projectUdos: [projectUdo],
      udos: [udoSnapshot('EffectOwnerUDO')],
    };

    window.history.replaceState(
      {},
      '',
      '/effect-editor.html?ownerType=project&effectId=fx-2&channelId=ch-1&chain=pre&entryId=fx-2',
    );
    window.blueAPI.getEffectEditorDocument = vi.fn().mockResolvedValue(snapshot);

    const { container, root } = renderPage();
    await act(async () => {
      await Promise.resolve();
    });

    const codeTab = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Code',
    ) as HTMLButtonElement | undefined;
    await act(async () => {
      codeTab?.click();
      await Promise.resolve();
    });

    const codeEditor = container.querySelector('[data-selected-code-editor][data-aria-label="Effect code editor"]');
    expect(codeEditor?.getAttribute('data-udo-scope')).toBe('1:1');
    expect(codeEditor?.getAttribute('data-context-udo-names')).toBe('EffectOwnerUDO');
    expect(codeEditor?.getAttribute('data-project-udo-names')).toBe('ProjectUDO');
    expect(window.blueAPI.onProjectDocumentUpdated).toHaveBeenCalledOnce();

    await act(async () => {
      projectDocumentUpdatedListener?.({
        sessionId: 1,
        revision: 2,
        snapshot: {
          projectUdos: [udoSnapshot('RenamedProjectUDO')],
        },
      } as ProjectDocumentUpdatedEvent);
      await Promise.resolve();
    });

    const refreshedCodeEditor = container.querySelector(
      '[data-selected-code-editor][data-aria-label="Effect code editor"]',
    );
    expect(refreshedCodeEditor?.getAttribute('data-project-udo-names')).toBe(
      'RenamedProjectUDO',
    );

    const udoTab = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'UDO',
    ) as HTMLButtonElement | undefined;
    await act(async () => {
      udoTab?.click();
      await Promise.resolve();
    });
    const workspace = container.querySelector('[data-testid="udo-workspace-panel"]');
    expect(workspace?.getAttribute('data-udo-scope')).toBe('1:1');
    expect(workspace?.getAttribute('data-context-udo-names')).toBe('EffectOwnerUDO');
    expect(workspace?.getAttribute('data-project-udo-names')).toBe('RenamedProjectUDO');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('uses semantic typography roles for tab buttons and controls', async () => {
    const { container, root } = renderPage();
    await act(async () => {
      await Promise.resolve();
    });

    const buttons = Array.from(container.querySelectorAll('nav button, header button, div.flex > button'));
    expect(buttons.length).toBeGreaterThan(0);
    for (const btn of buttons) {
      expect(btn.className).toContain('text-role-body');
    }

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
