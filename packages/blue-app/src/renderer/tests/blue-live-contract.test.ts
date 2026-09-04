import { describe, expect, it } from 'vitest';
import { BlueData, GenericScore, LiveObject, Sound, TimePosition } from '@blue/data';
import {
  applyProjectDocumentPatch,
  BLUE_LIVE_SOUND_OBJECT_TYPES,
  createBlueLiveProjectSnapshot,
  createProjectEditorSnapshot,
  createScoreObjectEditorDocument,
  type ScoreObjectEditorTargetSnapshot,
} from '../../shared/project-editor';

function createProjectWithLiveData(): BlueData {
  const data = new BlueData();
  const ld = data.getLiveData();
  ld.setCommandLine('-d -odac');
  ld.setCommandLineEnabled(true);
  ld.setCommandLineOverride(false);
  ld.setTempo(120);
  ld.setRepeat(4);
  ld.setRepeatEnabled(true);
  ld.setLiveCodeText('prints "hello\\n"');
  return data;
}

function createBlueLiveEditorTarget(
  liveObjectId: string,
  column: number,
  row: number,
  objectType = 'GenericScore',
): ScoreObjectEditorTargetSnapshot {
  return {
    selectionId: liveObjectId,
    selectedObjectType: objectType,
    editorObjectType: objectType,
    ownerKind: 'blueLive',
    displayContext: 'blueLive',
    blueLive: { liveObjectId, column, row },
    supportsTimeBehavior: true,
    supportsRepeatPoint: true,
    supportsNoteProcessorChain: true,
  };
}

