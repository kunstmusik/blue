// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  DEFAULT_LAYER_COLOR,
  SoundLayer,
  GenericInstrument,
  BlueSynthBuilder,
  type BlueData,
} from '@blue/data';
import { ProjectSession } from '../../main/project-session';
import { ProjectHistory } from '../../main/project-history';
import { MockHistoryContext } from '../../main/project-history-test-support';
import { createTestProjectWithLayers } from '../../shared/project-editor-layer-color-test-utils';
import {
  createProjectEditorSnapshot,
  type ProjectDocumentPatch,
} from '../../shared/project-editor';
import type { ProjectDocumentCommitMetadata } from '../../shared/project-history';
import { setProjectHistoryProjection } from '../hooks/use-project-history';
import { acceptProjectDocumentRevision, useProjectStore } from '../stores/project-store';

function fixture(configure?: (data: BlueData) => void) {
  const { data, polyGroup } = createTestProjectWithLayers();
  polyGroup.push(new SoundLayer());
  configure?.(data);
  const session = new ProjectSession();
  session.replace(data);
  const history = new ProjectHistory({ session });
  history.checkpointSave();
  const context = new MockHistoryContext('snapshot-types');
  const documentId = session.read().documentId!;
  const snapshot = () =>
    createProjectEditorSnapshot(session.read().data!, null, session.read().sessionId, documentId);
  const refresh = () => {
    useProjectStore.getState().setProjectInfo(snapshot());
    if (history.isDirty()) useProjectStore.getState().markDirty();
    acceptProjectDocumentRevision(session.read().sessionId, session.read().revision);
    setProjectHistoryProjection(history.read());
  };
  vi.stubGlobal('window', {
    blueAPI: {
      commitProjectDocumentPatches: async (
        patches: ProjectDocumentPatch[],
        metadata?: ProjectDocumentCommitMetadata,
      ) => {
        const result = await history.commit(
          context.nextCommitRequest(
            documentId,
            session.read().revision,
            metadata?.label ?? 'Edit',
            patches,
            metadata,
          ),
        );
        expect(result.status).toBe('committed');
        return result.status === 'committed' ? result.receipt : undefined;
      },
      getProjectDocument: async () => snapshot(),
    },
  });
  useProjectStore.getState().clearProject();
  refresh();
  const roundTrip = async (
    patch: ProjectDocumentPatch,
    label: string,
    assertOptimistic: () => void,
  ) => {
    const beforeSnapshot = snapshot();
    const before = beforeSnapshot.score;
    await useProjectStore.getState().applyProjectDocumentPatch(patch, { label, phase: 'single' });
    assertOptimistic();
    await useProjectStore.getState().flushPendingPatches();
    const afterSnapshot = snapshot();
    const after = afterSnapshot.score;
    expect(history.read().undoLabel).toBe(label);
    expect(history.isDirty()).toBe(true);
    expect(useProjectStore.getState().isDirty).toBe(true);
    expect(
      (await history.undo(context.nextUndoRequest(documentId, session.read().revision))).status,
    ).toBe('committed');
    refresh();
    expect(snapshot().score).toEqual(before);
    expect(snapshot().mixer).toEqual(beforeSnapshot.mixer);
    expect(snapshot().orchestra).toEqual(beforeSnapshot.orchestra);
    expect(useProjectStore.getState().score).toEqual(before);
    expect(history.isDirty()).toBe(false);
    expect(useProjectStore.getState().isDirty).toBe(false);
    expect(
      (await history.redo(context.nextRedoRequest(documentId, session.read().revision))).status,
    ).toBe('committed');
    refresh();
    expect(snapshot().score).toEqual(after);
    expect(snapshot().mixer).toEqual(afterSnapshot.mixer);
    expect(snapshot().orchestra).toEqual(afterSnapshot.orchestra);
    expect(useProjectStore.getState().score).toEqual(after);
    expect(history.isDirty()).toBe(true);
  };
  return { snapshot, roundTrip };
}

afterEach(() => {
  useProjectStore.getState().clearProject();
  setProjectHistoryProjection(null);
  vi.unstubAllGlobals();
});

it('projects a target-based score move immediately and preserves its identity through undo/redo', async () => {
  const { snapshot, roundTrip } = fixture();
  const group = snapshot().score.layerGroups[0];
  const item = group.layers[0].items[0];
  await roundTrip(
    {
      score: {
        type: 'moveScoreObjects',
        moves: [
          {
            target: item.editorTarget,
            targetGroupId: group.groupId,
            targetLayerIndex: 1,
            targetStartBeats: 10,
          },
        ],
      },
    },
    'Move Score Objects',
    () => {
      const layers = useProjectStore.getState().score.layerGroups[0].layers;
      expect(layers[0].items).toEqual([]);
      expect(layers[1].items[0]).toMatchObject({ objectId: item.objectId, startBeats: 10 });
    },
  );
});

it.each(['polyObject', 'track', 'patterns'] as const)(
  'projects complete new %s layers through undo/redo',
  async (groupType) => {
    const { snapshot, roundTrip } = fixture();
    const group = useProjectStore
      .getState()
      .score.layerGroups.find((group) => group.groupType === groupType)!;
    const existingLayers = group.layers;
    await roundTrip(
      { score: { type: 'addLayer', groupId: group.groupId, layerIndex: 0 } },
      'Add Layer',
      () => {
        const projected = useProjectStore
          .getState()
          .score.layerGroups.find((candidate) => candidate.groupId === group.groupId)!;
        expect(projected.layers[0]).toBe(existingLayers[0]);
        expect(projected.layers[1].backgroundColor).toBe(DEFAULT_LAYER_COLOR);
        if (projected.groupType === 'track')
          expect(projected.layers[1]).toMatchObject({ layerKind: 'track', instrument: null });
        if (projected.groupType === 'patterns')
          expect(projected.layers[1]).toMatchObject({
            items: [],
            activeCellIndices: [],
            sourceObject: expect.objectContaining({ objectType: 'GenericScore' }),
          });
      },
    );
  },
);

it('keeps mixer channel identity and settings when renumbering an instrument', async () => {
  const { snapshot, roundTrip } = fixture((data) => {
    data.getArrangement().addInstrument(new GenericInstrument(), '1');
    createProjectEditorSnapshot(data, null);
    data
      .getMixer()
      .getChannels()
      .find((channel) => channel.getAssociation() === '1')!
      .setLevel(-9);
  });
  const channel = snapshot().mixer.channels.find((channel) => channel.association === '1')!;
  await roundTrip(
    { orchestra: { type: 'updateAssignment', assignmentId: '1', nextAssignmentId: '7' } },
    'Renumber Instrument',
    () => {
      expect(useProjectStore.getState().mixer.channels[0]).toEqual({
        ...channel,
        association: '7',
        name: '7',
      });
    },
  );
});

it('uses canonical BSB grid defaults when converting a generic instrument', async () => {
  const { roundTrip } = fixture((data) => {
    data.getArrangement().addInstrument(new GenericInstrument(), '1');
  });
  await roundTrip(
    { orchestra: { type: 'convertGenericToBsb', assignmentId: '1' } },
    'Convert Instrument',
    () => {
      const converted = useProjectStore.getState().orchestra.instruments[0];
      expect(converted.type).toBe('blueSynthBuilder');
      if (converted.type === 'blueSynthBuilder')
        expect(converted.gridSettings).toEqual(
          new BlueSynthBuilder().getGraphicInterface().getGridSettings(),
        );
    },
  );
});
