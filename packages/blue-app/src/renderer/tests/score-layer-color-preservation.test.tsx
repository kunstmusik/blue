import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { GenericScore } from '@blue/data';
import { useProjectStore } from '../stores/project-store';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';
import {
  createMockScoreLayerSnapshot,
  createMockScoreObjectTarget,
  createMockPatternLayerSnapshot,
  createMockScoreRowObjectSnapshot,
} from '../../shared/project-editor-layer-color-test-utils';

describe('Score Layer Color Preservation Journey (US2)', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      blueAPI: {
        commitProjectDocumentPatches: vi.fn(async () => ({ revision: 1, sessionId: 0, changed: true })),
        getProjectDocument: vi.fn(),
      },
    });
    useProjectStore.getState().clearProject();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('new item adopts destination layer color while transferred/pasted item retains explicit color', async () => {
    const snapshot = createEmptyProjectEditorSnapshot();
    snapshot.score.layerGroups = [
      {
        groupId: 'sound-group',
        groupType: 'polyObject',
        name: 'SoundObjects',
        layerCount: 2,
        isOpenableContainer: true,
        layers: [
          createMockScoreLayerSnapshot({
            layerId: 'layer-0',
            name: 'Layer 1 (Red)',
            backgroundColor: -65536, // Red
            items: [
              createMockScoreRowObjectSnapshot({
                id: 'item-0',
                name: 'Item 1',
                backgroundColor: -16711936, // Green
                layerIndex: 0,
              }),
            ],
          }),
          createMockScoreLayerSnapshot({
            layerId: 'layer-1',
            name: 'Layer 2 (Blue)',
            backgroundColor: -16776961, // Blue
            items: [],
          }),
        ],
      },
    ];

    useProjectStore.getState().setProjectInfo({
      title: 'Test',
      sessionId: 1,
      loaded: true,
      score: snapshot.score,
      orchestra: { ...snapshot.orchestra, loaded: true },
      projectProperties: snapshot.projectProperties,
      transport: snapshot.transport,
    } as any);

    // 1. Paste/transfer item to Layer 2 (Blue) with explicit color from source (Green)
    useProjectStore.getState().addScoreObjects([
      {
        groupId: 'sound-group',
        layerIndex: 1,
        name: 'Pasted Green Item',
        startBeats: 4,
        durationBeats: 2,
        backgroundColor: -16711936, // Retained Green
        objectType: 'GenericScore',
      },
    ]);

    const groupAfterPaste = useProjectStore.getState().score.layerGroups[0];
    const pastedItem = groupAfterPaste.layers[1].items[0];
    expect(pastedItem.name).toBe('Pasted Green Item');
    expect(pastedItem.backgroundColor).toBe(-16711936); // Retains Green, does NOT adopt Blue!

    // 2. Add genuinely new item to Layer 2 (Blue) without backgroundColor
    useProjectStore.getState().addScoreObjects([
      {
        groupId: 'sound-group',
        layerIndex: 1,
        name: 'Genuinely New Item',
        startBeats: 8,
        durationBeats: 2,
        objectType: 'GenericScore',
      },
    ]);

    const groupAfterNew = useProjectStore.getState().score.layerGroups[0];
    const newItem = groupAfterNew.layers[1].items[1];
    expect(newItem.name).toBe('Genuinely New Item');
    expect(newItem.backgroundColor).toBe(-16776961); // Adopts Layer 2's Blue!
  });

  it('keeps omitted source-target and serialized colors during optimistic transfer', () => {
    const snapshot = createEmptyProjectEditorSnapshot();
    const sourceTarget = createMockScoreObjectTarget({
      selectionId: 'source-item',
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    });
    const serializedSource = new GenericScore();
    serializedSource.setBackgroundColor(-256); // Yellow

    snapshot.score.layerGroups = [{
      groupId: 'sound-group',
      groupType: 'polyObject',
      name: 'SoundObjects',
      layerCount: 2,
      isOpenableContainer: true,
      layers: [
        createMockScoreLayerSnapshot({
          layerId: 'layer-0',
          backgroundColor: -65536, // Red
          items: [createMockScoreRowObjectSnapshot({
            objectId: 'source-item',
            backgroundColor: -16711936, // Green
            editorTarget: sourceTarget,
          })],
        }),
        createMockScoreLayerSnapshot({
          layerId: 'layer-1',
          backgroundColor: -16776961, // Blue
          items: [],
        }),
      ],
    }];

    useProjectStore.getState().setProjectInfo({
      title: 'Test',
      sessionId: 1,
      loaded: true,
      score: snapshot.score,
      orchestra: { ...snapshot.orchestra, loaded: true },
      projectProperties: snapshot.projectProperties,
      transport: snapshot.transport,
    } as any);

    useProjectStore.getState().addScoreObjects([
      {
        groupId: 'sound-group',
        layerIndex: 1,
        name: 'Source transfer',
        startBeats: 4,
        durationBeats: 2,
        objectType: 'GenericScore',
        isContainer: false,
        editorTarget: sourceTarget,
      },
      {
        groupId: 'sound-group',
        layerIndex: 1,
        name: 'Serialized transfer',
        startBeats: 8,
        durationBeats: 2,
        objectType: 'GenericScore',
        isContainer: false,
        serializedXml: serializedSource.saveAsXML().toXml(),
      },
    ]);

    const items = useProjectStore.getState().score.layerGroups[0].layers[1].items;
    expect(items[0]?.backgroundColor).toBe(-16711936);
    expect(items[1]?.backgroundColor).toBe(-256);
  });

  it('keeps an omitted Pattern-source color during optimistic transfer', () => {
    const snapshot = createEmptyProjectEditorSnapshot();
    const patternLayer = createMockPatternLayerSnapshot();
    patternLayer.sourceObject.backgroundColor = -256; // Yellow
    const patternSourceTarget = patternLayer.sourceObject.editorTarget;

    snapshot.score.layerGroups = [
      {
        groupId: 'sound-group',
        groupType: 'polyObject',
        name: 'SoundObjects',
        layerCount: 1,
        isOpenableContainer: true,
        layers: [createMockScoreLayerSnapshot({
          layerId: 'destination-layer',
          backgroundColor: -16776961, // Blue
          items: [],
        })],
      },
      {
        groupId: 'pattern-group-2',
        groupType: 'patterns',
        name: 'Patterns',
        layerCount: 1,
        isOpenableContainer: false,
        patternBeatsLength: 4,
        effectivePatternBeatsLength: 4,
        layers: [patternLayer],
      },
    ];

    useProjectStore.getState().setProjectInfo({
      title: 'Test',
      sessionId: 1,
      loaded: true,
      score: snapshot.score,
      orchestra: { ...snapshot.orchestra, loaded: true },
      projectProperties: snapshot.projectProperties,
      transport: snapshot.transport,
    } as any);

    useProjectStore.getState().addScoreObjects([{
      groupId: 'sound-group',
      layerIndex: 0,
      name: 'Pattern source transfer',
      startBeats: 4,
      durationBeats: 2,
      objectType: 'GenericScore',
      isContainer: false,
      editorTarget: patternSourceTarget,
    }]);

    const item = useProjectStore.getState().score.layerGroups[0].layers[0].items[0];
    expect(item?.backgroundColor).toBe(-256);
  });

  it('moving an item across layers preserves its original background color', async () => {
    const snapshot = createEmptyProjectEditorSnapshot();
    snapshot.score.layerGroups = [
      {
        groupId: 'sound-group',
        groupType: 'polyObject',
        name: 'SoundObjects',
        layerCount: 2,
        isOpenableContainer: true,
        layers: [
          createMockScoreLayerSnapshot({
            layerId: 'layer-0',
            name: 'Layer 1 (Red)',
            backgroundColor: -65536, // Red
            items: [
              createMockScoreRowObjectSnapshot({
                objectId: 'item-0',
                name: 'Custom Colored Item',
                backgroundColor: -16711681, // Cyan
                layerIndex: 0,
                startBeats: 0,
                durationBeats: 2,
              }),
            ],
          }),
          createMockScoreLayerSnapshot({
            layerId: 'layer-1',
            name: 'Layer 2 (Yellow)',
            backgroundColor: -256, // Yellow
            items: [],
          }),
        ],
      },
    ];

    useProjectStore.getState().setProjectInfo({
      title: 'Test',
      sessionId: 1,
      loaded: true,
      score: snapshot.score,
      orchestra: { ...snapshot.orchestra, loaded: true },
      projectProperties: snapshot.projectProperties,
      transport: snapshot.transport,
    } as any);

    // Optimistically move item from layer 0 to layer 1
    useProjectStore.getState().moveScoreObjects([
      {
        objectId: 'item-0',
        targetGroupId: 'sound-group',
        targetLayerIndex: 1,
        targetStartBeats: 4,
      },
    ]);

    const group = useProjectStore.getState().score.layerGroups[0];
    expect(group.layers[0].items.length).toBe(0);
    expect(group.layers[1].items.length).toBe(1);
    const movedItem = group.layers[1].items[0];
    expect(movedItem.name).toBe('Custom Colored Item');
    expect(movedItem.backgroundColor).toBe(-16711681); // Remains Cyan!
  });
});
