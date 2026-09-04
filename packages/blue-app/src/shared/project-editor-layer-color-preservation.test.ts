import { describe, expect, it } from 'vitest';
import { BlueData, GenericScore, AudioClip, TimePosition, TimeDuration } from '@blue/data';
import { applyProjectDocumentPatch, type ProjectDocumentPatch } from './project-editor';
import { createTestProjectWithLayers } from './project-editor-layer-color-test-utils';

describe('Project Editor Layer Color Preservation (US2)', () => {
  it('preserves existing item colors when layer color changes', () => {
    const { data, soundLayer, polyGroupId } = createTestProjectWithLayers();
    const item = soundLayer[0];
    item.setBackgroundColor(0xabcdef);

    const patch: ProjectDocumentPatch = {
      projectSessionId: 0,
      projectRevision: 0,
      score: {
        type: 'updateLayerState',
        groupId: polyGroupId,
        layerIndex: 0,
        patch: { backgroundColor: 0x990000 },
      },
    };

    expect(applyProjectDocumentPatch(data, patch)).toBe(true);
    expect(soundLayer.getBackgroundColor()).toBe(-6750208); // normalized 0x990000
    expect(item.getBackgroundColor()).toBe(0xabcdef);
  });

  it('preserves item color across cross-layer move operations', () => {
    const { data, polyGroup, polyGroupId } = createTestProjectWithLayers();
    // Add second layer to polyGroup
    const destLayer = polyGroup.newLayerAt(1);
    destLayer.setName('Destination Layer');
    destLayer.setBackgroundColor(0x00ff00); // Green

    const sourceLayer = polyGroup[0];
    sourceLayer.setBackgroundColor(0xff0000); // Red
    const item = sourceLayer[0];
    item.setBackgroundColor(0x123456); // Custom blue

    const patch: ProjectDocumentPatch = {
      projectSessionId: 0,
      projectRevision: 0,
      score: {
        type: 'moveScoreObjects',
        moves: [
          {
            target: {
              selectionId: 'score-1',
              selectedObjectType: 'GenericScore',
              editorObjectType: 'GenericScore',
              ownerKind: 'timeline',
              displayContext: 'timeline',
              location: {
                rootGroupIndex: 0,
                containerPath: [],
                layerIndex: 0,
                objectIndex: 0,
              },
            },
            targetGroupId: polyGroupId,
            targetLayerIndex: 1,
            targetStartBeats: 10,
          },
        ],
      },
    };

    expect(applyProjectDocumentPatch(data, patch)).toBe(true);
    expect(destLayer.length).toBe(1);
    const moved = destLayer[0];
    expect(moved.getBackgroundColor()).toBe(0x123456);
  });

  it('preserves serialized XML item color when added to a differently colored destination layer', () => {
    const { data, soundLayer, polyGroupId } = createTestProjectWithLayers();
    soundLayer.setBackgroundColor(0x00ff00); // Destination is green

    const existing = new GenericScore();
    existing.setName('Imported Sound Object');
    existing.setBackgroundColor(0x9900aa); // Purple
    const serializedXml = existing.saveAsXML().toXml();

    const patch: ProjectDocumentPatch = {
      projectSessionId: 0,
      projectRevision: 0,
      score: {
        type: 'addScoreObjects',
        groupId: polyGroupId,
        objects: [
          {
            layerIndex: 0,
            objectType: 'GenericScore',
            name: 'Pasted Item',
            startBeats: 12,
            durationBeats: 4,
            serializedXml,
          },
        ],
      },
    };

    expect(applyProjectDocumentPatch(data, patch)).toBe(true);
    const pasted = soundLayer[soundLayer.length - 1];
    expect(pasted.getName()).toBe('Pasted Item');
    expect(pasted.getBackgroundColor()).toBe(0x9900aa);
  });

  it('preserves source-target duplicated item color when copied to a differently colored layer', () => {
    const { data, polyGroup, soundLayer, polyGroupId } = createTestProjectWithLayers();
    soundLayer.setBackgroundColor(0x111111);
    const original = soundLayer[0];
    original.setBackgroundColor(0x778899);

    const destLayer = polyGroup.newLayerAt(1);
    destLayer.setName('Duplication Layer');
    destLayer.setBackgroundColor(0xff0000); // Red

    const patch: ProjectDocumentPatch = {
      projectSessionId: 0,
      projectRevision: 0,
      score: {
        type: 'addScoreObjects',
        groupId: polyGroupId,
        objects: [
          {
            layerIndex: 1,
            objectType: 'GenericScore',
            name: 'Duplicate Item',
            startBeats: 6,
            durationBeats: 2,
            sourceTarget: {
              selectionId: 'sobj-0',
              selectedObjectType: 'GenericScore',
              editorObjectType: 'GenericScore',
              ownerKind: 'timeline',
              displayContext: 'timeline',
              location: {
                rootGroupIndex: 0,
                containerPath: [],
                layerIndex: 0,
                objectIndex: 0,
              },
            },
          },
        ],
      },
    };

    expect(applyProjectDocumentPatch(data, patch)).toBe(true);
    expect(destLayer.length).toBe(1);
    const duplicated = destLayer[0];
    expect(duplicated.getBackgroundColor()).toBe(0x778899);
  });
});