describe('Blue Live snapshot/patch contract', () => {
  it('uses the Java live-eligible Add SoundObject family allowlist', () => {
    expect(BLUE_LIVE_SOUND_OBJECT_TYPES).toEqual([
      'External',
      'GenericScore',
      'JMask',
      'ObjectBuilder',
      'PatternObject',
      'PianoRoll',
      'PythonObject',
      'JavaScriptObject',
      'TrackerObject',
    ]);
  });

  it('creates a Blue Live snapshot from LiveData', () => {
    const data = createProjectWithLiveData();
    const liveData = data.getLiveData();
    const snap = createBlueLiveProjectSnapshot(liveData);

    expect(snap.commandLine).toBe('-d -odac');
    expect(snap.commandLineEnabled).toBe(true);
    expect(snap.commandLineOverride).toBe(false);
    expect(snap.tempo).toBe(120);
    expect(snap.repeat).toBe(4);
    expect(snap.repeatEnabled).toBe(true);
    expect(snap.liveCodeText).toBe('prints "hello\\n"');
  });

  it('includes a complete serialized SoundObject payload for shared Score copy/paste', () => {
    const data = createProjectWithLiveData();
    const soundObject = new GenericScore();
    soundObject.setName('Live phrase');
    soundObject.setStartTime(TimePosition.beats(3));
    const liveObject = new LiveObject();
    liveObject.setUniqueId('live-copy-source');
    liveObject.setSoundObject(soundObject);
    data.getLiveData().getLiveObjectBins().setLiveObject(0, 0, liveObject);

    const cell = createBlueLiveProjectSnapshot(data.getLiveData(), data.getScore().getTimeContext())
      .bins.cells[0]![0]!;

    expect(cell).toMatchObject({
      uniqueId: 'live-copy-source',
      displayName: 'Live phrase',
      soundObjectType: 'GenericScore',
      startBeats: 3,
      hasSoundObject: true,
    });
    expect(cell.serializedXml).toContain('blue.soundObject.GenericScore');
    expect(cell.durationBeats).toBeGreaterThan(0);
    expect(cell.backgroundColor).toEqual(expect.any(Number));
  });

  it('adds, replaces, and removes a validated Live Space cell through setCell', () => {
    const data = createProjectWithLiveData();
    const source = new GenericScore();
    source.setName('Pasted phrase');
    source.setStartTime(TimePosition.beats(9));

    const added = applyProjectDocumentPatch(data, {
      blueLive: {
        type: 'setCell',
        column: 0,
        row: 0,
        cell: {
          uniqueId: 'fresh-live-id',
          enabled: false,
          keyTrigger: -1,
          midiTrigger: -1,
          displayName: source.getName(),
          soundObjectType: 'GenericScore',
          hasSoundObject: true,
          serializedXml: source.saveAsXML().toXml(),
        },
      },
    });
    const cell = createBlueLiveProjectSnapshot(data.getLiveData()).bins.cells[0]![0]!;

    expect(added).toBe(true);
    expect(cell.uniqueId).toBe('fresh-live-id');
    expect(cell.displayName).toBe('Pasted phrase');
    expect(cell.startBeats).toBe(0);

    expect(
      applyProjectDocumentPatch(data, {
        blueLive: { type: 'setCell', column: 0, row: 0, cell: null },
      }),
    ).toBe(true);
    expect(createBlueLiveProjectSnapshot(data.getLiveData()).bins.cells[0]![0]).toBeNull();
    expect(
      applyProjectDocumentPatch(data, {
        blueLive: { type: 'setCell', column: 0, row: 0, cell: null },
      }),
    ).toBe(false);
  });

  it('deserializes independent object graphs for repeated Live Space pastes', () => {
    const data = createProjectWithLiveData();
    data.getLiveData().getLiveObjectBins().insertColumn(1);
    const source = new GenericScore();
    source.setName('Repeated phrase');
    const makeCell = (uniqueId: string) => ({
      uniqueId,
      enabled: false,
      keyTrigger: -1,
      midiTrigger: -1,
      displayName: source.getName(),
      soundObjectType: 'GenericScore',
      hasSoundObject: true,
      serializedXml: source.saveAsXML().toXml(),
    });

    expect(
      applyProjectDocumentPatch(data, {
        blueLive: { type: 'setCell', column: 0, row: 0, cell: makeCell('paste-one') },
      }),
    ).toBe(true);
    expect(
      applyProjectDocumentPatch(data, {
        blueLive: { type: 'setCell', column: 1, row: 0, cell: makeCell('paste-two') },
      }),
    ).toBe(true);

    const bins = data.getLiveData().getLiveObjectBins();
    const first = bins.getLiveObject(0, 0)!.getSoundObject()!;
    const second = bins.getLiveObject(1, 0)!.getSoundObject()!;
    expect(first).not.toBe(second);
    first.setName('Mutated first paste');
    expect(second.getName()).toBe('Repeated phrase');
  });

  it('creates and mutates an editor/properties document for a Live SoundObject', () => {
    const data = createProjectWithLiveData();
    const soundObject = new GenericScore();
    soundObject.setName('Editable live phrase');
    soundObject.setScoreText('i1 0 1 440');
    soundObject.setStartTime(TimePosition.beats(2));
    const liveObject = new LiveObject();
    liveObject.setUniqueId('live-editor-target');
    liveObject.setSoundObject(soundObject);
    data.getLiveData().getLiveObjectBins().setLiveObject(0, 0, liveObject);
    const target = createBlueLiveEditorTarget('live-editor-target', 0, 0);

    const document = createScoreObjectEditorDocument(data, { target });
    expect(document?.shared).toMatchObject({
      name: 'Editable live phrase',
      startTime: { value: 2 },
    });
    expect(document?.editor).toMatchObject({
      kind: 'code',
      text: 'i1 0 1 440',
    });

    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'updateSharedProperties',
          target,
          patch: {
            name: 'Edited from Live',
            subjectiveDuration: { value: 6, timeBase: 'BEATS' },
          },
        },
      }),
    ).toBe(true);
    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'updateTypeSpecificEditor',
          target,
          patch: { text: 'i2 0 2 660' },
        },
      }),
    ).toBe(true);
    expect(soundObject.getName()).toBe('Edited from Live');
    expect(soundObject.getSubjectiveDuration().toBeats(data.getScore().getTimeContext())).toBe(6);
    expect(soundObject.getScoreText()).toBe('i2 0 2 660');
    expect(data.saveToString()).toContain('Edited from Live');
    expect(data.saveToString()).toContain('i2 0 2 660');
  });

  it('resolves a Live editor target by stable identity after structural movement', () => {
    const data = createProjectWithLiveData();
    const soundObject = new GenericScore();
    soundObject.setName('Moving target');
    const liveObject = new LiveObject();
    liveObject.setUniqueId('moving-live-target');
    liveObject.setSoundObject(soundObject);
    const bins = data.getLiveData().getLiveObjectBins();
    bins.setLiveObject(0, 1, liveObject);
    const target = createBlueLiveEditorTarget('moving-live-target', 0, 1);

    bins.insertRow(0);
    expect(bins.getLiveObject(0, 2)?.getUniqueId()).toBe('moving-live-target');
    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'updateSharedProperties',
          target,
          patch: { name: 'Resolved by identity' },
        },
      }),
    ).toBe(true);
    expect(bins.getLiveObject(0, 2)?.getSoundObject()?.getName()).toBe('Resolved by identity');
  });

  it('rejects removed and replaced Live editor targets without redirecting edits', () => {
    const data = createProjectWithLiveData();
    const original = new LiveObject();
    original.setUniqueId('stale-live-target');
    original.setSoundObject(new GenericScore());
    const bins = data.getLiveData().getLiveObjectBins();
    bins.setLiveObject(0, 0, original);
    const target = createBlueLiveEditorTarget('stale-live-target', 0, 0);

    const replacement = new LiveObject();
    replacement.setUniqueId('replacement-live-target');
    replacement.setSoundObject(new GenericScore());
    bins.setLiveObject(0, 0, replacement);

    expect(createScoreObjectEditorDocument(data, { target })?.editor).toMatchObject({
      kind: 'fallback',
      reason: 'removed-target',
    });
    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'updateSharedProperties',
          target,
          patch: { name: 'Must not apply' },
        },
      }),
    ).toBe(false);
    expect(replacement.getSoundObject()?.getName()).not.toBe('Must not apply');
  });

  it('rejects malformed, unsupported, and out-of-range setCell payloads', () => {
    const data = createProjectWithLiveData();
    const unsupported = new Sound();

    const makeCell = (serializedXml: string) => ({
      uniqueId: 'candidate',
      enabled: false,
      keyTrigger: -1,
      midiTrigger: -1,
      displayName: 'Candidate',
      soundObjectType: 'GenericScore',
      hasSoundObject: true,
      serializedXml,
    });

    expect(
      applyProjectDocumentPatch(data, {
        blueLive: {
          type: 'setCell',
          column: 99,
          row: 0,
          cell: makeCell(new GenericScore().saveAsXML().toXml()),
        },
      }),
    ).toBe(false);
    expect(
      applyProjectDocumentPatch(data, {
        blueLive: { type: 'setCell', column: 0, row: 0, cell: makeCell('<not-xml') },
      }),
    ).toBe(false);
    expect(
      applyProjectDocumentPatch(data, {
        blueLive: {
          type: 'setCell',
          column: 0,
          row: 0,
          cell: makeCell(unsupported.saveAsXML().toXml()),
        },
      }),
    ).toBe(false);
    expect(createBlueLiveProjectSnapshot(data.getLiveData()).bins.cells[0]![0]).toBeNull();
  });

  it('includes Blue Live snapshot in project snapshot', () => {
    const data = createProjectWithLiveData();
    const snapshot = createProjectEditorSnapshot(data, '/tmp/test.blue');

    expect(snapshot.blueLive).toBeDefined();
    expect(snapshot.blueLive!.commandLine).toBe('-d -odac');
    expect(snapshot.blueLive!.tempo).toBe(120);
  });

  it('applies updateOptions patch', () => {
    const data = createProjectWithLiveData();
    applyProjectDocumentPatch(data, {
      blueLive: {
        type: 'updateOptions',
        patch: { commandLine: '--new-flag', commandLineEnabled: false },
      },
    });
    const snap = createBlueLiveProjectSnapshot(data.getLiveData());

    expect(snap.commandLine).toBe('--new-flag');
    expect(snap.commandLineEnabled).toBe(false);
    expect(snap.commandLineOverride).toBe(false);
  });

  it('applies updateTempoRepeat patch', () => {
    const data = createProjectWithLiveData();
    applyProjectDocumentPatch(data, {
      blueLive: { type: 'updateTempoRepeat', patch: { tempo: 140, repeatEnabled: false } },
    });
    const snap = createBlueLiveProjectSnapshot(data.getLiveData());

    expect(snap.tempo).toBe(140);
    expect(snap.repeat).toBe(4);
    expect(snap.repeatEnabled).toBe(false);
  });

  it('applies updateLiveCodeText patch', () => {
    const data = createProjectWithLiveData();
    applyProjectDocumentPatch(data, {
      blueLive: { type: 'updateLiveCodeText', text: 'instr 1\\naout oscili p4, p5\\nendin' },
    });
    const snap = createBlueLiveProjectSnapshot(data.getLiveData());

    expect(snap.liveCodeText).toBe('instr 1\\naout oscili p4, p5\\nendin');
  });

  it('applies grid insertRow and removeRow patches', () => {
    const data = new BlueData();
    const ld = data.getLiveData();
    const bins = ld.getLiveObjectBins();

    expect(bins.getRowCount()).toBe(8);

    applyProjectDocumentPatch(data, { blueLive: { type: 'insertRow', index: 1 } });
    let snap = createBlueLiveProjectSnapshot(ld);
    expect(snap.bins.rows).toBe(9);

    applyProjectDocumentPatch(data, { blueLive: { type: 'removeRow', index: 0 } });
    snap = createBlueLiveProjectSnapshot(ld);
    expect(snap.bins.rows).toBe(8);
  });

  it('applies grid insertColumn and removeColumn patches', () => {
    const data = new BlueData();
    const ld = data.getLiveData();
    const bins = ld.getLiveObjectBins();

    expect(bins.getColumnCount()).toBe(1);

    applyProjectDocumentPatch(data, { blueLive: { type: 'insertColumn', index: 1 } });
    let snap = createBlueLiveProjectSnapshot(ld);
    expect(snap.bins.columns).toBe(2);

    applyProjectDocumentPatch(data, { blueLive: { type: 'removeColumn', index: 0 } });
    snap = createBlueLiveProjectSnapshot(ld);
    expect(snap.bins.columns).toBe(1);
  });

  it('applies captureEnabledSet and renameSet patches', () => {
    const data = new BlueData();
    const ld = data.getLiveData();
    const bins = ld.getLiveObjectBins();
    const obj = bins.getLiveObject(0, 0);
    if (obj) obj.setEnabled(true);

    applyProjectDocumentPatch(data, { blueLive: { type: 'captureEnabledSet' } });
    let snap = createBlueLiveProjectSnapshot(ld);
    expect(snap.sets).toHaveLength(1);
    expect(snap.sets[0].name).toBe('Set 1');

    applyProjectDocumentPatch(data, { blueLive: { type: 'renameSet', index: 0, name: 'My Set' } });
    snap = createBlueLiveProjectSnapshot(ld);
    expect(snap.sets[0].name).toBe('My Set');
  });

  it('applies removeSet patch', () => {
    const data = new BlueData();
    const ld = data.getLiveData();

    applyProjectDocumentPatch(data, { blueLive: { type: 'captureEnabledSet' } });
    applyProjectDocumentPatch(data, { blueLive: { type: 'captureEnabledSet' } });
    let snap = createBlueLiveProjectSnapshot(ld);
    expect(snap.sets).toHaveLength(2);

    applyProjectDocumentPatch(data, { blueLive: { type: 'removeSet', index: 0 } });
    snap = createBlueLiveProjectSnapshot(ld);
    expect(snap.sets).toHaveLength(1);
    expect(snap.sets[0].name).toBe('Set 2');
  });

  it('reports invalid saved-set removal as a canonical no-op', () => {
    const data = new BlueData();
    applyProjectDocumentPatch(data, { blueLive: { type: 'captureEnabledSet' } });

    const changed = applyProjectDocumentPatch(data, {
      blueLive: { type: 'removeSet', index: -1 },
    });

    expect(changed).toBe(false);
    expect(createBlueLiveProjectSnapshot(data.getLiveData()).sets).toHaveLength(1);
  });

  it('reports repeated saved-set application as a canonical no-op', () => {
    const data = new BlueData();
    const target = new LiveObject();
    target.setUniqueId('saved-target');
    target.setSoundObject(new GenericScore());
    target.setEnabled(true);
    data.getLiveData().getLiveObjectBins().setLiveObject(0, 0, target);
    applyProjectDocumentPatch(data, { blueLive: { type: 'captureEnabledSet' } });
    target.setEnabled(false);

    const first = applyProjectDocumentPatch(data, {
      blueLive: { type: 'applySet', index: 0 },
    });
    const repeated = applyProjectDocumentPatch(data, {
      blueLive: { type: 'applySet', index: 0 },
    });

    expect(first).toBe(true);
    expect(repeated).toBe(false);
  });

  it('applies moveSet patch', () => {
    const data = new BlueData();
    const ld = data.getLiveData();

    applyProjectDocumentPatch(data, { blueLive: { type: 'captureEnabledSet' } });
    applyProjectDocumentPatch(data, { blueLive: { type: 'captureEnabledSet' } });

    applyProjectDocumentPatch(data, { blueLive: { type: 'renameSet', index: 0, name: 'A' } });
    applyProjectDocumentPatch(data, { blueLive: { type: 'renameSet', index: 1, name: 'B' } });

    applyProjectDocumentPatch(data, { blueLive: { type: 'moveSet', from: 0, to: 1 } });
    const snap = createBlueLiveProjectSnapshot(ld);
    expect(snap.sets[0].name).toBe('B');
    expect(snap.sets[1].name).toBe('A');
  });

  it('round-trips through snapshot then back through patches', () => {
    const data = createProjectWithLiveData();
    const original = createBlueLiveProjectSnapshot(data.getLiveData());

    const data2 = createProjectWithLiveData();
    applyProjectDocumentPatch(data2, {
      blueLive: {
        type: 'updateOptions',
        patch: {
          commandLine: original.commandLine,
          commandLineEnabled: original.commandLineEnabled,
        },
      },
    });
    applyProjectDocumentPatch(data2, {
      blueLive: {
        type: 'updateTempoRepeat',
        patch: {
          tempo: original.tempo,
          repeat: original.repeat,
          repeatEnabled: original.repeatEnabled,
        },
      },
    });
    applyProjectDocumentPatch(data2, {
      blueLive: { type: 'updateLiveCodeText', text: original.liveCodeText },
    });

    const restored = createBlueLiveProjectSnapshot(data2.getLiveData());
    expect(restored.commandLine).toBe(original.commandLine);
    expect(restored.tempo).toBe(original.tempo);
    expect(restored.repeat).toBe(original.repeat);
    expect(restored.liveCodeText).toBe(original.liveCodeText);
  });
});
