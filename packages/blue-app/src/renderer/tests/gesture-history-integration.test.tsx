// @vitest-environment jsdom

import os from 'node:os';
import path from 'node:path';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BlueData,
  CurveType,
  GenericScore,
  JMask,
  LineObject,
  PianoNote,
  PianoRoll,
  PolyObject,
  SoundLayer,
} from '@blue/data';
import type { SoundObject } from '@blue/data';
import { isNetZeroProjectState, ProjectHistory } from '../../main/project-history';
import { ProjectSession } from '../../main/project-session';
import {
  applyProjectDocumentPatch,
  createProjectEditorSnapshot,
  createScoreObjectEditorDocument,
} from '../../shared/project-editor';
import type { ProjectDocumentPatch, ProjectEditorSnapshot } from '../../shared/project-editor';
import type { ScoreObjectEditorTargetSnapshot } from '../../shared/project-editor';
import type { ProjectDocumentCommitMetadata } from '../../shared/project-history';
import {
  assignExplicitScoreObjectId,
  getScoreObjectId,
  transferProjectEditorIdentities,
} from '../../shared/project-editor/identity';
import AutomationLayerOverlay from '../components/workbench/panels/score/automation/AutomationLayerOverlay';
import MarkersBar from '../components/workbench/panels/score/MarkersBar';
import TempoLineView from '../components/workbench/panels/score/TempoLineView';
import {
  TEMPO_LINE_VIEW_HEIGHT,
  tempoToScreenY,
} from '../components/workbench/panels/score/tempo-map-utils';
import { useScoreRulerSelection } from '../components/workbench/panels/score/useScoreRulerSelection';
import LineObjectEditor from '../components/workbench/panels/score-object/editors/LineObjectEditor';
import JMaskEditor from '../components/workbench/panels/score-object/editors/JMaskEditor';
import PianoRollEditor from '../components/workbench/panels/score-object/editors/PianoRollEditor';
import {
  createDefaultParameterSnapshot,
  type FieldSnapshot,
} from '../components/workbench/panels/score-object/editors/jmask/jmask-utils';
import { setProjectHistoryProjection } from '../hooks/use-project-history';
import { executeProjectRedo, executeProjectUndo } from '../lib/history-scope-router';
import {
  acceptProjectDocumentRevision,
  ownsProjectDocumentOperationIds,
  useProjectStore,
} from '../stores/project-store';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let mounted: { root: Root; container: HTMLDivElement } | undefined;
const originalApi = window.blueAPI;

afterEach(() => {
  if (mounted) {
    act(() => mounted!.root.unmount());
    mounted.container.remove();
    mounted = undefined;
  }
  useProjectStore.getState().clearProject();
  setProjectHistoryProjection(null);
  window.blueAPI = originalApi;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty('--text-role-subheadline');
});

function fixture(
  object: SoundObject = new GenericScore(),
  prepare?: (data: BlueData) => void,
  retainedBytesLimit?: number,
) {
  const data = new BlueData();
  data.getMarkersList().addMarker('Intro', 2);
  const tempoMap = data.getScore().getTimeContext().getTempoMap();
  tempoMap.setEnabled(true);
  tempoMap.setTempoPoint(1, 4, 120, CurveType.CONSTANT);
  data.getScore().length = 0;
  const group = new PolyObject();
  const layer = new SoundLayer();
  assignExplicitScoreObjectId(object, 'stable-object');
  layer.push(object);
  group.push(layer);
  data.getScore().push(group);
  prepare?.(data);

  const session = new ProjectSession();
  session.replace(data, path.join(os.tmpdir(), 'gesture-history.blue'));
  const snapshot = () => {
    const current = session.read();
    return createProjectEditorSnapshot(
      current.data!,
      current.filePath,
      current.sessionId,
      current.documentId!,
    );
  };
  const history = new ProjectHistory({
    session,
    captureSnapshot: snapshot,
    retainedBytesLimit,
    publishUpdated: (event) => {
      setProjectHistoryProjection(event.history);
      acceptProjectDocumentRevision(event.sessionId, event.revision);
      if (!ownsProjectDocumentOperationIds(event.acceptedOperationIds)) {
        useProjectStore
          .getState()
          .refreshFromCanonical(event.snapshot as ProjectEditorSnapshot, event.isDirty);
      }
    },
  });
  history.checkpointSave();
  const terminals: Promise<unknown>[] = [];
  window.blueAPI = {
    ...originalApi,
    commitProjectDocumentPatches: async (
      patches: ProjectDocumentPatch[],
      metadata?: ProjectDocumentCommitMetadata,
    ) => {
      const result = await history.commit({
        documentId: session.read().documentId!,
        operationId: metadata?.operationId ?? crypto.randomUUID(),
        expectedRevision: metadata?.expectedRevision ?? session.read().revision,
        contextSequence: metadata?.contextSequence ?? 0,
        label: metadata?.label ?? 'Edit Project',
        gestureId: metadata?.gestureId,
        fieldId: metadata?.fieldId,
        phase: metadata?.phase ?? 'single',
        origin: metadata?.origin,
        patches,
      });
      if (result.status !== 'committed' && result.status !== 'unchanged')
        throw new Error(JSON.stringify(result));
      return result.receipt!;
    },
    commitProjectHistory: (request) => {
      const result = history.commit(request);
      terminals.push(result);
      return result;
    },
    undoProjectHistory: (request) => history.undo(request),
    redoProjectHistory: (request) => history.redo(request),
    getProjectDocument: async () => snapshot(),
    readProjectHistory: async () => history.read(),
  } as typeof window.blueAPI;
  useProjectStore.getState().clearProject();
  act(() => useProjectStore.getState().setProjectInfo(snapshot()));
  setProjectHistoryProjection(history.read());

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted = { root, container };
  const flush = async () => {
    await act(async () => {
      await useProjectStore.getState().flushPendingPatches();
      await Promise.resolve();
      await Promise.all(terminals.splice(0));
    });
  };
  const state = () => session.read().data!.saveToString();
  const identity = () =>
    getScoreObjectId(((session.read().data!.getScore()[0] as PolyObject)[0] as SoundLayer)[0]!);
  return { session, history, root, container, flush, state, identity, snapshot };
}

