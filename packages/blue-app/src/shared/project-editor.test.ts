import { describe, expect, it } from 'vitest';
import {
  BlueData,
  AudioClip,
  Channel,
  Effect,
  GenericInstrument,
  GenericScore,
  Instance,
  LiveObject,
  Parameter,
  PolyObject,
  TimeDuration,
  TimePosition,
  TrackLayerGroup,
} from '@blue/data';
import {
  applyProjectDocumentPatch,
  createBlueLiveEditorTargetSnapshot,
  createProjectEditorSnapshot,
  createScopedProjectEditorSnapshot,
  createScoreObjectPropertiesTarget,
  isEmptyProjectDocumentPatch,
  resolveEditorTarget,
  resolveTimelineScoreObjects,
} from './project-editor';

describe('resolveTimelineScoreObjects', () => {
  it('resolves snapshot IDs to the original timeline objects', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const group = new TrackLayerGroup();
    const track = group.newLayerAt(0);
    const score = new GenericScore();
    score.setStartTime(TimePosition.beats(1));
    score.setSubjectiveDuration(TimeDuration.beats(2));
    const clip = new AudioClip();
    clip.setAudioFile('/fixtures/audition.wav');
    track.push(score, clip);
    data.getScore().push(group);

    const snapshot = createProjectEditorSnapshot(data, null);
    const objectId = snapshot.score!.layerGroups[0]!.layers[0]!.items[0]!.objectId;
    const clipId = snapshot.score!.layerGroups[0]!.layers[0]!.items[1]!.objectId;

    expect(resolveTimelineScoreObjects(data, [objectId, clipId])).toEqual([score, clip]);
  });

  it('rejects duplicate and stale IDs without returning partial selections', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const group = new TrackLayerGroup();
    const track = group.newLayerAt(0);
    const score = new GenericScore();
    track.push(score);
    data.getScore().push(group);
    const snapshot = createProjectEditorSnapshot(data, null);
    const objectId = snapshot.score!.layerGroups[0]!.layers[0]!.items[0]!.objectId;

    expect(resolveTimelineScoreObjects(data, [objectId, objectId])).toBeNull();
    expect(resolveTimelineScoreObjects(data, [objectId, 'missing'])).toBeNull();
    expect(resolveTimelineScoreObjects(data, ['  '])).toBeNull();
  });
});

describe('Scratch Pad project bridge', () => {
  it('includes scratch pad data in snapshots and applies partial patches', () => {
    const data = new BlueData();
    data.getScratchPadData().setScratchText('Initial notes');
    data.getScratchPadData().setWordWrapEnabled(false);

    const snapshot = createProjectEditorSnapshot(data, null);
    expect(snapshot.scratchPad).toEqual({
      text: 'Initial notes',
      wordWrapEnabled: false,
    });

    expect(
      applyProjectDocumentPatch(data, {
        scratchPad: { text: 'Updated notes' },
      }),
    ).toBe(true);
    expect(data.getScratchPadData().getScratchText()).toBe('Updated notes');
    expect(data.getScratchPadData().isWordWrapEnabled()).toBe(false);

    expect(
      applyProjectDocumentPatch(data, {
        scratchPad: { wordWrapEnabled: true },
      }),
    ).toBe(true);
    expect(data.getScratchPadData().isWordWrapEnabled()).toBe(true);
    expect(
      applyProjectDocumentPatch(data, {
        scratchPad: {},
      }),
    ).toBe(false);
    expect(isEmptyProjectDocumentPatch({ scratchPad: {} })).toBe(true);
  });
});

