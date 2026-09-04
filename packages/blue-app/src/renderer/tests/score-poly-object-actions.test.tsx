// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  BlueData,
  Element,
  GenericScore,
  Instance,
  PolyObject,
  TimeBase,
  TimePosition,
  TimeDuration,
} from '@blue/data';
import {
  applyProjectDocumentPatch,
  createProjectEditorSnapshot,
} from '../../shared/project-editor';
import { createPolyObjectPasteObjectFromClipboard } from '../components/workbench/panels/score/layer-groups/score-clipboard-utils';
import type { ScoreObjectClipboardEntry } from '../stores/score-selection-store';
import type { ScoreLayerGroupSnapshot } from '../components/workbench/panels/score/types';

describe('PolyObject score context actions', () => {
  it('convertToPolyObject patch wraps score objects into a normalized PolyObject', async () => {
    const data = new BlueData();
    const score = data.getScore();
    const topPoly = new PolyObject(true);
    score.length = 0;
    score.push(topPoly);

    // Ensure topPoly has 2 layers
    topPoly.newLayerAt(-1);
    topPoly.newLayerAt(-1);

    const obj1 = new GenericScore();
    obj1.setName('Obj 1');
    obj1.setStartTime(TimePosition.beats(2.0));
    obj1.setSubjectiveDuration(TimeDuration.beats(4.0));

    const obj2 = new GenericScore();
    obj2.setName('Obj 2');
    obj2.setStartTime(TimePosition.beats(5.0));
    obj2.setSubjectiveDuration(TimeDuration.beats(3.0));

    topPoly[0].push(obj1);
    topPoly[1].push(obj2);

    expect(topPoly[0].length).toBe(1);
    expect(topPoly[1].length).toBe(1);

    const targets = [
      {
        selectionId: 'obj1',
        selectedObjectType: 'GenericScore',
        editorObjectType: 'GenericScore',
        ownerKind: 'timeline' as const,
        displayContext: 'timeline' as const,
        location: {
          rootGroupIndex: 0,
          containerPath: [],
          layerIndex: 0,
          objectIndex: 0,
        },
      },
      {
        selectionId: 'obj2',
        selectedObjectType: 'GenericScore',
        editorObjectType: 'GenericScore',
        ownerKind: 'timeline' as const,
        displayContext: 'timeline' as const,
        location: {
          rootGroupIndex: 0,
          containerPath: [],
          layerIndex: 1,
          objectIndex: 0,
        },
      },
    ];

    const snapshot = createProjectEditorSnapshot(data, null);
    const targetGroupId = snapshot.score.layerGroups[0].groupId;

    const patchResult = applyProjectDocumentPatch(data, {
      score: {
        type: 'convertToPolyObject',
        targets,
        targetGroupId,
        targetLayerIndex: 0,
        selectionId: 'converted_poly',
      },
    });

    expect(patchResult).toBe(true);

    // Originals removed from layer 0 and layer 1
    expect(topPoly[0].length).toBe(1); // The new PolyObject placed on layer 0
    expect(topPoly[1].length).toBe(0);

    const createdPoly = topPoly[0][0] as PolyObject;
    expect(createdPoly).toBeInstanceOf(PolyObject);
    expect(createdPoly.getStartTime().toBeats(score.getTimeContext())).toBeCloseTo(2.0);
    // Obj 1 (start 2.0, dur 4.0) and Obj 2 (start 5.0, dur 3.0) -> max end is 8.0 -> duration = 8.0 - 2.0 = 6.0
    expect(createdPoly.getSubjectiveDuration().toBeats(score.getTimeContext())).toBeCloseTo(6.0);

    // Check inner objects
    expect(createdPoly.length).toBe(2); // 2 layers created inside
    expect(createdPoly[0][0].getName()).toBe('Obj 1');
    expect(createdPoly[0][0].getStartTime().toBeats(score.getTimeContext())).toBeCloseTo(0.0);
    expect(createdPoly[1][0].getName()).toBe('Obj 2');
    expect(createdPoly[1][0].getStartTime().toBeats(score.getTimeContext())).toBeCloseTo(3.0);
  });

  it('createPolyObjectPasteObjectFromClipboard builds a valid ScorePasteObject with normalized PolyObject XML', () => {
    const clipboard: ScoreObjectClipboardEntry[] = [
      {
        objectId: 'c1',
        objectType: 'GenericScore',
        name: 'Copied 1',
        startBeats: 4.0,
        durationBeats: 2.0,
        backgroundColor: 0x336699,
        isContainer: false,
        layerIndex: 0,
        groupId: 'g0',
      },
      {
        objectId: 'c2',
        objectType: 'GenericScore',
        name: 'Copied 2',
        startBeats: 6.0,
        durationBeats: 3.0,
        backgroundColor: 0x336699,
        isContainer: false,
        layerIndex: 1,
        groupId: 'g0',
      },
    ];

    const layerGroups: ScoreLayerGroupSnapshot[] = [
      {
        groupId: 'g0',
        groupType: 'polyObject',
        name: 'Poly 1',
        layers: [
          { layerId: 'l0', name: 'L0', height: 32, items: [] },
          { layerId: 'l1', name: 'L1', height: 32, items: [] },
        ],
      },
    ];

    const result = createPolyObjectPasteObjectFromClipboard({
      clipboard,
      layerGroups,
      targetGroupId: 'g0',
      targetLayerIndex: 0,
      targetXBeats: 10.0,
      snapBeatValue: (b) => Math.round(b),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.pasteObject.objectType).toBe('PolyObject');
    expect(result.pasteObject.startBeats).toBe(10.0);
    expect(result.pasteObject.durationBeats).toBeCloseTo(5.0); // (6+3) - 4 = 5 beats duration
    expect(result.pasteObject.serializedXml).toContain('blue.soundObject.PolyObject');
    expect(result.pasteObject.serializedXml).toContain('Copied 1');
    expect(result.pasteObject.serializedXml).toContain('Copied 2');
  });

  it('rejects an invalid destination without removing any source objects', () => {
    const data = new BlueData();
    const score = data.getScore();
    const topPoly = new PolyObject(true);
    score.length = 0;
    score.push(topPoly);
    topPoly.newLayerAt(-1);

    const source = new GenericScore();
    source.setStartTime(TimePosition.beats(2));
    topPoly[0].push(source);

    const snapshot = createProjectEditorSnapshot(data, null);
    const target = snapshot.score.layerGroups[0]!.layers[0]!.items[0]!.editorTarget!;
    const result = applyProjectDocumentPatch(data, {
      score: {
        type: 'convertToPolyObject',
        targets: [target],
        targetGroupId: snapshot.score.layerGroups[0]!.groupId,
        targetLayerIndex: 99,
        selectionId: 'invalid_conversion',
      },
    });

    expect(result).toBe(false);
    expect(topPoly[0]).toHaveLength(1);
    expect(topPoly[0][0]).toBe(source);
  });

  it('converts an Instance by moving the timeline instance and preserving its library target', () => {
    const data = new BlueData();
    const score = data.getScore();
    const topPoly = new PolyObject(true);
    score.length = 0;
    score.push(topPoly);
    topPoly.newLayerAt(-1);

    const definition = new GenericScore();
    definition.setName('Shared definition');
    const libraryId = data.getSoundObjectLibrary().addObject(definition);
    const instance = new Instance();
    instance.setLibraryId(libraryId);
    instance.setSoundObject(definition);
    instance.setStartTime(TimePosition.beats(3));
    topPoly[0].push(instance);

    const snapshot = createProjectEditorSnapshot(data, null);
    const target = snapshot.score.layerGroups[0]!.layers[0]!.items[0]!.editorTarget!;
    expect(target.displayContext).toBe('instance');

    const result = applyProjectDocumentPatch(data, {
      score: {
        type: 'convertToPolyObject',
        targets: [target],
        targetGroupId: snapshot.score.layerGroups[0]!.groupId,
        targetLayerIndex: 0,
        selectionId: 'instance_conversion',
      },
    });

    expect(result).toBe(true);
    expect(topPoly[0]).toHaveLength(1);
    const converted = topPoly[0][0] as PolyObject;
    expect(converted[0][0]).toBe(instance);
    expect((converted[0][0] as Instance).getSoundObject()).toBe(definition);
    expect((converted[0][0] as Instance).getLibraryId()).toBe(libraryId);
  });

  it('rejects mixed AudioClip clipboard content instead of dropping it', () => {
    const layerGroups: ScoreLayerGroupSnapshot[] = [
      {
        groupId: 'g0',
        groupType: 'polyObject',
        name: 'Poly 1',
        layers: [{ layerId: 'l0', name: 'L0', height: 32, items: [] }],
      },
    ];
    const clipboard: ScoreObjectClipboardEntry[] = [
      {
        objectId: 'sound',
        objectType: 'GenericScore',
        name: 'Sound',
        startBeats: 0,
        durationBeats: 1,
        backgroundColor: 0,
        isContainer: false,
        layerIndex: 0,
        groupId: 'g0',
      },
      {
        objectId: 'clip',
        objectType: 'AudioClip',
        name: 'Clip',
        startBeats: 0,
        durationBeats: 1,
        backgroundColor: 0,
        isContainer: false,
        layerIndex: 0,
        groupId: 'g0',
      },
    ];

    const result = createPolyObjectPasteObjectFromClipboard({
      clipboard,
      layerGroups,
      targetGroupId: 'g0',
      targetLayerIndex: 0,
      targetXBeats: 0,
      snapBeatValue: (beats) => beats,
    });

    expect(result.ok).toBe(false);
  });

  it('preserves serialized non-beat child durations while normalizing paste timing', () => {
    const source = new GenericScore();
    source.setStartTime(TimePosition.beats(4));
    source.setSubjectiveDuration(TimeDuration.time(0, 0, 2, 0));

    const result = createPolyObjectPasteObjectFromClipboard({
      clipboard: [
        {
          objectId: 'time-object',
          objectType: 'GenericScore',
          name: 'Time object',
          startBeats: 4,
          durationBeats: 1,
          durationTimeBase: TimeBase.TIME,
          backgroundColor: 0,
          isContainer: false,
          layerIndex: 0,
          groupId: 'g0',
          serializedXml: source.saveAsXML().toXml(),
        },
      ],
      layerGroups: [
        {
          groupId: 'g0',
          groupType: 'polyObject',
          name: 'Poly 1',
          layers: [{ layerId: 'l0', name: 'L0', height: 32, items: [] }],
        },
      ],
      targetGroupId: 'g0',
      targetLayerIndex: 0,
      targetXBeats: 0,
      snapBeatValue: (beats) => beats,
    });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.pasteObject.serializedXml) return;

    const pasted = PolyObject.loadFromXML(Element.parse(result.pasteObject.serializedXml));
    const duration = pasted[0]![0]!.getSubjectiveDuration();
    expect(duration.getTimeBase()).toBe(TimeBase.TIME);
    expect(duration.toTotalSecondsValue()).toBe(2);
  });

  it('recomputes a pasted PolyObject envelope in the canonical project time context', () => {
    const data = new BlueData();
    const score = data.getScore();
    const context = score.getTimeContext();
    context.getTempoMap().setTempo(120);
    context.getTempoMap().setEnabled(true);

    const topPoly = new PolyObject(true);
    score.length = 0;
    score.push(topPoly);
    topPoly.newLayerAt(-1);

    const source = new GenericScore();
    source.setSubjectiveDuration(TimeDuration.time(0, 0, 2, 0));
    topPoly[0].push(source);

    const snapshot = createProjectEditorSnapshot(data, null);
    const group = snapshot.score.layerGroups[0]!;
    const item = group.layers[0]!.items[0]!;
    const pasteResult = createPolyObjectPasteObjectFromClipboard({
      clipboard: [
        {
          objectId: item.objectId,
          objectType: item.objectType,
          name: item.name,
          startBeats: item.startBeats,
          durationBeats: item.durationBeats,
          durationTimeBase: item.durationTimeBase,
          backgroundColor: item.backgroundColor,
          isContainer: item.isContainer,
          layerIndex: 0,
          groupId: group.groupId,
          serializedXml: item.serializedXml,
        },
      ],
      layerGroups: snapshot.score.layerGroups,
      targetGroupId: group.groupId,
      targetLayerIndex: 0,
      targetXBeats: 6,
      snapBeatValue: (beats) => beats,
    });

    expect(pasteResult.ok).toBe(true);
    if (!pasteResult.ok) return;

    const changed = applyProjectDocumentPatch(data, {
      score: {
        type: 'addScoreObjects',
        groupId: group.groupId,
        objects: [pasteResult.pasteObject],
      },
    });

    expect(changed).toBe(true);
    const pasted = topPoly[0]![1] as PolyObject;
    expect(pasted.getSubjectiveDuration().toBeats(context)).toBeCloseTo(4);
  });

  it('resolves pasted Instance references against the canonical sound-object library', () => {
    const data = new BlueData();
    const score = data.getScore();
    const topPoly = new PolyObject(true);
    score.length = 0;
    score.push(topPoly);
    topPoly.newLayerAt(-1);

    const definition = new GenericScore();
    definition.setName('Paste target');
    const libraryId = data.getSoundObjectLibrary().addObject(definition);
    const sourceInstance = new Instance();
    sourceInstance.setLibraryId(libraryId);
    sourceInstance.setSoundObject(definition);
    sourceInstance.setStartTime(TimePosition.beats(2));
    topPoly[0].push(sourceInstance);

    const snapshot = createProjectEditorSnapshot(data, null);
    const group = snapshot.score.layerGroups[0]!;
    const item = group.layers[0]!.items[0]!;
    const entry: ScoreObjectClipboardEntry = {
      objectId: item.objectId,
      objectType: item.objectType,
      name: item.name,
      startBeats: item.startBeats,
      durationBeats: item.durationBeats,
      startTimeBase: item.startTimeBase,
      durationTimeBase: item.durationTimeBase,
      backgroundColor: item.backgroundColor,
      isContainer: item.isContainer,
      layerIndex: 0,
      groupId: group.groupId,
      editorTarget: item.editorTarget,
      serializedXml: item.serializedXml,
    };

    const pasteResult = createPolyObjectPasteObjectFromClipboard({
      clipboard: [entry],
      layerGroups: snapshot.score.layerGroups,
      targetGroupId: group.groupId,
      targetLayerIndex: 0,
      targetXBeats: 8,
      snapBeatValue: (beats) => beats,
    });

    expect(pasteResult.ok).toBe(true);
    if (!pasteResult.ok) return;

    const changed = applyProjectDocumentPatch(data, {
      score: {
        type: 'addScoreObjects',
        groupId: group.groupId,
        objects: [pasteResult.pasteObject],
      },
    });

    expect(changed).toBe(true);
    expect(topPoly[0]).toHaveLength(2);
    const pastedPoly = topPoly[0][1] as PolyObject;
    const pastedInstance = pastedPoly[0]![0] as Instance;
    expect(pastedInstance.getLibraryId()).toBe(libraryId);
    expect(pastedInstance.getSoundObject()).toBe(definition);
  });
});