function mouse(target: EventTarget, type: string, x: number, y = 10, shiftKey = false) {
  act(() =>
    target.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: x,
        clientY: y,
        shiftKey,
      }),
    ),
  );
}

function escape() {
  act(() =>
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    ),
  );
}

function rect(element: Element, width = 320, height = 80) {
  element.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON: () => ({}),
    }) as DOMRect;
}

function Timeline({ kind }: { kind: 'marker' | 'ruler' | 'tempo' }) {
  const score = useProjectStore((s) => s.score);
  const transport = useProjectStore((s) => s.transport);
  const scrollContainerRef = { current: null };
  const ruler = useScoreRulerSelection({
    pixelsPerBeat: 20,
    totalBeats: 16,
    snapEnabled: false,
    snapValue: 'BEAT',
    meterMap: score.meterMap,
    rootTimelineOnly: true,
    scrollContainerRef,
    tempo: 60,
    smpteFrameRate: 24,
    sampleRate: 44100,
  });
  if (kind === 'ruler') return <div data-testid="ruler" onMouseDown={ruler.handleMouseDown} />;
  if (kind === 'tempo')
    return (
      <TempoLineView
        tempoMap={transport.tempoMap}
        meterMap={score.meterMap}
        totalBeats={16}
        pixelsPerBeat={20}
        snapEnabled={false}
        snapValue="BEAT"
        rootTimelineOnly
        scrollContainerRef={scrollContainerRef}
        onTempoPatch={(patch, metadata) => {
          void useProjectStore
            .getState()
            .applyProjectDocumentPatch({ transport: { tempoMapPatch: patch } }, metadata);
        }}
      />
    );
  return (
    <MarkersBar
      markers={score.markers}
      totalBeats={16}
      pixelsPerBeat={20}
      rowVisible
      snapEnabled={false}
      snapValue="BEAT"
      meterMap={score.meterMap}
      rootTimelineOnly
      scrollContainerRef={scrollContainerRef}
      tempo={60}
      smpteFrameRate={24}
      sampleRate={44100}
    />
  );
}

function mountTimeline(f: ReturnType<typeof fixture>, kind: 'marker' | 'ruler' | 'tempo') {
  act(() => f.root.render(<Timeline kind={kind} />));
  const element = f.container.querySelector(
    kind === 'tempo' ? 'svg' : kind === 'ruler' ? '[data-testid="ruler"]' : 'div',
  )!;
  rect(element);
  return element;
}

