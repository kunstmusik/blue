// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScoreTimeCanvas from '../components/workbench/panels/score/layer-groups/ScoreTimeCanvas';
import { BLUE_LIBRARY_DRAG_MIME } from '../components/libraries/library-drag-drop';
import { useLibraryStore } from '../stores/library-store';
import type { PolyObjectLayerGroupSnapshot } from '../../shared/project-editor';
import { createTestDataTransfer, dispatchDragEvent, setElementRect } from './library-interaction-test-helpers';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const group: PolyObjectLayerGroupSnapshot = {
  groupId: 'nested-group',
  groupType: 'polyObject',
  name: 'Nested',
  layerCount: 1,
  isOpenableContainer: true,
  layers: [{ layerId: 'nested-group-layer-0', name: 'Layer 1', height: 44, muted: false, solo: false, items: [] }],
};

const previewLibraryTransfer = vi.fn(async (request) => ({
  ok: true as const,
  value: {
    previewToken: 'score-preview',
    item: {
      key: { scope: 'user' as const, libraryType: 'soundObject' as const, nodeId: 'sound-1' },
      displayName: 'Phrase', libraryType: 'soundObject' as const, scope: 'user' as const,
      objectType: 'GenericScore', supportStatus: 'supported' as const, supportMessage: null,
      fields: {}, dependencies: { itemOwned: [], unresolvedExternal: [] },
    },
    target: request.target, requestedMode: 'independent' as const,
    allowedModes: ['independent'] as const, canApply: true, blockingReasons: [],
  },
}));
const applyLibraryTransfer = vi.fn(async () => ({
  ok: true as const,
  value: { projectSessionId: 8, projectRevision: 22, libraryType: 'soundObject' as const, insertedIdentity: 'score-1', message: 'SoundObject added.' },
}));

let root: Root;
let container: HTMLDivElement;
let surface: HTMLElement;

beforeEach(() => {
  previewLibraryTransfer.mockClear();
  applyLibraryTransfer.mockClear();
  window.blueAPI = { ...window.blueAPI, previewLibraryTransfer, applyLibraryTransfer };
  useLibraryStore.setState({ clipboard: null, transferPreview: null, transferSource: null, error: null });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <ScoreTimeCanvas
        group={group}
        projectSessionId={8}
        projectRevision={21}
        scoreRootGroupId="root-stable"
        scoreContainerPath={[{ layerId: 'root-layer-2', objectIdentity: 'container-7' }]}
        totalBeats={16}
        pixelsPerBeat={50}
        snapEnabled
        snapValue="BEAT"
        tempo={120}
        smpteFrameRate={30}
        meterMap={{ entries: [{ measure: 0, numBeats: 4, beatLength: 4, startBeat: 0 }] }}
      />,
    );
  });
  surface = container.querySelector('[data-group-id="nested-group"]') as HTMLElement;
  setElementRect(surface, { left: 0, top: 0, width: 800, height: 44 });
});

afterEach(() => {
  act(() => { root.unmount(); });
  document.body.replaceChildren();
});

