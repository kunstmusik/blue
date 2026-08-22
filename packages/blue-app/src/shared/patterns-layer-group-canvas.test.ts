import { describe, expect, it } from 'vitest';
import {
  BlueData,
  GenericScore,
  PatternsLayerGroup,
  TimeDuration,
  TimePosition,
} from '@blue/data';
import {
  applyProjectDocumentPatch,
  createProjectEditorSnapshot,
  createScoreObjectEditorDocument,
} from './project-editor';
import type {
  PatternLayerSnapshot,
  PatternsLayerGroupSnapshot,
  ScoreObjectEditorTargetSnapshot,
} from './project-editor';

function buildPatternProject(patternBeatsLength = 4): BlueData {
  const data = new BlueData();
  const group = new PatternsLayerGroup();
  group.setPatternBeatsLength(patternBeatsLength);

  const layerA = group.newLayerAt(0);
  layerA.setName('Row A');
  const sourceA = new GenericScore();
  sourceA.setName('Source A');
  sourceA.setScoreText('i1 0 1\n');
  sourceA.setStartTime(TimePosition.beats(0));
  sourceA.setSubjectiveDuration(TimeDuration.beats(1));
  sourceA.setBackgroundColor(0xff204020);
  layerA.setSoundObject(sourceA);
  layerA.getPatternData().setPattern(0, true);
  layerA.getPatternData().setPattern(3, true);

  const layerB = group.newLayerAt(1);
  layerB.setName('Row B');
  layerB.setMuted(true);
  const sourceB = new GenericScore();
  sourceB.setName('Source B');
  sourceB.setScoreText('i2 0 1\n');
  sourceB.setStartTime(TimePosition.beats(0));
  sourceB.setSubjectiveDuration(TimeDuration.beats(1));
  layerB.setSoundObject(sourceB);
  layerB.getPatternData().setPattern(1, true);
  layerB.setSolo(true);

  data.getScore().push(group);
  return data;
}

function getPatternGroupSnapshot(data: BlueData): PatternsLayerGroupSnapshot {
  const snapshot = createProjectEditorSnapshot(data, null, 1);
  const group = snapshot.score.layerGroups.find(
    (candidate) => candidate.groupType === 'patterns',
  );
  if (!group || group.groupType !== 'patterns') {
    throw new Error('patterns layer group snapshot missing');
  }
  return group;
}

describe('patterns layer-group snapshot', () => {
  it('exposes sorted active cells, source summaries, and stable identities', () => {
    const data = buildPatternProject();
    const group = getPatternGroupSnapshot(data);

    expect(group.patternBeatsLength).toBe(4);
    expect(group.effectivePatternBeatsLength).toBe(4);
    expect(group.isOpenableContainer).toBe(false);
    expect(group.layers).toHaveLength(2);

    const [rowA, rowB] = group.layers as PatternLayerSnapshot[];
    expect(rowA.items).toEqual([]);
    expect(rowA.activeCellIndices).toEqual([0, 3]);
    expect(rowA.sourceObject.objectType).toBe('GenericScore');
    expect(rowA.sourceObject.name).toBe('Source A');
    expect(rowA.sourceObject.backgroundColor).toBe(0xff204020);
    expect(rowA.sourceObject.serializedXml).toContain('Source A');
    expect(rowA.sourceObject.barRenderer.kind).toBe('generic');
    expect(rowB.activeCellIndices).toEqual([1]);
    expect(rowB.muted).toBe(true);
    expect(rowB.solo).toBe(true);

    const patternSource = rowA.sourceObject.editorTarget.patternSource;
    expect(patternSource).toBeDefined();
    expect(patternSource!.groupId).toBe(group.groupId);
    expect(patternSource!.layerId).toBe(rowA.layerId);
    expect(patternSource!.sourceObjectId).toBe(rowA.sourceObject.objectId);
    expect(rowA.sourceObject.editorTarget.ownerKind).toBe('timeline');
    expect(rowA.sourceObject.editorTarget.location).toBeUndefined();
  });

  it('keeps pattern row identities stable across snapshot refreshes and reordering', () => {
    const data = buildPatternProject();
    const first = getPatternGroupSnapshot(data);
    const second = getPatternGroupSnapshot(data);
    expect(second.layers.map((layer) => layer.layerId)).toEqual(
      first.layers.map((layer) => layer.layerId),
    );

    applyProjectDocumentPatch(data, { score: { type: 'moveLayer', groupId: first.groupId, layerIndex: 0, targetIndex: 1 } });
    const reordered = getPatternGroupSnapshot(data);
    expect(reordered.layers[0]!.layerId).toBe(first.layers[1]!.layerId);
    expect(reordered.layers[1]!.layerId).toBe(first.layers[0]!.layerId);
  });

  it('uses a positive display fallback for malformed raw step lengths without rewriting data', () => {
    const data = buildPatternProject();
    const group = data.getScore().find((candidate) => candidate instanceof PatternsLayerGroup) as PatternsLayerGroup;
    // Simulates malformed legacy data (e.g. non-numeric XML text parsed to NaN).
    group.setPatternBeatsLength(Number.NaN);

    const snapshot = getPatternGroupSnapshot(data);
    expect(Number.isFinite(snapshot.patternBeatsLength)).toBe(false);
    expect(snapshot.effectivePatternBeatsLength).toBeGreaterThan(0);
    expect(Number.isFinite(group.getPatternBeatsLength())).toBe(false);
  });
});