describe('timeline gesture → document queue → canonical history', () => {
  it('publishes oversize rollback through the real renderer queue (T047)', async () => {
    const f = fixture(undefined, undefined, 100000);
    const baseline = f.state();
    await act(async () => {
      await useProjectStore
        .getState()
        .applyProjectDocumentPatch(
          { projectProperties: { title: 'Live' } },
          { gestureId: 'size', label: 'Live', phase: 'begin' },
        );
    });
    await f.flush();
    expect(useProjectStore.getState().projectProperties.title).toBe('Live');
    await act(async () => {
      await useProjectStore
        .getState()
        .applyProjectDocumentPatch(
          { globalOrc: 'x'.repeat(200000) },
          { gestureId: 'size', label: 'Live', phase: 'update' },
        );
      await useProjectStore
        .getState()
        .flushPendingPatches()
        .catch(() => undefined);
    });
    expect(f.state()).toBe(baseline);
    expect(useProjectStore.getState().projectProperties.title).toBe(
      f.snapshot().projectProperties.title,
    );
    expect(f.history.read().length).toBe(0);
    expect(f.history.isDirty()).toBe(false);
  });

  it.each(['mouseup', 'Escape', 'blur'])(
    'round-trips or cancels a rendered automation circle via %s (T049)',
    async (terminal) => {
      vi.stubGlobal(
        'ResizeObserver',
        class {
          observe() {}
          disconnect() {}
        },
      );
      const rect = {
        left: 0,
        top: 0,
        width: 320,
        height: 80,
        right: 320,
        bottom: 80,
        x: 0,
        y: 0,
        toJSON() {},
      };
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect);
      const f = fixture(undefined, (data) => {
        data.getMixer().setEnabled(true);
        const channel = data.getMixer().getMaster();
        const param = channel.getLevelParameter();
        param.setMinimum(0);
        param.setMaximum(10);
        param.setResolution(0.1);
        param.setAutomationEnabled(true);
        param.setPoints([
          { time: 1, value: 2 },
          { time: 5, value: 8 },
        ]);
        (data.getScore()[0] as PolyObject)[0]!
          .getAutomationParameters()
          .addParameterId(param.getUniqueId());
      });
      const baseline = f.state();
      const identity = f.identity();
      const automation = f.snapshot().score.layerGroups[0]!.layers[0]!.automation!;
      expect(automation.parameters.length, JSON.stringify(automation)).toBe(1);
      act(() =>
        f.root.render(
          <AutomationLayerOverlay
            automation={{ ...automation, selectedParameterId: automation.parameterIds[0] }}
            pixelsPerBeat={20}
            totalBeats={16}
            snapEnabled={false}
            snapValue="BEAT"
            tempo={60}
            smpteFrameRate={24}
            mode="singleLine"
            onPatch={(patch, metadata) => {
              void useProjectStore.getState().applyProjectDocumentPatch({ score: patch }, metadata);
            }}
          />,
        ),
      );
      const circle = f.container.querySelector('circle')!;
      expect(circle, f.container.innerHTML).toBeTruthy();
      mouse(circle, 'mousedown', 20, 64);
      mouse(window, 'mousemove', 40, 50);
      await f.flush();
      if (terminal === 'Escape')
        act(() =>
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })),
        );
      else if (terminal === 'blur') act(() => window.dispatchEvent(new Event('blur')));
      else mouse(window, 'mouseup', 40, 50);
      await f.flush();
      expect(f.identity()).toBe(identity);
      if (terminal !== 'mouseup') {
        expect(f.state()).toBe(baseline);
        expect(f.history.read().length).toBe(0);
        return;
      }
      const edited = f.state();
      expect(edited).not.toBe(baseline);
      expect(f.history.read().length).toBe(1);
      await act(async () => {
        await executeProjectUndo();
      });
      expect(f.state()).toBe(baseline);
      await act(async () => {
        await executeProjectRedo();
      });
      expect(f.state()).toBe(edited);
      expect(f.identity()).toBe(identity);
    },
  );

  it.each(['marker', 'tempo'] as const)(
    'rejects duplicate %s identities without changing the document',
    async (kind) => {
      const f = fixture();
      const before = f.state();
      const snapshot = f.snapshot();
      const patch: ProjectDocumentPatch =
        kind === 'marker'
          ? {
              score: {
                type: 'addMarker',
                timeBeats: 6,
                markerId: snapshot.score.markers[0]!.markerId,
              },
            }
          : {
              transport: {
                tempoMapPatch: {
                  type: 'addTempoPoint',
                  point: {
                    beat: 8,
                    tempo: 90,
                    curveType: 'constant',
                    pointId: snapshot.transport.tempoMap.points[1]!.pointId,
                  },
                },
              },
            };
      const result = await f.history.commit({
        documentId: f.session.read().documentId!,
        operationId: 'duplicate-id',
        expectedRevision: f.session.read().revision,
        contextSequence: 1,
        origin: { contextId: 'other-view' },
        label: 'Invalid identity',
        phase: 'single',
        patches: [patch],
      });
      expect(result.status).toBe('invalid');
      expect(f.state()).toBe(before);
      expect(f.history.read().length).toBe(0);
    },
  );

  it.each(['marker', 'tempo'] as const)(
    'does not edit an identical replacement of the pressed %s',
    async (kind) => {
      const f = fixture();
      const element = mountTimeline(f, kind);
      if (kind === 'marker') {
        mouse(
          [...element.querySelectorAll('span')].find((node) => node.textContent === 'Intro')!,
          'mousedown',
          40,
        );
      } else {
        mouse(element, 'mousedown', 80, tempoToScreenY(120, TEMPO_LINE_VIEW_HEIGHT));
      }
      const beforeReplacement = f.state();
      const checkpoint = f.session.read().data!.historyCopy();
      transferProjectEditorIdentities(f.session.read().data!, checkpoint);
      const itemId = () =>
        kind === 'marker'
          ? f.snapshot().score.markers[0]!.markerId
          : f.snapshot().transport.tempoMap.points[1]!.pointId;
      const originalId = itemId();
      await act(async () => {
        const patches: ProjectDocumentPatch[] =
          kind === 'marker'
            ? [
                { score: { type: 'removeMarker', sourceIndex: 0 } },
                { score: { type: 'addMarker', timeBeats: 2, name: 'Intro' } },
              ]
            : [
                { transport: { tempoMapPatch: { type: 'removeTempoPoint', index: 1 } } },
                {
                  transport: {
                    tempoMapPatch: {
                      type: 'addTempoPoint',
                      point: { beat: 4, tempo: 120, curveType: 'constant' },
                    },
                  },
                },
              ];
        const result = await f.history.commit({
          documentId: f.session.read().documentId!,
          operationId: 'replace-target',
          expectedRevision: f.session.read().revision,
          contextSequence: 1,
          origin: { contextId: 'other-view' },
          label: 'Replace target',
          phase: 'single',
          patches,
        });
        expect(result.status).toBe('committed');
      });
      expect(f.state()).toBe(beforeReplacement);
      const replacementId = itemId();
      expect(replacementId).toBeTruthy();
      expect(replacementId).not.toBe(originalId);
      expect(f.state()).not.toContain(replacementId!);
      expect(isNetZeroProjectState(checkpoint, f.session.read().data!)).toBe(false);
      mouse(
        window,
        'mousemove',
        140,
        kind === 'tempo' ? tempoToScreenY(120, TEMPO_LINE_VIEW_HEIGHT) : 10,
      );
      mouse(window, 'mouseup', 140);
      await f.flush();
      expect(f.state()).toBe(beforeReplacement);
      expect(f.history.read()).toMatchObject({ length: 1, undoLabel: 'Replace target' });
      await act(async () => executeProjectUndo());
      expect(itemId()).toBe(originalId);
      await act(async () => executeProjectRedo());
      expect(itemId()).toBe(replacementId);
    },
  );

  it('does not retarget an indistinguishable marker after the pressed marker is removed', async () => {
    const f = fixture(new GenericScore(), (data) => data.getMarkersList().addMarker('Intro', 2));
    const element = mountTimeline(f, 'marker');
    mouse(
      [...element.querySelectorAll('span')].find((node) => node.textContent === 'Intro')!,
      'mousedown',
      40,
    );
    await act(async () => {
      const result = await f.history.commit({
        documentId: f.session.read().documentId!,
        operationId: 'remove-duplicate',
        expectedRevision: f.session.read().revision,
        contextSequence: 1,
        origin: { contextId: 'other-view' },
        label: 'Remove target',
        phase: 'single',
        patches: [{ score: { type: 'removeMarker', sourceIndex: 0 } }],
      });
      expect(result.status).toBe('committed');
    });
    const afterRemoval = f.state();
    mouse(window, 'mousemove', 140);
    mouse(window, 'mouseup', 140);
    await f.flush();
    expect(f.state()).toBe(afterRemoval);
    expect(f.history.read()).toMatchObject({ length: 1, undoLabel: 'Remove target' });
  });

  it.each(
    (['marker', 'tempo'] as const).flatMap((kind) =>
      [false, true].map((moved) => ({ kind, moved })),
    ),
  )(
    'does not retarget a $kind drag after removal by another view (already moved: $moved)',
    async ({ kind, moved }) => {
      const f = fixture(new GenericScore(), (data) => {
        data.getMarkersList().addMarker('Other', 6);
        data.getScore().getTimeContext().getTempoMap().setTempoPoint(2, 8, 90, CurveType.CONSTANT);
      });
      const element = mountTimeline(f, kind);
      if (kind === 'marker') {
        const label = [...element.querySelectorAll('span')].find(
          (node) => node.textContent === 'Intro',
        )!;
        mouse(label, 'mousedown', 40);
      } else {
        mouse(element, 'mousedown', 80, tempoToScreenY(120, TEMPO_LINE_VIEW_HEIGHT));
      }
      if (moved) {
        mouse(
          window,
          'mousemove',
          100,
          kind === 'tempo' ? tempoToScreenY(120, TEMPO_LINE_VIEW_HEIGHT) : 10,
        );
        await f.flush();
      }
      await act(async () => {
        const result = await f.history.commit({
          documentId: f.session.read().documentId!,
          operationId: 'remove-target',
          expectedRevision: f.session.read().revision,
          contextSequence: 1,
          origin: { contextId: 'other-view' },
          label: 'Remove target',
          phase: 'single',
          patches: [
            kind === 'marker'
              ? { score: { type: 'removeMarker', sourceIndex: 0 } }
              : { transport: { tempoMapPatch: { type: 'removeTempoPoint', index: 1 } } },
          ],
        });
        expect(result.status).toBe('committed');
      });
      const afterRemoval = f.state();
      mouse(
        window,
        'mousemove',
        140,
        kind === 'tempo' ? tempoToScreenY(120, TEMPO_LINE_VIEW_HEIGHT) : 10,
      );
      mouse(window, 'mouseup', 140);
      await f.flush();
      expect(f.state()).toBe(afterRemoval);
      expect(f.history.read()).toMatchObject({ length: moved ? 2 : 1, undoLabel: 'Remove target' });
    },
  );

  it.each(['marker', 'marker-duplicate', 'tempo'] as const)(
    'keeps a %s drag valid after an unrelated project edit',
    async (kind) => {
      const f = fixture(
        new GenericScore(),
        kind === 'marker-duplicate'
          ? (data) => {
              data.getMarkersList().addMarker('Intro', 2);
            }
          : undefined,
      );
      const element = mountTimeline(f, kind === 'marker-duplicate' ? 'marker' : kind);
      if (kind !== 'tempo') {
        mouse(
          [...element.querySelectorAll('span')].find((node) => node.textContent === 'Intro')!,
          'mousedown',
          40,
        );
      } else {
        mouse(element, 'mousedown', 80, tempoToScreenY(120, TEMPO_LINE_VIEW_HEIGHT));
      }
      await act(async () => {
        const result = await f.history.commit({
          documentId: f.session.read().documentId!,
          operationId: 'unrelated-edit',
          expectedRevision: f.session.read().revision,
          contextSequence: 1,
          origin: { contextId: 'other-view' },
          label: 'Other edit',
          phase: 'single',
          patches: [{ globalOrc: '; unrelated' }],
        });
        expect(result.status).toBe('committed');
      });
      const afterOtherEdit = f.state();
      mouse(
        window,
        'mousemove',
        140,
        kind === 'tempo' ? tempoToScreenY(120, TEMPO_LINE_VIEW_HEIGHT) : 10,
      );
      mouse(window, 'mouseup', 140);
      await f.flush();
      expect(f.state()).not.toBe(afterOtherEdit);
      expect(f.history.read()).toMatchObject({
        length: 2,
        undoLabel: kind === 'tempo' ? 'Edit Tempo Point' : 'Move Marker',
      });
    },
  );

  it.each(['marker', 'marker-move', 'ruler', 'tempo'] as const)(
    'commits %s as one action and restores content and identities on Undo/Redo',
    async (kind) => {
      const f = fixture();
      const element = mountTimeline(f, kind === 'marker-move' ? 'marker' : kind);
      const before = f.state();
      const id = f.identity();
      if (kind === 'marker') mouse(element, 'mousedown', 100, 10, true);
      else if (kind === 'marker-move')
        mouse(
          [...element.querySelectorAll('span')].find((node) => node.textContent === 'Intro')!,
          'mousedown',
          40,
        );
      else if (kind === 'ruler') mouse(element, 'mousedown', 40);
      else mouse(element, 'mousedown', 80, tempoToScreenY(120, TEMPO_LINE_VIEW_HEIGHT));
      mouse(
        window,
        'mousemove',
        kind === 'tempo' ? 110 : 140,
        kind === 'tempo' ? tempoToScreenY(120, TEMPO_LINE_VIEW_HEIGHT) : 10,
      );
      mouse(window, 'mouseup', 140);
      await f.flush();
      const committed = f.state();
      expect(committed).not.toBe(before);
      expect(f.history.read()).toMatchObject({
        length: 1,
        canUndo: true,
        undoLabel:
          kind === 'marker'
            ? 'Add Marker'
            : kind === 'marker-move'
              ? 'Move Marker'
              : kind === 'ruler'
                ? 'Select Render Range'
                : 'Edit Tempo Point',
      });
      expect(f.history.isDirty()).toBe(true);
      expect(f.identity()).toBe(id);
      await act(async () => executeProjectUndo());
      expect(f.state()).toBe(before);
      expect(f.identity()).toBe(id);
      expect(f.history.isDirty()).toBe(false);
      expect(f.history.read().canUndo).toBe(false);
      await act(async () => executeProjectRedo());
      expect(f.state()).toBe(committed);
      expect(f.identity()).toBe(id);
      expect(f.history.isDirty()).toBe(true);
    },
  );

  it.each(
    (['marker', 'marker-move', 'ruler', 'tempo'] as const).flatMap((kind) =>
      [false, true].map((alreadyDirty) => ({ kind, alreadyDirty })),
    ),
  )(
    'cancels a flushed $kind gesture and preserves dirty=$alreadyDirty and redo',
    async ({ kind, alreadyDirty }) => {
      const f = fixture();
      await act(async () => {
        await useProjectStore
          .getState()
          .applyProjectDocumentPatch({ globalOrc: 'first' }, { label: 'First' });
      });
      await f.flush();
      if (alreadyDirty) {
        await act(async () => {
          await useProjectStore
            .getState()
            .applyProjectDocumentPatch({ globalOrc: 'second' }, { label: 'Second' });
        });
        await f.flush();
      }
      await act(async () => executeProjectUndo());
      const before = f.state();
      const beforeHistory = f.history.read();
      expect(f.history.isDirty()).toBe(alreadyDirty);
      expect(beforeHistory.canRedo).toBe(true);
      const element = mountTimeline(f, kind === 'marker-move' ? 'marker' : kind);
      if (kind === 'marker') mouse(element, 'mousedown', 100, 10, true);
      else if (kind === 'marker-move')
        mouse(
          [...element.querySelectorAll('span')].find((node) => node.textContent === 'Intro')!,
          'mousedown',
          40,
        );
      else if (kind === 'ruler') mouse(element, 'mousedown', 40);
      else mouse(element, 'mousedown', 80, tempoToScreenY(120, TEMPO_LINE_VIEW_HEIGHT));
      mouse(
        window,
        'mousemove',
        kind === 'tempo' ? 110 : 140,
        kind === 'tempo' ? tempoToScreenY(120, TEMPO_LINE_VIEW_HEIGHT) : 10,
      );
      await f.flush();
      expect(f.state()).not.toBe(before);
      escape();
      await f.flush();
      expect(f.state()).toBe(before);
      expect(f.history.isDirty()).toBe(alreadyDirty);
      expect(f.history.read()).toMatchObject({
        length: beforeHistory.length,
        cursor: beforeHistory.cursor,
        canRedo: true,
        redoLabel: beforeHistory.redoLabel,
      });
    },
  );
});

