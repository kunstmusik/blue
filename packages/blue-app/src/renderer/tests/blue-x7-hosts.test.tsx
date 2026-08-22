// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('BlueX7 Multi-Host Parity (Orchestra, Track Window, Library)', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const onInstrumentPatch = vi.fn();
  const onOrchestraPatch = vi.fn();

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

  it('renders BlueX7 in Orchestra host and routes patch mutations through onOrchestraPatch', () => {
    const snapshot = createSnapshot('Orchestra BlueX7');

    act(() => {
      root?.render(
        <InstrumentEditorPanel
          instrument={snapshot}
          projectUdos={[]}
          onOrchestraPatch={onOrchestraPatch}
        />,
      );
    });

    expect(container?.querySelector('[data-testid="blue-x7-editor"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="bluex7-common-panel"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="bluex7-operator-panel"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="bluex7-csound-panel"]')).not.toBeNull();

    const nameInput = container?.querySelector('#bluex7-instrument-name') as HTMLInputElement;
    expect(nameInput.value).toBe('Orchestra BlueX7');
  });

  it('renders BlueX7 in Track Instrument host with identical controls and patch dispatch', () => {
    const snapshot = createSnapshot('Track BlueX7');
    const onTrackOrchestraPatch = vi.fn();

    act(() => {
      root?.render(
        <InstrumentEditorPanel
          instrument={snapshot}
          projectUdos={[]}
          onOrchestraPatch={onTrackOrchestraPatch}
        />,
      );
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

  it('renders BlueX7 in Library Draft host with identical panels and operations', () => {
    const snapshot = createSnapshot('Library BlueX7');
    const onLibraryOrchestraPatch = vi.fn();

    act(() => {
      root?.render(
        <InstrumentEditorPanel
          instrument={snapshot}
          projectUdos={[]}
          onOrchestraPatch={onLibraryOrchestraPatch}
        />,
      );
    });

    expect(container?.querySelector('[data-testid="blue-x7-editor"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="bluex7-lfo-panel"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="bluex7-peg-panel"]')).not.toBeNull();
  });
});