describe('pattern source-object target resolution', () => {
  it('resolves source-object editor documents through the pattern source ref', () => {
    const data = buildPatternProject();
    const group = getPatternGroupSnapshot(data);
    const rowA = group.layers[0]!;

    const document = createScoreObjectEditorDocument(data, { target: rowA.sourceObject.editorTarget });
    expect(document).not.toBeNull();
    expect(document!.shared.name).toBe('Source A');
    expect(document!.target.patternSource?.sourceObjectId).toBe(rowA.sourceObject.objectId);
  });

  it('returns the removed-target fallback for stale source refs', () => {
    const data = buildPatternProject();
    const group = getPatternGroupSnapshot(data);
    const stale: ScoreObjectEditorTargetSnapshot = {
      ...group.layers[0]!.sourceObject.editorTarget,
      patternSource: {
        groupId: group.groupId,
        layerId: group.layers[0]!.layerId,
        sourceObjectId: 'sobj-does-not-exist',
      },
    };

    const document = createScoreObjectEditorDocument(data, { target: stale });
    expect(document!.editor.kind).toBe('fallback');
    if (document!.editor.kind === 'fallback') {
      expect(document!.editor.reason).toBe('removed-target');
    }
  });

  it('routes shared-property patches to the embedded source object', () => {
    const data = buildPatternProject();
    const group = getPatternGroupSnapshot(data);
    const target = group.layers[0]!.sourceObject.editorTarget;

    const changed = applyProjectDocumentPatch(data, {
      score: {
        type: 'updateSharedProperties',
        target,
        patch: { name: 'Renamed Source', backgroundColor: 0xff112233 },
      },
    });
    expect(changed).toBe(true);

    const refreshed = getPatternGroupSnapshot(data);
    expect(refreshed.layers[0]!.sourceObject.name).toBe('Renamed Source');
    expect(refreshed.layers[0]!.sourceObject.backgroundColor).toBe(0xff112233);
    expect(refreshed.layers[0]!.activeCellIndices).toEqual([0, 3]);
  });

  it('keeps generic timeline object handlers rejecting pattern groups and sources', () => {
    const data = buildPatternProject();
    const group = getPatternGroupSnapshot(data);
    const target = group.layers[0]!.sourceObject.editorTarget;

    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'addScoreObjects',
          groupId: group.groupId,
          objects: [{
            layerIndex: 0,
            objectType: 'GenericScore',
            name: 'x',
            startBeats: 0,
            durationBeats: 1,
            backgroundColor: 0,
          }],
        },
      }),
    ).toBe(false);

    expect(
      applyProjectDocumentPatch(data, { score: { type: 'removeScoreObjects', targets: [target] } }),
    ).toBe(false);

    expect(
      applyProjectDocumentPatch(data, { score: { type: 'convertScoreObjectToObjectBuilder', target } }),
    ).toBe(false);

    // The pattern group and its rows survive all rejected operations.
    const refreshed = getPatternGroupSnapshot(data);
    expect(refreshed.layers).toHaveLength(2);
    expect(refreshed.layers[0]!.sourceObject.name).toBe('Source A');
  });
});