function editorTarget(
  editorObjectType: 'LineObject' | 'JMask' | 'PianoRoll',
): ScoreObjectEditorTargetSnapshot {
  return {
    selectionId: 'stable-object',
    selectedObjectType: editorObjectType,
    editorObjectType,
    ownerKind: 'timeline',
    displayContext: 'timeline',
    location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    supportsTimeBehavior: true,
    supportsRepeatPoint: true,
    supportsNoteProcessorChain: true,
  };
}

function mountObjectEditor(
  f: ReturnType<typeof fixture>,
  kind: 'LineObject' | 'JMask' | 'PianoRoll',
) {
  const target = editorTarget(kind);
  const doc = createScoreObjectEditorDocument(f.session.read().data!, { target })!;
  expect(doc.editor.kind).toBe('structured');
  const onPatch = (
    patch: NonNullable<ProjectDocumentPatch['score']>,
    metadata?: ProjectDocumentCommitMetadata,
  ) => {
    void useProjectStore.getState().applyProjectDocumentPatch({ score: patch }, metadata);
  };
  const Editor =
    kind === 'LineObject' ? LineObjectEditor : kind === 'JMask' ? JMaskEditor : PianoRollEditor;
  act(() => f.root.render(<Editor document={doc} onPatch={onPatch} />));
}

