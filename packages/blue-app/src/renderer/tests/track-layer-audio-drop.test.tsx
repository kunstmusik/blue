// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScoreLayerGroupSnapshot, TrackLayerGroupSnapshot } from '../../shared/project-editor';
import type { ScoreLayerSnapshot, ScoreRowObjectSnapshot } from '../components/workbench/panels/score/types';
import TrackLayerGroupCanvas from '../components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas';
import { useProjectStore } from '../stores/project-store';
import { useLibraryStore } from '../stores/library-store';
import { useMidiRoutingStore } from '../stores/midi-routing-store';
import { useScoreSelectionStore } from '../stores/score-selection-store';
import { useWorkbenchStore } from '../stores/workbench-store';
import {
  BLUE_FILE_MANAGER_DRAG_MIME,
  serializeFileManagerDragPayload,
} from '../../shared/file-manager';
import {
  clearAudioFileDurationCache,
  setCachedAudioFileDuration,
} from '../components/workbench/panels/score/layer-groups/audio-file-duration-cache';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import { toast } from 'sonner';

function makeLayer(): ScoreLayerSnapshot {
  return {
    layerId: 'track-row',
    layerKind: 'track',
    name: 'Track Row',
    height: 44,
    muted: false,
    solo: false,
    instrument: null,
    items: [],
  };
}

function makeTrackGroup(): TrackLayerGroupSnapshot {
  const group: TrackLayerGroupSnapshot = {
    groupId: 'track-group',
    groupType: 'track',
    name: 'Tracks',
    defaultHeightIndex: 0,
    layerCount: 1,
    isOpenableContainer: false,
    layers: [makeLayer()],
  };
  return group;
}

function makeUnusedSoundGroup(): ScoreLayerGroupSnapshot {
  return {
    groupId: 'sound-group',
    groupType: 'polyObject',
    name: 'SoundObjects',
    layerCount: 1,
    isOpenableContainer: true,
    layers: [makeLayer()],
  };
}

interface DataTransferStub {
  types: string[];
  files: File[];
  dropEffect: string;
  effectAllowed?: string;
  getData: (type: string) => string;
  setData: (type: string, value: string) => void;
}

function makeDataTransfer(options: {
  types?: string[];
  payloadByType?: Record<string, string>;
  files?: File[];
}): DataTransferStub {
  const payloadByType = options.payloadByType ?? {};
  return {
    types: options.types ?? Object.keys(payloadByType),
    files: options.files ?? [],
    dropEffect: 'none',
    effectAllowed: 'none',
    getData: (type: string) => payloadByType[type] ?? '',
    setData: (type: string, value: string) => {
      payloadByType[type] = value;
    },
  };
}

function dragEvent(
  type: 'dragover' | 'drop' | 'dragleave' | 'dragenter',
  dataTransfer?: DataTransferStub,
  x: number = 0,
  y: number = 0,
  relatedTarget: EventTarget | null = null,
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  if (dataTransfer) Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
  Object.defineProperty(event, 'clientX', { value: x });
  Object.defineProperty(event, 'clientY', { value: y });
  if (relatedTarget) Object.defineProperty(event, 'relatedTarget', { value: relatedTarget });
  return event;
}

