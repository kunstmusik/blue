// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Effect } from '@blue/data';
import EffectEditorPage from '../components/effect-editor/EffectEditorPage';
import {
  createEffectEditorSnapshot,
  type EffectEditorPatchRequest,
  type EffectEditorSnapshot,
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
  default: ({
    instrument,
    onInstrumentPatch,
  }: {
    instrument: { name: string };
    onInstrumentPatch: (patch: { bsbInterface: { type: 'setEditEnabled'; value: boolean } }) => void;
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'bsb-interface-editor' },
      React.createElement('span', null, instrument.name),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: () => onInstrumentPatch({ bsbInterface: { type: 'setEditEnabled', value: false } }),
        },
        'Toggle edit mode',
      ),
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
  }) =>
    React.createElement(
      'div',
      {
        'data-selected-code-editor': true,
        'data-aria-label': ariaLabel,
        'data-udo-scope': `${javaBlueCompletionOptions?.contextUdos?.length ?? 0}:${javaBlueCompletionOptions?.projectUdos?.length ?? 0}`,
        'data-context-udo-names': javaBlueCompletionOptions?.contextUdos?.map((udo) => udo.name).join(',') ?? '',
        'data-project-udo-names': javaBlueCompletionOptions?.projectUdos?.map((udo) => udo.name).join(',') ?? '',
      },
      React.createElement(
        'label',
        null,
        React.createElement('span', null, ariaLabel),
        React.createElement('textarea', { 'aria-label': ariaLabel, value, readOnly: true }),
      ),
      React.createElement(
        'button',
        { type: 'button', onClick: () => onChange('aout = ain * 0.5') },
        'Apply code',
      ),
    ),
}));

vi.mock('../components/workbench/panels/udo/UdoWorkspacePanel', () => ({
  default: ({
    udos,
    projectUdos,
  }: {
    udos: UdoDefinitionSnapshot[];
    projectUdos?: readonly UdoDefinitionSnapshot[];
  }) => React.createElement('div', {
    'data-testid': 'udo-workspace-panel',
    'data-udo-scope': `${udos.length}:${projectUdos?.length ?? 0}`,
    'data-context-udo-names': udos.map((udo) => udo.name).join(','),
    'data-project-udo-names': projectUdos?.map((udo) => udo.name).join(',') ?? '',
  }),
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

function createLoadedSnapshot(code = 'aout = ain'): EffectEditorSnapshot {
  const effect = new Effect();
  effect.setName('Delay');
  effect.setComments('Original note');
  effect.setCode(code);
  effect.setEnabled(true);
  effect.setNumIns(1);
  effect.setNumOuts(1);

  return {
    ...createEffectEditorSnapshot(effect, 'fx-1', 'project', {
      projectRef: {
        channelId: 'channel-1',
        chain: 'pre',
        entryId: 'fx-1',
      },
    }),
    // A project effect snapshot carries the project-global UDO projection so
    // the editor (inline or separate window) can offer project UDO completion.
    projectUdos: [
      udoSnapshot('ProjectUDO'),
    ],
    udos: [udoSnapshot('EffectOwnerUDO')],
  };
}

function renderPage(): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(React.createElement(EffectEditorPage));
  });

  return { container, root };
}

async function flushFullEditorImport(): Promise<void> {
  await import('../components/effect-editor/EffectEditorPanel');
  await Promise.resolve();
}

beforeEach(() => {
  window.history.replaceState(
    {},
    '',
    '/effect-editor.html?ownerType=project&effectId=fx-1&channelId=channel-1&chain=pre&entryId=fx-1',
  );

  const snapshot = createLoadedSnapshot();
  let currentSnapshot = snapshot;

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
    onProjectDocumentUpdated: vi.fn(() => () => undefined),
  };
});

afterEach(() => {
  window.history.replaceState({}, '', '/');
  delete window.blueAPI;
});

describe('project effect editor contract', () => {
  it('round-trips code edits for a project-owned effect through the projectRef bridge', async () => {
    const { container, root } = renderPage();

    await act(async () => {
      await flushFullEditorImport();
    });

    expect(window.blueAPI.openEffectEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerType: 'project',
        effectId: 'fx-1',
        projectRef: {
          channelId: 'channel-1',
          chain: 'pre',
          entryId: 'fx-1',
        },
      }),
    );
    expect(window.blueAPI.getEffectEditorDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerType: 'project',
        effectId: 'fx-1',
        projectRef: {
          channelId: 'channel-1',
          chain: 'pre',
          entryId: 'fx-1',
        },
      }),
    );
    expect(document.title).toBe('Delay - Effect Editor');

    const codeTab = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Code',
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      codeTab?.click();
      await Promise.resolve();
    });

    // The project effect Code editor receives the effect's owner UDOs plus the
    // projected project-global UDOs (US2).
    const codeEditor = container.querySelector(
      '[data-selected-code-editor][data-aria-label="Effect code editor"]',
    );
    expect(codeEditor?.getAttribute('data-udo-scope')).toBe('1:1');
    expect(codeEditor?.getAttribute('data-context-udo-names')).toBe('EffectOwnerUDO');
    expect(codeEditor?.getAttribute('data-project-udo-names')).toBe('ProjectUDO');

    const applyButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Apply code',
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      applyButton?.click();
      await Promise.resolve();
    });

    expect(window.blueAPI.updateEffectEditorDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerType: 'project',
        effectId: 'fx-1',
        projectRef: {
          channelId: 'channel-1',
          chain: 'pre',
          entryId: 'fx-1',
        },
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
    expect(workspace?.getAttribute('data-udo-scope')).toBe('1:1');
    expect(workspace?.getAttribute('data-context-udo-names')).toBe('EffectOwnerUDO');
    expect(workspace?.getAttribute('data-project-udo-names')).toBe('ProjectUDO');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('round-trips interface edits for a project-owned effect through the same bridge', async () => {
    const { container, root } = renderPage();

    await act(async () => {
      await flushFullEditorImport();
    });

    const toggleButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Toggle edit mode',
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      toggleButton?.click();
      await Promise.resolve();
    });

    expect(window.blueAPI.updateEffectEditorDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerType: 'project',
        effectId: 'fx-1',
        projectRef: {
          channelId: 'channel-1',
          chain: 'pre',
          entryId: 'fx-1',
        },
        patch: expect.objectContaining({
          bsbInterface: {
            type: 'setEditEnabled',
            value: false,
          },
        }),
      }),
    );

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
