// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultBlueX7Voice } from '@blue/data';
import type { BlueX7InstrumentSnapshot, InstrumentPatch } from '../../shared/project-editor';
import InstrumentEditorPanel from '../components/workbench/panels/orchestra/InstrumentEditorPanel';

vi.mock('../components/workbench/panels/editors/SelectedCodeEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange?: (text: string) => void }) => (
    <textarea
      aria-label="Csound Post Code"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function setInputValue(input: HTMLInputElement, value: string): void {
  const tracker = (input as HTMLInputElement & { _valueTracker?: { setValue: (next: string) => void } })
    ._valueTracker;
  tracker?.setValue('');
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('BlueX7 Multi-Host Parity (Orchestra, Track Window, Library)', () => {
  beforeAll(async () => {
    await import('../components/instruments/blue-x7-editor');
  });

  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const onInstrumentPatch = vi.fn();
  const onOrchestraPatch = vi.fn();

  /** Editors load through React.lazy; flush until the Suspense fallback is gone. */
  async function flushLazyEditor(): Promise<void> {
    for (
      let attempt = 0;
      attempt < 50 && container?.querySelector('[data-instrument-editor-loading]');
      attempt += 1
    ) {
      await new Promise((resolve) => { setTimeout(resolve, 0); });
    }
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onInstrumentPatch.mockClear();
    onOrchestraPatch.mockClear();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    root = null;
  });

  const createSnapshot = (name = 'Test BlueX7'): BlueX7InstrumentSnapshot => ({
    id: 'instr-x7-1',
    assignmentId: '1',
    type: 'blueX7',
    name,
    comment: 'Host parity test',
    enabled: true,
    voice: createDefaultBlueX7Voice(),
  });

  it('renders BlueX7 in Orchestra host and routes patch mutations through onOrchestraPatch', async () => {
    const snapshot = createSnapshot('Orchestra BlueX7');

    await act(async () => {
      root?.render(
        <InstrumentEditorPanel
          instrument={snapshot}
          projectUdos={[]}
          onOrchestraPatch={onOrchestraPatch}
        />,
      );
      await flushLazyEditor();
    });

    expect(container?.querySelector('[data-testid="blue-x7-editor"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="bluex7-common-panel"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="bluex7-operator-panel"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="bluex7-csound-panel"]')).not.toBeNull();

    const nameInput = container?.querySelector('#bluex7-instrument-name') as HTMLInputElement;
    expect(nameInput.value).toBe('Orchestra BlueX7');
  });

  it('renders BlueX7 in Track Instrument host with identical controls and patch dispatch', async () => {
    const snapshot = createSnapshot('Track BlueX7');
    const onTrackOrchestraPatch = vi.fn();

    await act(async () => {
      root?.render(
        <InstrumentEditorPanel
          instrument={snapshot}
          projectUdos={[]}
          onOrchestraPatch={onTrackOrchestraPatch}
        />,
      );
      await flushLazyEditor();
    });

    expect(container?.querySelector('[data-testid="blue-x7-editor"]')).not.toBeNull();
    const nameInput = container?.querySelector('#bluex7-instrument-name') as HTMLInputElement;
    expect(nameInput.value).toBe('Track BlueX7');

    // Toggle enabled checkbox
    const enabledToggle = container?.querySelector('#bluex7-instrument-enabled') as HTMLInputElement;
    act(() => {
      enabledToggle.click();
    });

    expect(onTrackOrchestraPatch).toHaveBeenCalledWith({
      type: 'updateInstrument',
      assignmentId: '1',
      patch: {
        enabled: false,
      },
    });
  });

  it('renders BlueX7 in Library Draft host with identical panels and operations', async () => {
    const snapshot = createSnapshot('Library BlueX7');
    const onLibraryOrchestraPatch = vi.fn();

    await act(async () => {
      root?.render(
        <InstrumentEditorPanel
          instrument={snapshot}
          projectUdos={[]}
          onOrchestraPatch={onLibraryOrchestraPatch}
        />,
      );
      await flushLazyEditor();
    });

    expect(container?.querySelector('[data-testid="blue-x7-editor"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="bluex7-lfo-panel"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="bluex7-peg-panel"]')).not.toBeNull();
  });

  it('keeps two duplicate-name editors ordered, visible, and undo-isolated during rapid edits', async () => {
    const first = createSnapshot('Duplicate BlueX7');
    first.assignmentId = 'owner-a';
    first.voice.common.feedback = 1;
    const second = createSnapshot('Duplicate BlueX7');
    second.assignmentId = 'owner-b';
    second.voice.common.feedback = 6;
    const patches: Array<{ owner: string; patch: InstrumentPatch }> = [];

    await act(async () => {
      root?.render(
        <>
          <section data-owner="owner-a">
            <InstrumentEditorPanel
              instrument={first}
              projectUdos={[]}
              onOrchestraPatch={(patch) => patches.push({ owner: 'owner-a', patch: patch.patch! })}
            />
          </section>
          <section data-owner="owner-b">
            <InstrumentEditorPanel
              instrument={second}
              projectUdos={[]}
              onOrchestraPatch={(patch) => patches.push({ owner: 'owner-b', patch: patch.patch! })}
            />
          </section>
        </>,
      );
      await flushLazyEditor();
    });

    const editorA = container!.querySelector('[data-owner="owner-a"]')!;
    const editorB = container!.querySelector('[data-owner="owner-b"]')!;
    expect((editorA.querySelector('[aria-label="Feedback"]') as HTMLInputElement).value).toBe('1');
    expect((editorB.querySelector('[aria-label="Feedback"]') as HTMLInputElement).value).toBe('6');
    expect(container!.querySelectorAll('input[value="Duplicate BlueX7"]')).toHaveLength(2);

    act(() => {
      for (let index = 0; index < 20; index += 1) {
        setInputValue(editorA.querySelector('[aria-label="Feedback"]') as HTMLInputElement, String(index % 8));
        setInputValue(editorB.querySelector('[aria-label="Feedback"]') as HTMLInputElement, String(7 - (index % 8)));
      }
    });
    expect(patches).toHaveLength(40);
    expect(patches.map((entry) => entry.owner)).toEqual(
      Array.from({ length: 20 }, () => ['owner-a', 'owner-b']).flat(),
    );

    act(() => {
      (editorA.querySelector('button[aria-label="Undo BlueX7 edit"]') as HTMLButtonElement).click();
    });
    expect(patches.at(-1)).toMatchObject({
      owner: 'owner-a',
      patch: { blueX7: { type: 'replaceVoice' } },
    });
    expect((editorB.querySelector('button[aria-label="Undo BlueX7 edit"]') as HTMLButtonElement).disabled)
      .toBe(false);
  });

  it('keeps ARIA tab and panel IDs unique for two mounts of the same assignment', async () => {
    const first = createSnapshot('Shared Assignment A');
    const second = createSnapshot('Shared Assignment B');

    await act(async () => {
      root?.render(
        <>
          <section data-testid="shared-editor-a">
            <InstrumentEditorPanel
              instrument={first}
              projectUdos={[]}
              onOrchestraPatch={onOrchestraPatch}
            />
          </section>
          <section data-testid="shared-editor-b">
            <InstrumentEditorPanel
              instrument={second}
              projectUdos={[]}
              onOrchestraPatch={onOrchestraPatch}
            />
          </section>
        </>,
      );
      await flushLazyEditor();
    });

    const topLevelTablist = container!.querySelector('[role="tablist"][aria-label="Instrument Sections"]')!;
    const tabs = [...topLevelTablist.querySelectorAll<HTMLElement>('[role="tab"]')];
    const panels = [...container!.querySelectorAll<HTMLElement>(
      '[data-testid="bluex7-panel-global"], [data-testid="bluex7-panel-operators"], [data-testid="bluex7-panel-pitch"], [data-testid="bluex7-panel-csound"]',
    )];
    const tabIds = tabs.map((tab) => tab.id);
    const panelIds = panels.map((panel) => panel.id);

    expect(new Set(tabIds).size).toBe(tabIds.length);
    expect(new Set(panelIds).size).toBe(panelIds.length);
    for (const tab of tabs) {
      expect(document.getElementById(tab.getAttribute('aria-controls') ?? '')).not.toBeNull();
    }
    for (const panel of panels) {
      expect(document.getElementById(panel.getAttribute('aria-labelledby') ?? '')).not.toBeNull();
    }
  });

  it('routes arrangement and track runtime snapshots to active controls without patches', async () => {
    const arrangement = createSnapshot('Runtime Arrangement BlueX7');
    arrangement.parameters = [{
      parameterId: 'arrangement-feedback',
      semanticKey: 'common.feedback',
      fixedValue: 0,
      automationEnabled: true,
    }];
    const track = createSnapshot('Runtime Track BlueX7');
    track.parameters = [{
      parameterId: 'track-feedback',
      semanticKey: 'common.feedback',
      fixedValue: 0,
      automationEnabled: true,
    }];
    track.assignmentId = 'track-assignment';

    const getBlueX7EffectiveValues = vi.fn().mockImplementation(async (request: {
      target: {
        assignmentId?: string;
        track?: { rootGroupId: string; trackId: string };
      };
      projectSessionId: number;
      parameterIds: string[];
    }) => ({
      ok: true as const,
      projectSessionId: request.projectSessionId,
      ownerIdentity: request.target.assignmentId
        ? `arrangement:${request.target.assignmentId}`
        : `track:${request.target.track!.rootGroupId}:${request.target.track!.trackId}`,
      engineSequence: 1,
      values: [{ parameterId: request.parameterIds[0]!, value: request.target.assignmentId ? 6 : 7 }],
    }));
    (window as unknown as { blueAPI: unknown }).blueAPI = { getBlueX7EffectiveValues };

    await act(async () => {
      root?.render(
        <>
          <section data-testid="runtime-arrangement-host">
            <InstrumentEditorPanel
              instrument={arrangement}
              projectUdos={[]}
              onOrchestraPatch={onOrchestraPatch}
              blueX7Runtime={{
                target: { assignmentId: '1' },
                projectSessionId: 11,
                enabled: true,
              }}
            />
          </section>
          <section data-testid="runtime-track-host">
            <InstrumentEditorPanel
              instrument={track}
              projectUdos={[]}
              onOrchestraPatch={onOrchestraPatch}
              blueX7Runtime={{
                target: {
                  track: {
                    projectSessionId: 22,
                    rootGroupId: 'group-1',
                    trackId: 'track-1',
                  },
                },
                projectSessionId: 22,
                enabled: true,
              }}
            />
          </section>
        </>,
      );
      await flushLazyEditor();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getBlueX7EffectiveValues.mock.calls.map(([request]) => request)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: { assignmentId: '1' },
          projectSessionId: 11,
          parameterIds: ['arrangement-feedback'],
        }),
        expect.objectContaining({
          target: {
            track: {
              projectSessionId: 22,
              rootGroupId: 'group-1',
              trackId: 'track-1',
            },
          },
          projectSessionId: 22,
          parameterIds: ['track-feedback'],
        }),
      ]),
    );
    expect((container!.querySelector('[data-testid="runtime-arrangement-host"] [aria-label="Feedback"]') as HTMLInputElement).value)
      .toBe('6');
    expect((container!.querySelector('[data-testid="runtime-track-host"] [aria-label="Feedback"]') as HTMLInputElement).value)
      .toBe('7');
    expect(onOrchestraPatch).not.toHaveBeenCalled();
  });
});