describe('updatePatternCells patch contract', () => {
  it('applies validated cell writes atomically', () => {
    const data = buildPatternProject();
    const group = getPatternGroupSnapshot(data);

    const changed = applyProjectDocumentPatch(data, {
      score: {
        type: 'updatePatternCells',
        groupId: group.groupId,
        changes: [
          { layerId: group.layers[0]!.layerId, cellIndex: 1, active: true },
          { layerId: group.layers[1]!.layerId, cellIndex: 1, active: false },
        ],
      },
    });
    expect(changed).toBe(true);

    const refreshed = getPatternGroupSnapshot(data);
    expect(refreshed.layers[0]!.activeCellIndices).toEqual([0, 1, 3]);
    expect(refreshed.layers[1]!.activeCellIndices).toEqual([]);
  });

  it('grows pattern data for far active cells but not for inactive clears', () => {
    const data = buildPatternProject();
    const group = getPatternGroupSnapshot(data);

    applyProjectDocumentPatch(data, {
      score: {
        type: 'updatePatternCells',
        groupId: group.groupId,
        changes: [{ layerId: group.layers[0]!.layerId, cellIndex: 40, active: true }],
      },
    });
    expect(getPatternGroupSnapshot(data).layers[0]!.activeCellIndices).toEqual([0, 3, 40]);

    const dataGroup = data.getScore().find((candidate) => candidate instanceof PatternsLayerGroup) as PatternsLayerGroup;
    const patternData = dataGroup[0]!.getPatternData();
    expect(patternData.isPatternSet(40)).toBe(true);

    applyProjectDocumentPatch(data, {
      score: {
        type: 'updatePatternCells',
        groupId: group.groupId,
        changes: [{ layerId: group.layers[1]!.layerId, cellIndex: 39, active: false }],
      },
    });
    expect(dataGroup[1]!.getPatternData().isPatternSet(39)).toBe(false);
  });

  it('rejects the whole patch when any row or cell is invalid', () => {
    const data = buildPatternProject();
    const group = getPatternGroupSnapshot(data);

    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'updatePatternCells',
          groupId: group.groupId,
          changes: [
            { layerId: group.layers[0]!.layerId, cellIndex: 2, active: true },
            { layerId: 'pl-unknown', cellIndex: 0, active: true },
          ],
        },
      }),
    ).toBe(false);
    expect(getPatternGroupSnapshot(data).layers[0]!.activeCellIndices).toEqual([0, 3]);

    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'updatePatternCells',
          groupId: group.groupId,
          changes: [
            { layerId: group.layers[0]!.layerId, cellIndex: 1.5, active: true },
          ],
        },
      }),
    ).toBe(false);
    expect(getPatternGroupSnapshot(data).layers[0]!.activeCellIndices).toEqual([0, 3]);

    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'updatePatternCells',
          groupId: group.groupId,
          changes: [
            { layerId: group.layers[0]!.layerId, cellIndex: -1, active: true },
          ],
        },
      }),
    ).toBe(false);

    expect(
      applyProjectDocumentPatch(data, {
        score: { type: 'updatePatternCells', groupId: 'lg-unknown', changes: [{ layerId: 'pl-1', cellIndex: 0, active: true }] },
      }),
    ).toBe(false);

    expect(
      applyProjectDocumentPatch(data, {
        score: { type: 'updatePatternCells', groupId: group.groupId, changes: [] },
      }),
    ).toBe(false);
  });

  it('reduces duplicate writes to the last change in patch order', () => {
    const data = buildPatternProject();
    const group = getPatternGroupSnapshot(data);

    applyProjectDocumentPatch(data, {
      score: {
        type: 'updatePatternCells',
        groupId: group.groupId,
        changes: [
          { layerId: group.layers[0]!.layerId, cellIndex: 5, active: true },
          { layerId: group.layers[0]!.layerId, cellIndex: 5, active: false },
        ],
      },
    });
    expect(getPatternGroupSnapshot(data).layers[0]!.activeCellIndices).toEqual([0, 3]);
  });

  it('treats a valid patch repeating existing values as a no-op without dirtying', () => {
    const data = buildPatternProject();
    const group = getPatternGroupSnapshot(data);

    const changed = applyProjectDocumentPatch(data, {
      score: {
        type: 'updatePatternCells',
        groupId: group.groupId,
        changes: [
          { layerId: group.layers[0]!.layerId, cellIndex: 0, active: true },
          { layerId: group.layers[1]!.layerId, cellIndex: 1, active: true },
        ],
      },
    });
    expect(changed).toBe(false);
  });
});