describe('Lazy XML omission for project snapshots', () => {
  it('omits eager score, Blue Live, and effect XML when includeSerializedXml is false and resolves XML on demand', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const group = new TrackLayerGroup();
    const track = group.newLayerAt(0);
    const score = new GenericScore();
    score.setName('Score Phrase');
    score.setStartTime(TimePosition.beats(0));
    score.setSubjectiveDuration(TimeDuration.beats(4));
    track.push(score);
    data.getScore().push(group);

    const liveScore = new GenericScore();
    liveScore.setName('Live Cell');
    const liveObj = new LiveObject();
    liveObj.setSoundObject(liveScore);
    data.getLiveData().getLiveObjectBins().setLiveObject(0, 0, liveObj);

    const effect = new Effect();
    effect.setName('LazyFx');
    data.getMixer().getMaster().getPreEffects().push(effect);

    const lightweight = createProjectEditorSnapshot(data, null, 1, 'doc-lazy', {
      includeSerializedXml: false,
    });

    const trackItem =
      lightweight.score!.layerGroups[0]!.groupType === 'track'
        ? lightweight.score!.layerGroups[0]!.layers[0]!.items[0]!
        : null;
    expect(trackItem?.serializedXml).toBeUndefined();
    const liveCell = lightweight.blueLive?.bins.cells[0]![0]!;
    expect(liveCell.serializedXml).toBeUndefined();
    const preEntry = lightweight.mixer!.master.preChain[0]!;
    expect(preEntry.kind).toBe('effect');
    if (preEntry.kind === 'effect') {
      expect(preEntry.effectXml).toBeUndefined();
    }

    const resolvedTimeline = resolveEditorTarget(data, trackItem!.editorTarget);
    expect(resolvedTimeline?.sObj.saveAsXML().toXml()).toBe(score.saveAsXML().toXml());
    const resolvedLive = resolveEditorTarget(
      data,
      createBlueLiveEditorTargetSnapshot(liveCell, 0, 0),
    );
    expect(resolvedLive?.sObj.saveAsXML().toXml()).toBe(liveScore.saveAsXML().toXml());
  });

  it('resolves Instance XML via createScoreObjectPropertiesTarget instead of the library prototype', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const libScore = new GenericScore();
    libScore.setName('Library Prototype');
    data.getSoundObjectLibrary().addObject(libScore);
    const libraryId = data.getSoundObjectLibrary().getEntries()[0]!.libraryId;

    const group = new TrackLayerGroup();
    const track = group.newLayerAt(0);
    const inst = new Instance();
    inst.setSoundObject(libScore);
    inst.setLibraryId(libraryId);
    inst.setName('Timeline Instance');
    inst.setStartTime(TimePosition.beats(0));
    inst.setSubjectiveDuration(TimeDuration.beats(8));
    inst.setRepeatPoint(TimeDuration.beats(2));
    track.push(inst);
    data.getScore().push(group);

    const snapshot = createProjectEditorSnapshot(data, null, 1, 'doc-inst', {
      includeSerializedXml: false,
    });
    const instItem =
      snapshot.score!.layerGroups[0]!.groupType === 'track'
        ? snapshot.score!.layerGroups[0]!.layers[0]!.items[0]!
        : null;
    expect(instItem?.serializedXml).toBeUndefined();
    expect(instItem?.editorTarget.selectedObjectType).toBe('Instance');

    const resolved = resolveEditorTarget(
      data,
      createScoreObjectPropertiesTarget(instItem!.editorTarget),
    );
    expect(resolved?.sObj).toBeInstanceOf(Instance);
    const serializedXml = resolved!.sObj.saveAsXML().toXml();

    const applied = applyProjectDocumentPatch(data, {
      score: {
        type: 'addScoreObjects',
        groupId: snapshot.score!.layerGroups[0]!.groupId,
        objects: [
          {
            layerIndex: 0,
            objectType: 'Instance',
            name: 'Timeline Instance',
            startBeats: 10,
            durationBeats: 8,
            serializedXml,
          },
        ],
      },
    });
    expect(applied).toBe(true);
    const pasted = track[1] as Instance;
    expect(pasted).toBeInstanceOf(Instance);
    expect(pasted.getSoundObject()).toBe(libScore);
    expect(pasted.getLibraryId()).toBe(libraryId);
    expect(pasted.getRepeatPoint()?.toBeats(4)).toBe(2);
  });

  it('resolves timeline targets by stable selectionId after reordering and rejects deleted targets', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const group = new TrackLayerGroup();
    const track = group.newLayerAt(0);
    const selected = new GenericScore();
    selected.setName('Selected');
    const other = new GenericScore();
    other.setName('Other');
    track.push(selected, other);
    data.getScore().push(group);

    const snapshot = createProjectEditorSnapshot(data, null, 1, 'doc-reorder', {
      includeSerializedXml: false,
    });
    const firstItem =
      snapshot.score!.layerGroups[0]!.groupType === 'track'
        ? snapshot.score!.layerGroups[0]!.layers[0]!.items[0]!
        : null;
    expect(firstItem).toBeTruthy();

    [track[0], track[1]] = [track[1]!, track[0]!];

    const reorderedResolved = resolveEditorTarget(
      data,
      createScoreObjectPropertiesTarget(firstItem!.editorTarget),
    );
    expect(reorderedResolved?.sObj).toBe(selected);
    expect(reorderedResolved?.sObj.getName()).toBe('Selected');

    track.splice(1, 1);
    expect(
      resolveEditorTarget(data, createScoreObjectPropertiesTarget(firstItem!.editorTarget)),
    ).toBeNull();
  });

  it('rejects blueLive setCell when expectedLiveObjectId does not match current cell occupant', () => {
    const data = new BlueData();
    const newerObj = new LiveObject();
    newerObj.setUniqueId('newer-id');
    const newerScore = new GenericScore();
    newerScore.setName('Newer');
    newerObj.setSoundObject(newerScore);
    data.getLiveData().getLiveObjectBins().setLiveObject(0, 0, newerObj);

    const staleXml = new GenericScore().saveAsXML().toXml();
    const mismatchedSet = applyProjectDocumentPatch(data, {
      blueLive: {
        type: 'setCell',
        column: 0,
        row: 0,
        expectedLiveObjectId: null,
        cell: {
          uniqueId: 'pasted-id',
          displayName: 'Pasted',
          enabled: true,
          keyTrigger: 0,
          midiTrigger: 0,
          soundObjectType: 'GenericScore',
          hasSoundObject: true,
          serializedXml: staleXml,
        },
      },
    });
    expect(mismatchedSet).toBe(false);
    expect(data.getLiveData().getLiveObjectBins().getLiveObject(0, 0)?.getUniqueId()).toBe(
      'newer-id',
    );

    const matchedSet = applyProjectDocumentPatch(data, {
      blueLive: {
        type: 'setCell',
        column: 0,
        row: 0,
        expectedLiveObjectId: 'newer-id',
        cell: null,
      },
    });
    expect(matchedSet).toBe(true);
    expect(data.getLiveData().getLiveObjectBins().getLiveObject(0, 0)).toBeNull();
  });

  it('rejects deleted timeline targets even after deleting and reusing the slot with a new or un-IDd object', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const group = new TrackLayerGroup();
    const track = group.newLayerAt(0);
    const firstScore = new GenericScore();
    firstScore.setName('First');
    firstScore.setStartTime(TimePosition.beats(0));
    track.push(firstScore);
    data.getScore().push(group);

    const snapshot = createProjectEditorSnapshot(data, null, 1, 'doc-slot-reuse', {
      includeSerializedXml: false,
    });
    const groupSnap = snapshot.score!.layerGroups[0]!;
    const layerSnap = groupSnap.groupType === 'track' ? groupSnap.layers[0]! : null;
    const firstItem = layerSnap?.items[0]!;
    expect(firstItem).toBeTruthy();

    track.splice(0, 1);
    const reused = applyProjectDocumentPatch(
      data,
      {
        score: {
          type: 'addTrackItem',
          track: {
            rootGroupId: groupSnap.groupId,
            trackId: layerSnap!.layerId,
            projectSessionId: 1,
            projectRevision: 1,
          },
          item: {
            objectType: 'GenericScore',
            name: 'Added Replacement',
            durationBeats: 2,
          },
          startBeats: 0,
        },
      },
      { projectSessionId: 1, projectRevision: 1 },
    );
    expect(reused).toBe(true);
    expect(
      resolveEditorTarget(data, createScoreObjectPropertiesTarget(firstItem.editorTarget)),
    ).toBeNull();

    const replacementSnapshot = createProjectEditorSnapshot(data, null, 2, 'doc-slot-reuse', {
      includeSerializedXml: false,
    });
    const replacementItem =
      replacementSnapshot.score!.layerGroups[0]!.groupType === 'track'
        ? replacementSnapshot.score!.layerGroups[0]!.layers[0]!.items[0]!
        : null;
    expect(replacementItem?.name).toBe('Added Replacement');
    const resolvedReplacement = resolveEditorTarget(
      data,
      createScoreObjectPropertiesTarget(replacementItem!.editorTarget),
    );
    expect(resolvedReplacement?.sObj).toBe(track[0]);
    expect(resolvedReplacement?.sObj.getName()).toBe('Added Replacement');

    track.splice(0, 1);
    const rawUnIdReplacement = new GenericScore();
    rawUnIdReplacement.setName('Raw Un-ID Replacement');
    track.push(rawUnIdReplacement);

    expect(
      resolveEditorTarget(data, createScoreObjectPropertiesTarget(firstItem.editorTarget)),
    ).toBeNull();
    expect(
      resolveEditorTarget(data, createScoreObjectPropertiesTarget(replacementItem!.editorTarget)),
    ).toBeNull();
  });

  it('reifies lazy-XML addTrackItem for a library-backed Instance in a TrackLayerGroup', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const libScore = new GenericScore();
    libScore.setName('Library Prototype');
    data.getSoundObjectLibrary().addObject(libScore);
    const libraryId = data.getSoundObjectLibrary().getEntries()[0]!.libraryId;

    const group = new TrackLayerGroup();
    const track = group.newLayerAt(0);
    const sourceInstance = new Instance();
    sourceInstance.setSoundObject(libScore);
    sourceInstance.setLibraryId(libraryId);
    sourceInstance.setName('Source Instance');
    const serializedXml = sourceInstance.saveAsXML().toXml();
    data.getScore().push(group);

    const snapshot = createProjectEditorSnapshot(data, null, 1, 'doc-inst-track', {
      includeSerializedXml: false,
    });
    const groupSnap = snapshot.score!.layerGroups[0]!;
    const layerId = groupSnap.groupType === 'track' ? groupSnap.layers[0]!.layerId : '';

    const applied = applyProjectDocumentPatch(
      data,
      {
        score: {
          type: 'addTrackItem',
          track: {
            rootGroupId: groupSnap.groupId,
            trackId: layerId,
            projectSessionId: 1,
            projectRevision: 1,
          },
          item: {
            objectType: 'Instance',
            name: 'Pasted Lazy Instance',
            durationBeats: 4,
            serializedXml,
          },
          startBeats: 5,
        },
      },
      { projectSessionId: 1, projectRevision: 1 },
    );

    expect(applied).toBe(true);
    expect(track).toHaveLength(1);
    const pasted = track[0] as Instance;
    expect(pasted).toBeInstanceOf(Instance);
    expect(pasted.getSoundObject()).toBe(libScore);
    expect(pasted.getLibraryId()).toBe(libraryId);
  });

  it('rejects blueLive setCell when expectedColumns or expectedRows mismatches after grid resize', () => {
    const data = new BlueData();
    const bins = data.getLiveData().getLiveObjectBins();
    const scoreXml = new GenericScore().saveAsXML().toXml();

    expect(applyProjectDocumentPatch(data, { blueLive: { type: 'insertRow', index: 0 } })).toBe(
      true,
    );
    const colsBeforeRemove = bins.getColumnCount();
    const rowsBeforeRemove = bins.getRowCount();

    expect(applyProjectDocumentPatch(data, { blueLive: { type: 'removeRow', index: 0 } })).toBe(
      true,
    );

    const cellPayload = {
      uniqueId: 'resized-cell',
      displayName: 'Resized',
      enabled: true,
      keyTrigger: 0,
      midiTrigger: 0,
      soundObjectType: 'GenericScore',
      hasSoundObject: true,
      serializedXml: scoreXml,
    };

    expect(
      applyProjectDocumentPatch(data, {
        blueLive: {
          type: 'setCell',
          column: 0,
          row: 0,
          expectedLiveObjectId: null,
          expectedColumns: colsBeforeRemove,
          expectedRows: rowsBeforeRemove,
          cell: cellPayload,
        },
      }),
    ).toBe(false);
    expect(bins.getLiveObject(0, 0)).toBeNull();

    const colsAfterRemove = bins.getColumnCount();
    const rowsAfterRemove = bins.getRowCount();
    expect(applyProjectDocumentPatch(data, { blueLive: { type: 'insertColumn', index: 0 } })).toBe(
      true,
    );
    expect(
      applyProjectDocumentPatch(data, {
        blueLive: {
          type: 'setCell',
          column: 0,
          row: 0,
          expectedLiveObjectId: null,
          expectedColumns: colsAfterRemove,
          expectedRows: rowsAfterRemove,
          cell: cellPayload,
        },
      }),
    ).toBe(false);
    expect(bins.getLiveObject(0, 0)).toBeNull();

    expect(
      applyProjectDocumentPatch(data, {
        blueLive: {
          type: 'setCell',
          column: 0,
          row: 0,
          expectedLiveObjectId: null,
          expectedColumns: bins.getColumnCount(),
          expectedRows: bins.getRowCount(),
          cell: cellPayload,
        },
      }),
    ).toBe(true);
    expect(bins.getLiveObject(0, 0)?.getUniqueId()).toBe('resized-cell');
  });
});