describe('score-object gesture → document queue → canonical history', () => {
  it('discards a line draft when the same editor switches targets', async () => {
    const createLine = () => {
      const line = new LineObject();
      line.addLine({
        varName: 'line0',
        min: 0,
        max: 1,
        color: -1,
        rightBound: true,
        endPointsLinked: false,
        points: [
          { x: 0, y: 0.2 },
          { x: 1, y: 0.8 },
        ],
      });
      return line;
    };
    const first = editorTarget('LineObject');
    const second = {
      ...first,
      selectionId: 'second-object',
      location: { ...first.location!, objectIndex: 1 },
    };
    const f = fixture(createLine(), (data) => {
      const other = createLine();
      assignExplicitScoreObjectId(other, 'second-object');
      ((data.getScore()[0] as PolyObject)[0] as SoundLayer).push(other);
    });
    const onPatch = (
      patch: NonNullable<ProjectDocumentPatch['score']>,
      metadata?: ProjectDocumentCommitMetadata,
    ) => {
      void useProjectStore.getState().applyProjectDocumentPatch({ score: patch }, metadata);
    };
    const renderTarget = (target: ScoreObjectEditorTargetSnapshot) => {
      const doc = createScoreObjectEditorDocument(f.session.read().data!, { target })!;
      act(() => f.root.render(<LineObjectEditor document={doc} onPatch={onPatch} />));
    };
    renderTarget(first);
    const svg = f.container.querySelector('svg polyline')!.ownerSVGElement!;
    rect(svg, 800, 360);
    const baseline = f.state();
    mouse(svg, 'mousedown', 400, 180);
    mouse(window, 'mousemove', 400, 120);
    renderTarget(second);
    mouse(window, 'mouseup', 400, 120);
    await f.flush();
    expect(f.state()).toBe(baseline);
    expect(f.history.read().length).toBe(0);
  });

  it('discards a JMask table draft when the same editor switches targets', async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    document.documentElement.style.setProperty('--text-role-subheadline', '11px');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      save() {},
      restore() {},
      scale() {},
      clearRect() {},
      fillRect() {},
      strokeRect() {},
      stroke() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      arc() {},
      fill() {},
      fillText() {},
    } as unknown as CanvasRenderingContext2D);
    const first = editorTarget('JMask');
    const second = {
      ...first,
      selectionId: 'second-object',
      location: { ...first.location!, objectIndex: 1 },
    };
    const f = fixture(new JMask(), (data) => {
      const other = new JMask();
      assignExplicitScoreObjectId(other, 'second-object');
      ((data.getScore()[0] as PolyObject)[0] as SoundLayer).push(other);
      for (const target of [first, second]) {
        const doc = createScoreObjectEditorDocument(data, { target })!;
        if (doc.editor.kind !== 'structured') throw new Error('JMask fixture is not structured');
        const field = structuredClone(doc.editor.payload.field) as FieldSnapshot;
        field.parameters[0] = {
          ...createDefaultParameterSnapshot('Segment'),
          name: field.parameters[0]!.name,
          visible: true,
        };
        applyProjectDocumentPatch(data, {
          score: { type: 'updateTypeSpecificEditor', target, patch: { field } },
        });
      }
    });
    const onPatch = (
      patch: NonNullable<ProjectDocumentPatch['score']>,
      metadata?: ProjectDocumentCommitMetadata,
    ) => {
      void useProjectStore.getState().applyProjectDocumentPatch({ score: patch }, metadata);
    };
    const renderTarget = (target: ScoreObjectEditorTargetSnapshot) => {
      const doc = createScoreObjectEditorDocument(f.session.read().data!, { target })!;
      act(() => f.root.render(<JMaskEditor document={doc} onPatch={onPatch} />));
    };
    renderTarget(first);
    const canvas = f.container.querySelector('canvas')!;
    rect(canvas, 400, 100);
    const baseline = f.state();
    mouse(canvas, 'mousedown', 200, 50);
    mouse(window, 'mousemove', 200, 30);
    renderTarget(second);
    mouse(window, 'mouseup', 200, 30);
    await f.flush();
    expect(f.state()).toBe(baseline);
    expect(f.history.read().length).toBe(0);
  });

  it.each(['LineObject', 'JMask', 'PianoRoll'] as const)(
    'commits %s drafts once and restores canonical content and identity',
    async (kind) => {
      let object: SoundObject;
      if (kind === 'LineObject') {
        const line = new LineObject();
        line.addLine({
          varName: 'line0',
          min: 0,
          max: 1,
          color: -1,
          rightBound: true,
          endPointsLinked: false,
          points: [
            { x: 0, y: 0.2 },
            { x: 1, y: 0.8 },
          ],
        });
        object = line;
      } else if (kind === 'JMask') {
        object = new JMask();
        vi.stubGlobal(
          'ResizeObserver',
          class {
            observe() {}
            disconnect() {}
          },
        );
        document.documentElement.style.setProperty('--text-role-subheadline', '11px');
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
          save() {},
          restore() {},
          scale() {},
          clearRect() {},
          fillRect() {},
          strokeRect() {},
          stroke() {},
          beginPath() {},
          moveTo() {},
          lineTo() {},
          arc() {},
          fill() {},
          fillText() {},
        } as unknown as CanvasRenderingContext2D);
      } else {
        const roll = new PianoRoll();
        roll.setPchGenerationMethod(2);
        roll.setSnapEnabled(false);
        const note = new PianoNote();
        note.start = 1;
        note.initFields(roll.getFieldDefinitions());
        roll.addNote(note);
        object = roll;
      }
      const f = fixture(
        object,
        kind === 'JMask'
          ? (data) => {
              const target = editorTarget('JMask');
              const doc = createScoreObjectEditorDocument(data, { target })!;
              if (doc.editor.kind !== 'structured')
                throw new Error('JMask fixture is not structured');
              const field = structuredClone(doc.editor.payload.field) as FieldSnapshot;
              const original = field.parameters[0]!;
              field.parameters[0] = {
                ...createDefaultParameterSnapshot('Segment'),
                name: original.name,
                visible: true,
              };
              applyProjectDocumentPatch(data, {
                score: { type: 'updateTypeSpecificEditor', target, patch: { field } },
              });
            }
          : undefined,
      );
      mountObjectEditor(f, kind);
      const before = f.state();
      const id = f.identity();
      let element: Element;
      let startX: number;
      let startY: number;
      let endX: number;
      let endY: number;
      if (kind === 'LineObject') {
        element = f.container.querySelector('svg polyline')!.ownerSVGElement!;
        rect(element, 800, 360);
        startX = 400;
        startY = 180;
        endX = 400;
        endY = 120;
      } else if (kind === 'JMask') {
        element = f.container.querySelector('canvas')!;
        expect(element).toBeTruthy();
        rect(element, 400, 100);
        startX = 200;
        startY = 50;
        endX = 200;
        endY = 30;
      } else {
        const noteElement = f.container.querySelector('[title^="Note:"]')!;
        expect(noteElement).toBeTruthy();
        element = noteElement.parentElement!;
        rect(element, 800, 1920);
        startX = 74;
        startY = 470;
        endX = 138;
        endY = 440;
      }
      mouse(element, 'mousedown', startX, startY);
      mouse(window, 'mousemove', endX, endY);
      expect(f.state()).toBe(before);
      expect(f.history.read().length).toBe(0);
      escape();
      await f.flush();
      expect(f.state()).toBe(before);
      expect(f.history.isDirty()).toBe(false);
      expect(f.history.read().length).toBe(0);
      for (const value of ['first', 'second']) {
        await act(async () => {
          await useProjectStore
            .getState()
            .applyProjectDocumentPatch({ globalOrc: value }, { label: value });
        });
        await f.flush();
      }
      await act(async () => executeProjectUndo());
      const dirtyBaseline = f.state();
      const priorHistory = f.history.read();
      expect(f.history.isDirty()).toBe(true);
      expect(priorHistory.canRedo).toBe(true);
      mouse(element, 'mousedown', startX, startY);
      mouse(window, 'mousemove', endX, endY);
      escape();
      await f.flush();
      expect(f.state()).toBe(dirtyBaseline);
      expect(f.history.isDirty()).toBe(true);
      expect(f.history.read()).toMatchObject({
        length: priorHistory.length,
        cursor: priorHistory.cursor,
        canRedo: true,
        redoLabel: priorHistory.redoLabel,
      });
      await act(async () => executeProjectUndo());
      expect(f.state()).toBe(before);
      mouse(element, 'mousedown', startX, startY);
      mouse(window, 'mousemove', endX, endY);
      mouse(window, 'mouseup', endX, endY);
      await f.flush();
      const committed = f.state();
      expect(committed).not.toBe(before);
      expect(f.history.read()).toMatchObject({
        length: 1,
        undoLabel:
          kind === 'LineObject'
            ? 'Edit Line'
            : kind === 'JMask'
              ? 'Edit JMask Field'
              : 'Edit notes',
      });
      expect(f.identity()).toBe(id);
      await act(async () => executeProjectUndo());
      expect(f.state()).toBe(before);
      expect(f.identity()).toBe(id);
      expect(f.history.isDirty()).toBe(false);
      await act(async () => executeProjectRedo());
      expect(f.state()).toBe(committed);
      expect(f.identity()).toBe(id);
    },
  );
});