describe('updatePatternBeatsLength patch contract', () => {
  it('updates the shared group step length and leaves cells untouched', () => {
    const data = buildPatternProject();
    const group = getPatternGroupSnapshot(data);

    const changed = applyProjectDocumentPatch(data, {
      score: { type: 'updatePatternBeatsLength', groupId: group.groupId, patternBeatsLength: 2 },
    });
    expect(changed).toBe(true);

    const refreshed = getPatternGroupSnapshot(data);
    expect(refreshed.patternBeatsLength).toBe(2);
    expect(refreshed.effectivePatternBeatsLength).toBe(2);
    expect(refreshed.layers[0]!.activeCellIndices).toEqual([0, 3]);
  });

  it('rejects non-integer, non-positive, and unknown-group values without partial state', () => {
    const data = buildPatternProject();
    const group = getPatternGroupSnapshot(data);

    for (const invalid of [0, -2, 1.5, Number.POSITIVE_INFINITY, Number.NaN]) {
      expect(
        applyProjectDocumentPatch(data, {
          score: { type: 'updatePatternBeatsLength', groupId: group.groupId, patternBeatsLength: invalid },
        }),
      ).toBe(false);
    }
    expect(
      applyProjectDocumentPatch(data, {
        score: { type: 'updatePatternBeatsLength', groupId: 'lg-unknown', patternBeatsLength: 2 },
      }),
    ).toBe(false);
    expect(getPatternGroupSnapshot(data).patternBeatsLength).toBe(4);
  });

  it('treats an unchanged value as a no-op', () => {
    const data = buildPatternProject();
    const group = getPatternGroupSnapshot(data);
    expect(
      applyProjectDocumentPatch(data, {
        score: { type: 'updatePatternBeatsLength', groupId: group.groupId, patternBeatsLength: 4 },
      }),
    ).toBe(false);
  });

  it('replaces a malformed raw value only through an explicit valid resize', () => {
    const data = buildPatternProject();
    const dataGroup = data.getScore().find((candidate) => candidate instanceof PatternsLayerGroup) as PatternsLayerGroup;
    dataGroup.setPatternBeatsLength(Number.NaN);

    expect(getPatternGroupSnapshot(data).effectivePatternBeatsLength).toBeGreaterThan(0);

    expect(
      applyProjectDocumentPatch(data, {
        score: { type: 'updatePatternBeatsLength', groupId: getPatternGroupSnapshot(data).groupId, patternBeatsLength: 8 },
      }),
    ).toBe(true);
    expect(getPatternGroupSnapshot(data).patternBeatsLength).toBe(8);
  });
});