describe('Score Library drop targets', () => {
  it('converts pointer geometry to an exact stable path/layer/snapped time', async () => {
    const transfer = createTestDataTransfer();
    transfer.setData(BLUE_LIBRARY_DRAG_MIME, JSON.stringify({ dragSessionId: 'drag-score', libraryType: 'soundObject' }));
    dispatchDragEvent(surface, 'dragover', transfer, { clientX: 230, clientY: 10 });
    expect(container.querySelector('[class*="bg-app-accent/10"]')).toBeTruthy();
    dispatchDragEvent(surface, 'drop', transfer, { clientX: 230, clientY: 10 });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(previewLibraryTransfer).toHaveBeenCalledWith(expect.objectContaining({
      source: { kind: 'drag', dragSessionId: 'drag-score' },
      target: {
        kind: 'score', projectSessionId: 8, projectRevision: 21,
        location: {
          rootGroupId: 'root-stable',
          containerPath: [{ layerId: 'root-layer-2', objectIdentity: 'container-7' }],
          layerId: 'nested-group-layer-0',
          startTime: 4,
        },
        timeContextRevision: '21',
      },
    }));
    expect(applyLibraryTransfer).toHaveBeenCalledWith('score-preview');
  });

  it('accepts protected drag hover when custom descriptor data is readable only at drop', async () => {
    const transfer = createTestDataTransfer();
    transfer.setData(BLUE_LIBRARY_DRAG_MIME, JSON.stringify({ dragSessionId: 'drag-protected', libraryType: 'soundObject' }));
    const readableGetData = transfer.getData.bind(transfer);
    transfer.getData = vi.fn(() => '');

    dispatchDragEvent(surface, 'dragover', transfer, { clientX: 130, clientY: 10 });
    expect(transfer.dropEffect).toBe('copy');
    expect(container.querySelector('[class*="bg-app-accent/10"]')).toBeTruthy();

    transfer.getData = readableGetData;
    dispatchDragEvent(surface, 'drop', transfer, { clientX: 130, clientY: 10 });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(previewLibraryTransfer).toHaveBeenCalledWith(expect.objectContaining({
      source: { kind: 'drag', dragSessionId: 'drag-protected' },
      target: expect.objectContaining({
        kind: 'score',
        location: expect.objectContaining({ layerId: 'nested-group-layer-0', startTime: 2 }),
      }),
    }));
    expect(applyLibraryTransfer).toHaveBeenCalledWith('score-preview');
  });

  it('uses the exact last pointer location for keyboard Paste and pauses for shared-copy choice', async () => {
    useLibraryStore.setState({
      clipboard: {
        operation: 'copy',
        source: {
          kind: 'library',
          key: {
            scope: 'projectShared', libraryType: 'soundObject', projectSessionId: 8,
            locator: { kind: 'soundObject', libraryId: 'shared-1', persistedFingerprint: { canonicalHash: 'h', displayName: 'Shared Phrase', objectType: 'GenericScore' } },
          },
          revision: 'h',
        },
        capturedAt: 1,
      },
    });
    previewLibraryTransfer.mockImplementationOnce(async (request) => ({
      ok: true as const,
      value: {
        previewToken: 'shared-preview',
        item: {
          key: request.source.kind === 'clipboard' && request.source.source.kind === 'library'
            ? request.source.source.key
            : { scope: 'user' as const, libraryType: 'soundObject' as const, nodeId: 'fallback' },
          displayName: 'Shared Phrase', libraryType: 'soundObject' as const, scope: 'projectShared' as const,
          objectType: 'GenericScore', supportStatus: 'supported' as const, supportMessage: null,
          fields: {}, dependencies: { itemOwned: [], unresolvedExternal: [] },
        },
        target: request.target, requestedMode: 'independent' as const,
        allowedModes: ['independent', 'sharedInstance'] as const, canApply: true, blockingReasons: [],
      },
    }));

    act(() => { surface.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 360, clientY: 10 })); });
    await act(async () => {
      surface.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'v', ctrlKey: true }));
      await Promise.resolve();
    });
    expect(previewLibraryTransfer).toHaveBeenLastCalledWith(expect.objectContaining({
      target: expect.objectContaining({ location: expect.objectContaining({ startTime: 7 }) }),
    }));
    expect(useLibraryStore.getState().transferPreview?.allowedModes).toEqual(['independent', 'sharedInstance']);
    expect(applyLibraryTransfer).not.toHaveBeenCalled();
  });

  it('routes the shared BlueSynthBuilder buffer through Paste BSB As Sound', async () => {
    act(() => {
      useLibraryStore.setState({
        clipboard: {
          operation: 'copy',
          source: {
            kind: 'library',
            key: {
              scope: 'projectOwned',
              libraryType: 'instrument',
              projectSessionId: 8,
              locator: { kind: 'instrument', assignmentId: '1' },
            },
            revision: 'bsb-hash',
          },
          capturedAt: 1,
          objectType: 'BlueSynthBuilder',
        },
      });
    });
    await act(async () => {
      surface.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        button: 2,
        clientX: 230,
        clientY: 10,
      }));
      await Promise.resolve();
    });
    const item = Array.from(document.body.querySelectorAll('[role="menuitem"]'))
      .find((candidate) => candidate.textContent?.includes('Paste BSB As Sound')) as HTMLElement;
    expect(item).toBeTruthy();
    expect(item.hasAttribute('data-disabled')).toBe(false);

    const PointerEventCtor = window.PointerEvent ?? MouseEvent;
    await act(async () => {
      item.dispatchEvent(new PointerEventCtor('pointermove', { bubbles: true }));
      item.dispatchEvent(new PointerEventCtor('pointerdown', { bubbles: true, button: 0 }));
      item.dispatchEvent(new PointerEventCtor('pointerup', { bubbles: true, button: 0 }));
      item.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(previewLibraryTransfer).toHaveBeenCalledWith(expect.objectContaining({
      source: {
        kind: 'clipboard',
        source: expect.objectContaining({ kind: 'library' }),
      },
      target: {
        kind: 'scoreBsbSound',
        projectSessionId: 8,
        projectRevision: 21,
        location: {
          rootGroupId: 'root-stable',
          containerPath: [{ layerId: 'root-layer-2', objectIdentity: 'container-7' }],
          layerId: 'nested-group-layer-0',
          startTime: 4,
        },
        timeContextRevision: '21',
      },
    }));
  });
});