describe('Track audio-layer file drop target', () => {
  let host: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;
  let surface: HTMLDivElement | null = null;
  const commitAudioFileDrop = vi.fn();
  const getPathForFile = vi.fn();

  const originalProjectActions = {
    applyProjectDocumentPatch: useProjectStore.getState().applyProjectDocumentPatch,
    moveScoreObjects: useProjectStore.getState().moveScoreObjects,
    resizeScoreObjects: useProjectStore.getState().resizeScoreObjects,
  };
  const originalBlueAPI = window.blueAPI;
  const originalSelect = useScoreSelectionStore.getState().select;
  const originalOpenPanel = useWorkbenchStore.getState().openPanel;
  const originalCapture = useLibraryStore.getState().captureScoreSoundObject;

  beforeEach(() => {
    const group = makeTrackGroup();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root.render(<TrackLayerGroupCanvas
        group={group}
        allLayerGroups={[group, makeUnusedSoundGroup()]}
        projectSessionId={7}
        projectRevision={3}
        scoreRootGroupId={group.groupId}
        scoreContainerPath={[]}
        totalBeats={16}
        pixelsPerBeat={25}
        snapEnabled={false}
        snapValue="BEAT"
        tempo={120}
        smpteFrameRate={30}
        meterMap={{ entries: [{ measure: 0, numBeats: 4, beatLength: 4, startBeat: 0 }] }}
      />);
    });
    surface = host.querySelector('[data-track-layer-group="true"]') as HTMLDivElement;
    Object.defineProperty(surface, 'getBoundingClientRect', { value: () => ({
      left: 0, top: 0, right: 400, bottom: 44, width: 400, height: 44, x: 0, y: 0,
      toJSON: () => undefined,
    }) });

    useProjectStore.setState({
      applyProjectDocumentPatch: vi.fn().mockResolvedValue(undefined),
      moveScoreObjects: vi.fn(),
      resizeScoreObjects: vi.fn(),
    } as Partial<ReturnType<typeof useProjectStore.getState>>);
    useScoreSelectionStore.setState({ select: originalSelect });
    useLibraryStore.setState({ captureScoreSoundObject: vi.fn().mockResolvedValue(true) });
    useWorkbenchStore.setState({ openPanel: vi.fn() } as Partial<ReturnType<typeof useWorkbenchStore.getState>>);
    commitAudioFileDrop.mockResolvedValue({ status: 'created', objectName: 'a.wav', storedPath: 'media/a.wav', copiedToMedia: true, receipt: { revision: 4, sessionId: 7, changed: true } });
    getPathForFile.mockImplementation((file: { name?: string }) => `/Dropped/${file?.name ?? 'file'}`);
    window.blueAPI = {
      ...window.blueAPI,
      commitAudioFileDrop,
      getPathForFile,
    } as typeof window.blueAPI;
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    host?.remove();
    host = null;
    root = null;
    surface = null;
    useProjectStore.setState(originalProjectActions as Partial<ReturnType<typeof useProjectStore.getState>>);
    useLibraryStore.setState({ captureScoreSoundObject: originalCapture });
    useScoreSelectionStore.setState({ select: originalSelect });
    useScoreSelectionStore.getState().clearSelection();
    useScoreSelectionStore.getState().clearClipboard();
    useMidiRoutingStore.getState().clearFocusForProjectSession();
    useWorkbenchStore.setState({ openPanel: originalOpenPanel } as Partial<ReturnType<typeof useWorkbenchStore.getState>>);
    useScoreSelectionStore.getState().setAudioDropGuideBeat(null);
    clearAudioFileDurationCache();
    window.blueAPI = originalBlueAPI;
    vi.clearAllMocks();
  });

  it('accepts a File Manager regular-file drop and maps pointer to layer/time', async () => {
    const dataTransfer = makeDataTransfer({
      payloadByType: {
        [BLUE_FILE_MANAGER_DRAG_MIME]: serializeFileManagerDragPayload({
          version: 1, kind: 'file', path: '/Users/me/a.wav', name: 'a.wav',
        }),
      },
    });

    act(() => {
      surface!.dispatchEvent(dragEvent('dragover', dataTransfer, 50, 22));
    });
    expect(dataTransfer.dropEffect).toBe('copy');

    await act(async () => {
      surface!.dispatchEvent(dragEvent('drop', dataTransfer, 50, 22));
    });

    expect(commitAudioFileDrop).toHaveBeenCalledOnce();
    expect(commitAudioFileDrop).toHaveBeenCalledWith({
      sourcePath: '/Users/me/a.wav',
      sourceKind: 'file-manager',
      track: {
        rootGroupId: 'track-group',
        trackId: 'track-row',
        projectSessionId: 7,
        projectRevision: 3,
      },
      startBeats: 2,
    });
  });

  it('accepts one external OS audio file through the same commit path', async () => {
    const dataTransfer = makeDataTransfer({
      types: ['Files'],
      files: [{ name: 'ext.wav' } as unknown as File],
    });

    act(() => {
      surface!.dispatchEvent(dragEvent('dragover', dataTransfer, 25, 10));
    });
    expect(dataTransfer.dropEffect).toBe('copy');

    await act(async () => {
      surface!.dispatchEvent(dragEvent('drop', dataTransfer, 25, 10));
    });

    expect(commitAudioFileDrop).toHaveBeenCalledOnce();
    expect(commitAudioFileDrop).toHaveBeenCalledWith(expect.objectContaining({
      sourcePath: '/Dropped/ext.wav',
      sourceKind: 'external-os',
      startBeats: 1,
    }));
  });

  it('rejects a directory payload without a commit', async () => {
    const dataTransfer = makeDataTransfer({
      payloadByType: {
        [BLUE_FILE_MANAGER_DRAG_MIME]: JSON.stringify({ version: 1, kind: 'directory', path: '/Users/me/dir', name: 'dir' }),
      },
    });

    await act(async () => {
      surface!.dispatchEvent(dragEvent('drop', dataTransfer, 50, 22));
    });
    expect(commitAudioFileDrop).not.toHaveBeenCalled();
  });

  it('rejects multiple external files without a partial import', async () => {
    const dataTransfer = makeDataTransfer({
      types: ['Files'],
      files: [{ name: 'a.wav' } as unknown as File, { name: 'b.wav' } as unknown as File],
    });

    await act(async () => {
      surface!.dispatchEvent(dragEvent('drop', dataTransfer, 50, 22));
    });
    expect(commitAudioFileDrop).not.toHaveBeenCalled();
  });

  it('rejects an unsupported extension before committing', async () => {
    const dataTransfer = makeDataTransfer({
      payloadByType: {
        [BLUE_FILE_MANAGER_DRAG_MIME]: serializeFileManagerDragPayload({
          version: 1, kind: 'file', path: '/Users/me/readme.txt', name: 'readme.txt',
        }),
      },
    });

    await act(async () => {
      surface!.dispatchEvent(dragEvent('drop', dataTransfer, 50, 22));
    });
    expect(commitAudioFileDrop).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('does not advertise a copy effect for an unsupported File Manager file', () => {
    const dataTransfer = makeDataTransfer({
      payloadByType: {
        [BLUE_FILE_MANAGER_DRAG_MIME]: serializeFileManagerDragPayload({
          version: 1, kind: 'file', path: '/Users/me/readme.txt', name: 'readme.txt',
        }),
      },
    });

    act(() => {
      surface!.dispatchEvent(dragEvent('dragover', dataTransfer, 50, 22));
    });
    expect(dataTransfer.dropEffect).toBe('none');
  });

  it('rejects a non-file URI without fetching it', async () => {
    const dataTransfer = makeDataTransfer({
      payloadByType: {
        'text/uri-list': 'https://example.com/a.wav',
      },
    });

    await act(async () => {
      surface!.dispatchEvent(dragEvent('drop', dataTransfer, 50, 22));
    });
    expect(commitAudioFileDrop).not.toHaveBeenCalled();
  });

  it('rejects a drop with no valid layer at the pointer', async () => {
    const dataTransfer = makeDataTransfer({
      payloadByType: {
        [BLUE_FILE_MANAGER_DRAG_MIME]: serializeFileManagerDragPayload({
          version: 1, kind: 'file', path: '/Users/me/a.wav', name: 'a.wav',
        }),
      },
    });

    await act(async () => {
      surface!.dispatchEvent(dragEvent('drop', dataTransfer, 50, 500));
    });
    expect(commitAudioFileDrop).not.toHaveBeenCalled();
  });

  it('reports a rejected main commit without changing the project', async () => {
    commitAudioFileDrop.mockResolvedValue({
      status: 'rejected',
      code: 'stale-project',
      message: 'The score changed while dragging. Drop again to retry.',
    });
    const dataTransfer = makeDataTransfer({
      payloadByType: {
        [BLUE_FILE_MANAGER_DRAG_MIME]: serializeFileManagerDragPayload({
          version: 1, kind: 'file', path: '/Users/me/a.wav', name: 'a.wav',
        }),
      },
    });

    await act(async () => {
      surface!.dispatchEvent(dragEvent('drop', dataTransfer, 50, 22));
    });
    expect(commitAudioFileDrop).toHaveBeenCalledOnce();
    expect(toast.error).toHaveBeenCalledWith('The score changed while dragging. Drop again to retry.');
  });

  it('does not claim unrelated drag payloads', () => {
    const dataTransfer = makeDataTransfer({
      payloadByType: { 'application/x-unrelated': 'x' },
    });

    act(() => {
      surface!.dispatchEvent(dragEvent('dragover', dataTransfer, 50, 22));
    });
    expect(dataTransfer.dropEffect).toBe('none');
  });

  it('does not claim unified-library drags that also carry text/plain', () => {
    const dataTransfer = makeDataTransfer({
      payloadByType: {
        'application/x-blue-library-drag': '{"revision":"r1"}',
        'text/plain': 'Blue Library Item',
      },
    });

    act(() => {
      surface!.dispatchEvent(dragEvent('dragover', dataTransfer, 50, 22));
    });
    expect(dataTransfer.dropEffect).toBe('none');

    act(() => {
      surface!.dispatchEvent(dragEvent('drop', dataTransfer, 50, 22));
    });
    expect(commitAudioFileDrop).not.toHaveBeenCalled();
  });

  it('does not advertise a copy effect when no layer is under the pointer', () => {
    const dataTransfer = makeDataTransfer({
      types: ['Files'],
      files: [{ name: 'ext.wav' } as unknown as File],
    });

    act(() => {
      surface!.dispatchEvent(dragEvent('dragover', dataTransfer, 50, 500));
    });
    expect(dataTransfer.dropEffect).toBe('none');
  });

  it('displays a ghost rectangle and vertical guide line while dragging over a track layer', () => {
    const dataTransfer = makeDataTransfer({
      payloadByType: {
        [BLUE_FILE_MANAGER_DRAG_MIME]: serializeFileManagerDragPayload({
          version: 1, kind: 'file', path: '/Users/me/a.wav', name: 'a.wav',
        }),
      },
    });

    act(() => {
      surface!.dispatchEvent(dragEvent('dragover', dataTransfer, 50, 22));
    });

    const guideLine = surface!.querySelector('[data-audio-drop-guide-line="true"]') as HTMLDivElement | null;
    const ghostRect = surface!.querySelector('[data-audio-drop-ghost-rect="true"]') as HTMLDivElement | null;

    expect(guideLine).not.toBeNull();
    expect(guideLine?.style.left).toBe('50px');

    expect(ghostRect).not.toBeNull();
    expect(ghostRect?.style.left).toBe('50px');
    expect(ghostRect?.style.top).toBe('0px');
    expect(ghostRect?.style.height).toBe('44px');
    // Default duration: 4 beats * 25 px/beat = 100px
    expect(ghostRect?.style.width).toBe('100px');

    expect(useScoreSelectionStore.getState().audioDropGuideBeat).toBe(2);
  });

  it('updates ghost rectangle with cached audio file duration when available', () => {
    // 3.0 seconds at tempo 120 (2 beats/sec) = 6 beats = 150px
    setCachedAudioFileDuration('/Users/me/a.wav', 3.0);

    const dataTransfer = makeDataTransfer({
      payloadByType: {
        [BLUE_FILE_MANAGER_DRAG_MIME]: serializeFileManagerDragPayload({
          version: 1, kind: 'file', path: '/Users/me/a.wav', name: 'a.wav',
        }),
      },
    });

    act(() => {
      surface!.dispatchEvent(dragEvent('dragover', dataTransfer, 50, 22));
    });

    const ghostRect = surface!.querySelector('[data-audio-drop-ghost-rect="true"]') as HTMLDivElement | null;
    expect(ghostRect).not.toBeNull();
    expect(ghostRect?.style.width).toBe('150px');
  });

  it('clears ghost rectangle and guide line on dragleave', () => {
    const dataTransfer = makeDataTransfer({
      payloadByType: {
        [BLUE_FILE_MANAGER_DRAG_MIME]: serializeFileManagerDragPayload({
          version: 1, kind: 'file', path: '/Users/me/a.wav', name: 'a.wav',
        }),
      },
    });

    act(() => {
      surface!.dispatchEvent(dragEvent('dragover', dataTransfer, 50, 22));
    });
    expect(surface!.querySelector('[data-audio-drop-ghost-rect="true"]')).not.toBeNull();
    expect(useScoreSelectionStore.getState().audioDropGuideBeat).toBe(2);

    const outsideNode = document.createElement('div');
    document.body.appendChild(outsideNode);

    act(() => {
      surface!.dispatchEvent(dragEvent('dragleave', dataTransfer, 0, 0, outsideNode));
    });

    expect(surface!.querySelector('[data-audio-drop-ghost-rect="true"]')).toBeNull();
    expect(surface!.querySelector('[data-audio-drop-guide-line="true"]')).toBeNull();
    expect(useScoreSelectionStore.getState().audioDropGuideBeat).toBeNull();

    outsideNode.remove();
  });

  it('clears ghost rectangle and guide line on drop', async () => {
    const dataTransfer = makeDataTransfer({
      payloadByType: {
        [BLUE_FILE_MANAGER_DRAG_MIME]: serializeFileManagerDragPayload({
          version: 1, kind: 'file', path: '/Users/me/a.wav', name: 'a.wav',
        }),
      },
    });

    act(() => {
      surface!.dispatchEvent(dragEvent('dragover', dataTransfer, 50, 22));
    });
    expect(surface!.querySelector('[data-audio-drop-ghost-rect="true"]')).not.toBeNull();

    await act(async () => {
      surface!.dispatchEvent(dragEvent('drop', dataTransfer, 50, 22));
    });

    expect(surface!.querySelector('[data-audio-drop-ghost-rect="true"]')).toBeNull();
    expect(surface!.querySelector('[data-audio-drop-guide-line="true"]')).toBeNull();
    expect(useScoreSelectionStore.getState().audioDropGuideBeat).toBeNull();
  });

  it('does not display ghost rectangle when dragging unsupported or non-audio payload', () => {
    const dataTransfer = makeDataTransfer({
      payloadByType: {
        [BLUE_FILE_MANAGER_DRAG_MIME]: serializeFileManagerDragPayload({
          version: 1, kind: 'file', path: '/Users/me/readme.txt', name: 'readme.txt',
        }),
      },
    });

    act(() => {
      surface!.dispatchEvent(dragEvent('dragover', dataTransfer, 50, 22));
    });

    expect(surface!.querySelector('[data-audio-drop-ghost-rect="true"]')).toBeNull();
    expect(surface!.querySelector('[data-audio-drop-guide-line="true"]')).toBeNull();
    expect(useScoreSelectionStore.getState().audioDropGuideBeat).toBeNull();
  });
});