describe('pattern .blue XML round-trip', () => {
  it('preserves edited cells, step length, row state, source objects, and note processors', () => {
    const data = buildPatternProject(6);
    const group = getPatternGroupSnapshot(data);
    const chain = dataGroup(data).getNoteProcessorChain();

    applyProjectDocumentPatch(data, {
      score: {
        type: 'updatePatternCells',
        groupId: group.groupId,
        changes: [
          { layerId: group.layers[0]!.layerId, cellIndex: 5, active: true },
          { layerId: group.layers[1]!.layerId, cellIndex: 1, active: false },
        ],
      },
    });
    applyProjectDocumentPatch(data, {
      score: { type: 'updatePatternBeatsLength', groupId: group.groupId, patternBeatsLength: 3 },
    });

    const saved = data.saveToString();
    const reopened = BlueData.loadFromString(saved);
    const reopenedGroup = getPatternGroupSnapshot(reopened);

    expect(reopenedGroup.patternBeatsLength).toBe(3);
    expect(reopenedGroup.effectivePatternBeatsLength).toBe(3);
    expect(reopenedGroup.layers[0]!.activeCellIndices).toEqual([0, 3, 5]);
    expect(reopenedGroup.layers[1]!.activeCellIndices).toEqual([]);
    expect(reopenedGroup.layers[1]!.muted).toBe(true);
    expect(reopenedGroup.layers[1]!.solo).toBe(true);
    expect(reopenedGroup.layers[0]!.name).toBe('Row A');
    expect(reopenedGroup.layers[0]!.sourceObject.name).toBe('Source A');
    expect(reopenedGroup.layers[0]!.sourceObject.serializedXml).toContain('i1 0 1');

    const reopenedDataGroup = reopened.getScore().find(
      (candidate) => candidate instanceof PatternsLayerGroup,
    ) as PatternsLayerGroup;
    expect(reopenedDataGroup.getNoteProcessorChain().getProcessors()).toHaveLength(
      chain.getProcessors().length,
    );
  });

  it('does not serialize trailing inactive capacity as content', () => {
    const data = buildPatternProject();
    const group = getPatternGroupSnapshot(data);
    applyProjectDocumentPatch(data, {
      score: {
        type: 'updatePatternCells',
        groupId: group.groupId,
        changes: [{ layerId: group.layers[1]!.layerId, cellIndex: 9, active: false }],
      },
    });

    const saved = data.saveToString();
    const reopenedGroup = getPatternGroupSnapshot(BlueData.loadFromString(saved));
    expect(reopenedGroup.layers[1]!.activeCellIndices).toEqual([1]);
  });
});

function dataGroup(data: BlueData): PatternsLayerGroup {
  return data.getScore().find((candidate) => candidate instanceof PatternsLayerGroup) as PatternsLayerGroup;
}

describe('pattern snapshot preserves unknown XML data', () => {
  it('tolerates unknown XML data on load without corrupting known pattern content', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<blueData version="2.20.0">
  <score>
    <timeContext/>
    <timeState/>
    <noteProcessorChain/>
    <patternsLayerGroup name="Legacy Patterns" futureAttr="keep-me">
      <patternBeatsLength>2</patternBeatsLength>
      <futureElement>custom-data</futureElement>
      <patternLayers>
        <patternLayer name="Legacy Row" muted="false" solo="false">
          <soundObject type="blue.soundObject.GenericScore">
            <name>Legacy Source</name>
            <startTime>0.0</startTime>
            <subjectiveDuration>2.0</subjectiveDuration>
          </soundObject>
          <patternData>101</patternData>
        </patternLayer>
      </patternLayers>
      <noteProcessorChain/>
    </patternsLayerGroup>
  </score>
</blueData>`;

    const data = BlueData.loadFromString(source);
    const group = getPatternGroupSnapshot(data);
    expect(group.name).toBe('Legacy Patterns');
    expect(group.patternBeatsLength).toBe(2);
    expect(group.layers[0]!.activeCellIndices).toEqual([0, 2]);
    expect(group.layers[0]!.sourceObject.name).toBe('Legacy Source');
    expect(group.layers[0]!.sourceObject.editorTarget.patternSource?.layerId).toBe(group.layers[0]!.layerId);

    // Editing through the canvas contract and re-saving keeps the known
    // pattern content intact end to end.
    applyProjectDocumentPatch(data, {
      score: {
        type: 'updatePatternCells',
        groupId: group.groupId,
        changes: [{ layerId: group.layers[0]!.layerId, cellIndex: 1, active: true }],
      },
    });
    const reopenedGroup = getPatternGroupSnapshot(BlueData.loadFromString(data.saveToString()));
    expect(reopenedGroup.layers[0]!.activeCellIndices).toEqual([0, 1, 2]);
    expect(reopenedGroup.layers[0]!.sourceObject.name).toBe('Legacy Source');
  });
});
