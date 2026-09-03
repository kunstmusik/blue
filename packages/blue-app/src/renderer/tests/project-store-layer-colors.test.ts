// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_LAYER_COLOR,
} from '@blue/data';
import { useProjectStore } from '../stores/project-store';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';
import {
  createMockScoreLayerSnapshot,
  createMockScoreRowObjectSnapshot,
} from '../../shared/project-editor-layer-color-test-utils';

function createScoreProjectSnapshot() {
  const snapshot = createEmptyProjectEditorSnapshot();
  snapshot.loaded = true;
  snapshot.sessionId = 1;
  const initialItem = createMockScoreRowObjectSnapshot({
    objectId: 'existing-item-1',
    backgroundColor: 0x666699,
  });
  snapshot.score!.layerGroups = [
    {
      groupId: 'poly-group-0',
      groupType: 'polyObject',
      name: 'Poly Group',
      layerCount: 1,
      isOpenableContainer: true,
      layers: [
        createMockScoreLayerSnapshot({
          layerId: 'layer-0',
          name: 'Layer 0',
          backgroundColor: DEFAULT_LAYER_COLOR,
          items: [initialItem],
        }),
      ],
    },
  ];
  return snapshot;
}

describe('project-store layer colors optimistic updates', () => {
  beforeEach(() => {
    useProjectStore.getState().clearProject();
  });

  afterEach(() => {
    useProjectStore.getState().clearProject();
  });

  it('optimistically updates layer backgroundColor and preserves existing item colors', async () => {
    const snapshot = createScoreProjectSnapshot();
    useProjectStore.getState().applyMissingAudioResolvedSnapshot(snapshot);

    const targetLayer = useProjectStore.getState().score!.layerGroups[0].layers[0];
    expect(targetLayer.backgroundColor).toBe(DEFAULT_LAYER_COLOR);
    const existingItem = targetLayer.items[0];
    expect(existingItem.backgroundColor).toBe(0x666699);

    // Apply optimistic patch
    await useProjectStore.getState().applyProjectDocumentPatch({
      score: {
        type: 'updateLayerState',
        groupId: 'poly-group-0',
        layerIndex: 0,
        patch: {
          backgroundColor: 0x00ff00, // Green (-16711936)
        },
      },
    });

    const updatedLayer = useProjectStore.getState().score!.layerGroups[0].layers[0];
    expect(updatedLayer.backgroundColor).toBe(-16711936);
    // Existing item retains its independent color
    expect(updatedLayer.items[0].backgroundColor).toBe(0x666699);
  });

  it('defaults a genuinely new score object to the destination layer color when color is omitted', () => {
    const snapshot = createScoreProjectSnapshot();
    // Set layer color to custom blue: -16776961
    snapshot.score!.layerGroups[0].layers[0].backgroundColor = -16776961;
    useProjectStore.getState().applyMissingAudioResolvedSnapshot(snapshot);

    useProjectStore.getState().addScoreObjects([
      {
        groupId: 'poly-group-0',
        layerIndex: 0,
        name: 'New Item Without Color',
        objectType: 'GenericScore',
        startBeats: 4,
        durationBeats: 2,
        isContainer: false,
        // backgroundColor is omitted
      } as unknown as Parameters<ReturnType<typeof useProjectStore.getState>['addScoreObjects']>[0][0],
    ]);

    const layers = useProjectStore.getState().score!.layerGroups[0].layers;
    expect(layers[0].items.length).toBe(2);
    const newItem = layers[0].items[1];
    expect(newItem.name).toBe('New Item Without Color');
    expect(newItem.backgroundColor).toBe(-16776961);
  });

  it('preserves explicit backgroundColor on new score object', () => {
    const snapshot = createScoreProjectSnapshot();
    snapshot.score!.layerGroups[0].layers[0].backgroundColor = -16776961;
    useProjectStore.getState().applyMissingAudioResolvedSnapshot(snapshot);

    useProjectStore.getState().addScoreObjects([
      {
        groupId: 'poly-group-0',
        layerIndex: 0,
        name: 'New Item With Explicit Color',
        objectType: 'GenericScore',
        startBeats: 4,
        durationBeats: 2,
        backgroundColor: 0xff0000,
        isContainer: false,
      } as unknown as Parameters<ReturnType<typeof useProjectStore.getState>['addScoreObjects']>[0][0],
    ]);

    const layers = useProjectStore.getState().score!.layerGroups[0].layers;
    const newItem = layers[0].items[1];
    expect(newItem.backgroundColor).toBe(0xff0000);
  });
});