describe('score object identity and index safety', () => {
  it('removes multiple objects in one layer regardless of order and rejects stale re-deletion', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const poly = new TrackLayerGroup();
    const layer = poly.newLayerAt(0);
    const a = new GenericScore();
    a.setName('A');
    const b = new GenericScore();
    b.setName('B');
    const c = new GenericScore();
    c.setName('C');
    layer.push(a, b, c);
    data.getScore().push(poly);

    const snapshot = createProjectEditorSnapshot(data, null);
    const items = snapshot.score!.layerGroups[0]!.layers[0]!.items;
    const targetA = items[0]!.editorTarget!;
    const targetB = items[1]!.editorTarget!;

    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'removeScoreObjects',
          targets: [targetA, targetB],
        },
      }),
    ).toBe(true);

    expect(Array.from(layer)).toEqual([c]);

    // Stale targetA still points to index 0 (now occupied by C) with selectionId of A.
    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'removeScoreObjects',
          targets: [targetA],
        },
      }),
    ).toBe(false);
    expect(Array.from(layer)).toEqual([c]);
  });

  it('moves a surviving sibling by selectionId when its cached objectIndex is stale', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const poly = new TrackLayerGroup();
    const sourceLayer = poly.newLayerAt(0);
    const destLayer = poly.newLayerAt(1);
    const a = new GenericScore();
    a.setName('A');
    const b = new GenericScore();
    b.setName('B');
    sourceLayer.push(a, b);
    data.getScore().push(poly);

    const snapshot = createProjectEditorSnapshot(data, null);
    const groupId = snapshot.score!.layerGroups[0]!.groupId;
    const targetB = snapshot.score!.layerGroups[0]!.layers[0]!.items[1]!.editorTarget!;
    sourceLayer.splice(0, 1);

    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'moveScoreObjects',
          moves: [
            {
              target: targetB,
              targetStartBeats: 3,
              targetLayerIndex: 1,
              targetGroupId: groupId,
            },
          ],
        },
      }),
    ).toBe(true);

    expect(Array.from(sourceLayer)).toEqual([]);
    expect(Array.from(destLayer)).toEqual([b]);
  });

  it('isolates assigned score object IDs per BlueData instance', () => {
    const dataA = new BlueData();
    dataA.getScore().length = 0;
    const polyA = new TrackLayerGroup();
    const layerA = polyA.newLayerAt(0);
    const first = new GenericScore();
    const second = new GenericScore();
    layerA.push(first, second);
    dataA.getScore().push(polyA);
    createProjectEditorSnapshot(dataA, null);

    const dataB = new BlueData();
    dataB.getScore().length = 0;
    const polyB = new TrackLayerGroup();
    const layerB = polyB.newLayerAt(0);
    const freshObj = new GenericScore();
    layerB.push(freshObj);
    dataB.getScore().push(polyB);

    expect(
      applyProjectDocumentPatch(dataB, {
        score: {
          type: 'updateSharedProperties',
          target: {
            selectionId: 'sobj-0-1',
            selectedObjectType: 'GenericScore',
            editorObjectType: 'GenericScore',
            ownerKind: 'timeline',
            displayContext: 'timeline',
            location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
            supportsTimeBehavior: true,
            supportsRepeatPoint: true,
            supportsNoteProcessorChain: true,
          },
          patch: { name: 'Isolated Workspace Rename' },
        },
      }),
    ).toBe(true);
    expect(freshObj.getName()).toBe('Isolated Workspace Rename');
  });

  it('preserves ascending source layer order when moving multiple score objects', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const poly = new TrackLayerGroup();
    const sourceLayer = poly.newLayerAt(0);
    const destLayer = poly.newLayerAt(1);
    const a = new GenericScore();
    a.setName('A');
    a.setStartTime(TimePosition.beats(1));
    const b = new GenericScore();
    b.setName('B');
    b.setStartTime(TimePosition.beats(2));
    sourceLayer.push(a, b);
    data.getScore().push(poly);

    const snapshot = createProjectEditorSnapshot(data, null);
    const groupId = snapshot.score!.layerGroups[0]!.groupId;
    const targetA = snapshot.score!.layerGroups[0]!.layers[0]!.items[0]!.editorTarget!;
    const targetB = snapshot.score!.layerGroups[0]!.layers[0]!.items[1]!.editorTarget!;

    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'moveScoreObjects',
          moves: [
            {
              target: targetA,
              targetStartBeats: 5,
              targetLayerIndex: 1,
              targetGroupId: groupId,
            },
            {
              target: targetB,
              targetStartBeats: 6,
              targetLayerIndex: 1,
              targetGroupId: groupId,
            },
          ],
        },
      }),
    ).toBe(true);

    expect(Array.from(sourceLayer)).toEqual([]);
    expect(Array.from(destLayer)).toEqual([a, b]);
  });

  it('omits serializedXml and avoids unnecessary mixer reconciliation on scoreObject scoped snapshots', () => {
    const data = new BlueData();
    const inst = new GenericInstrument();
    inst.setName('Inst 1');
    const assignmentId = data.getArrangement().addInstrument(inst);
    data.getScore().length = 0;
    const poly = new PolyObject();
    const layer = poly.newLayerAt(0);
    const gs = new GenericScore();
    gs.setName('Phrase A');
    gs.setScoreText('i1 0 1 440');
    layer.push(gs);
    data.getScore().push(poly);
    // Intentionally leave mixer empty to verify scoreObject scoped snapshot does not trigger reconciliation.
    data.getMixer().getChannels().length = 0;

    const fullSnap = createProjectEditorSnapshot(data, '/test.blue', 1, 'doc-1', {
      includeSerializedXml: false,
    });
    const objectId = fullSnap.score!.layerGroups[0]!.layers[0]!.items[0]!.objectId;
    expect(fullSnap.score!.layerGroups[0]!.layers[0]!.items[0]!.serializedXml).toBeUndefined();

    // Clear mixer after fullSnap to prove scoreObject:* scoped snapshot does not re-reconcile.
    data.getMixer().getChannels().length = 0;

    const scopedSnap = createScopedProjectEditorSnapshot(
      data,
      '/test.blue',
      1,
      'doc-1',
      [`scoreObject:${objectId}`],
      { includeSerializedXml: false },
    );
    expect(scopedSnap.score).toBeDefined();
    expect(scopedSnap.score!.layerGroups[0]!.layers[0]!.items[0]!.serializedXml).toBeUndefined();
    expect(scopedSnap.orchestra).toBeUndefined();
    expect(scopedSnap.blueLive).toBeUndefined();
    expect(
      data
        .getMixer()
        .getChannels()
        .map((c) => c.getName()),
    ).not.toContain(assignmentId);
  });

  it('applies multi-group removeLayerRanges and clearLayerAutomations in single passes', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const ch = new Channel();
    ch.setName('Chan 1');
    const eff = new Effect();
    eff.setName('Delay');
    const param = new Parameter();
    param.setName('feedback');
    eff.addParameter(param);
    ch.getPreEffects().push(eff);
    data.getMixer().getChannels().push(ch);

    const g1 = new PolyObject();
    const g1l0 = g1.newLayerAt(0);
    const g1l1 = g1.newLayerAt(1);
    g1l0.getAutomationParameters().addParameterId(param.getUniqueId());
    const g2 = new TrackLayerGroup();
    const g2l0 = g2.newLayerAt(0);
    g2l0.getAutomationParameters().addParameterId(param.getUniqueId());
    data.getScore().push(g1, g2);

    const snap = createProjectEditorSnapshot(data, null);
    const group1Snap = snap.score!.layerGroups[0]!;
    const group1Id = group1Snap.groupId;
    const group2Id = snap.score!.layerGroups[1]!.groupId;

    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'clearLayerAutomations',
          layer: {
            rootGroupIndex: 0,
            groupId: group1Id,
            layerId: group1Snap.layers[0]!.layerId,
            layerIndex: 0,
            layerKind: 'soundObject',
          },
        },
      }),
    ).toBe(true);
    expect(g1l0.getAutomationParameters().getIds()).toEqual([]);

    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'removeLayerRanges',
          ranges: [
            { groupId: group1Id, startIndex: 0, endIndex: 0 },
            { groupId: group2Id, startIndex: 0, endIndex: 0 },
          ],
        },
      }),
    ).toBe(true);
    expect(g1.length).toBe(1);
    expect(g1[0]).toBe(g1l1);
    expect(g2.length).toBe(0);
  });
});
