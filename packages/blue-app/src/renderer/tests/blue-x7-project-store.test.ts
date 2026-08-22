// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __testClearPendingPatches,
  useProjectStore,
} from '../stores/project-store';
import {
  createEmptyProjectEditorSnapshot,
  BlueX7InstrumentSnapshot,
} from '../../shared/project-editor';
import { createDefaultBlueX7Voice } from '@blue/data';

describe('project-store — BlueX7 optimistic projection & reconciliation', () => {
  const commitProjectDocumentPatches = vi.fn();
  const getProjectDocument = vi.fn();

  beforeEach(() => {
    __testClearPendingPatches();
    useProjectStore.getState().clearProject();

    const snapshot = createEmptyProjectEditorSnapshot();
    const voice = createDefaultBlueX7Voice();
    const x7Snapshot: BlueX7InstrumentSnapshot = {
      assignmentId: '1',
      type: 'blueX7',
      name: 'BlueX7 Patch',
      comment: 'Initial FM synth',
      enabled: true,
      voice,
      sharedOscillatorSync: 1,
      sharedPitchModulationSensitivity: 0,
    };

    snapshot.loaded = true;
    snapshot.sessionId = 1;
    snapshot.orchestra.instruments = [x7Snapshot];
    snapshot.orchestra.arrangement.rows = [{
      assignmentId: '1',
      enabled: true,
      instrumentName: 'BlueX7 Patch',
      instrumentType: 'blueX7',
      instrumentSummary: 'BlueX7',
      editable: true,
    }];

    useProjectStore.getState().setProjectInfo({
      ...snapshot,
      filePath: '/tmp/test-bluex7.blue',
    });

    window.blueAPI = {
      ...window.blueAPI,
      commitProjectDocumentPatches,
      getProjectDocument,
    };
    commitProjectDocumentPatches.mockReset();
    commitProjectDocumentPatches.mockResolvedValue({
      revision: 1,
      sessionId: 1,
      changed: true,
    });
    getProjectDocument.mockReset();
    getProjectDocument.mockResolvedValue(null);
  });

  afterEach(() => {
    __testClearPendingPatches();
    useProjectStore.getState().clearProject();
  });

  it('optimistically updates BlueX7 common fields and operator enable flags', async () => {
    await useProjectStore.getState().applyProjectDocumentPatch({
      orchestra: {
        type: 'updateInstrument',
        assignmentId: '1',
        patch: {
          blueX7: {
            type: 'setCommonField',
            field: 'algorithm',
            value: 9,
          },
        },
      },
    });

    const instrument1 = useProjectStore.getState().orchestra.instruments[0] as BlueX7InstrumentSnapshot;
    expect(instrument1.voice.common.algorithm).toBe(9);

    await useProjectStore.getState().applyProjectDocumentPatch({
      orchestra: {
        type: 'updateInstrument',
        assignmentId: '1',
        patch: {
          blueX7: {
            type: 'setOperatorEnabled',
            operatorIndex: 2,
            enabled: false,
          },
        },
      },
    });

    const instrument2 = useProjectStore.getState().orchestra.instruments[0] as BlueX7InstrumentSnapshot;
    expect(instrument2.voice.common.operatorEnabled[2]).toBe(false);
  });

  it('creates a complete default BlueX7 arrangement snapshot', async () => {
    const snapshot = createEmptyProjectEditorSnapshot();
    snapshot.loaded = true;
    snapshot.sessionId = 1;
    useProjectStore.getState().setProjectInfo({
      ...snapshot,
      filePath: '/tmp/test-bluex7-default.blue',
    });

    await useProjectStore.getState().applyProjectDocumentPatch({
      orchestra: {
        type: 'addInstrument',
        instrumentType: 'blueX7',
      },
    });

    const created = useProjectStore.getState().orchestra.instruments[0];
    expect(created?.type).toBe('blueX7');
    if (created?.type !== 'blueX7') throw new Error('expected a BlueX7 snapshot');
    expect(created.voice.common.algorithm).toBe(19);
    expect(created.sharedOscillatorSync).toBe(1);
    expect(created.sharedPitchModulationSensitivity).toBe(0);
  });

  it('optimistically creates a BlueX7 instrument on a Track layer', async () => {
    const snapshot = createEmptyProjectEditorSnapshot();
    snapshot.loaded = true;
    snapshot.sessionId = 1;
    snapshot.score!.layerGroups = [{
      groupId: 'track-group',
      groupType: 'track',
      name: 'Tracks',
      defaultHeightIndex: 1,
      layerCount: 1,
      isOpenableContainer: false,
      layers: [{
        layerId: 'track-layer',
        layerKind: 'track',
        layerSelectionId: 'track-layer-selection',
        name: 'Track',
        height: 22,
        muted: false,
        solo: false,
        items: [],
        instrument: null,
      }],
    }];
    useProjectStore.getState().setProjectInfo({
      ...snapshot,
      filePath: '/tmp/test-bluex7-track.blue',
    });

    await useProjectStore.getState().applyProjectDocumentPatch({
      score: {
        type: 'createTrackInstrument',
        track: {
          rootGroupId: 'track-group',
          trackId: 'track-layer',
          projectSessionId: 1,
          projectRevision: 0,
        },
        instrumentType: 'blueX7',
      },
    });

    const group = useProjectStore.getState().score.layerGroups[0];
    if (group?.groupType !== 'track') throw new Error('expected a Track group');
    expect(group.layers[0]?.instrument).toMatchObject({
      type: 'blueX7',
      instrumentType: 'blueX7',
      supported: true,
    });
  });

  it('optimistically updates LFO and operator fields and updates shared sync/PMS', async () => {
    await useProjectStore.getState().applyProjectDocumentPatch({
      orchestra: {
        type: 'updateInstrument',
        assignmentId: '1',
        patch: {
          blueX7: {
            type: 'setLfoField',
            field: 'speed',
            value: 72,
          },
        },
      },
    });

    let instr = useProjectStore.getState().orchestra.instruments[0] as BlueX7InstrumentSnapshot;
    expect(instr.voice.lfo.speed).toBe(72);

    // Change operator 0 sync to 0 -> shared sync becomes 'mixed'
    await useProjectStore.getState().applyProjectDocumentPatch({
      orchestra: {
        type: 'updateInstrument',
        assignmentId: '1',
        patch: {
          blueX7: {
            type: 'setOperatorField',
            operatorIndex: 0,
            field: 'sync',
            value: 0,
          },
        },
      },
    });

    instr = useProjectStore.getState().orchestra.instruments[0] as BlueX7InstrumentSnapshot;
    expect(instr.voice.operators[0].sync).toBe(0);
    expect(instr.sharedOscillatorSync).toBe('mixed');

    // Use setSharedOscillatorSync to set all back to 1
    await useProjectStore.getState().applyProjectDocumentPatch({
      orchestra: {
        type: 'updateInstrument',
        assignmentId: '1',
        patch: {
          blueX7: {
            type: 'setSharedOscillatorSync',
            value: 1,
          },
        },
      },
    });

    instr = useProjectStore.getState().orchestra.instruments[0] as BlueX7InstrumentSnapshot;
    expect(instr.sharedOscillatorSync).toBe(1);
    for (let i = 0; i < 6; i++) {
      expect(instr.voice.operators[i].sync).toBe(1);
    }
  });

  it('optimistically updates envelope points and whole-voice replacement', async () => {
    await useProjectStore.getState().applyProjectDocumentPatch({
      orchestra: {
        type: 'updateInstrument',
        assignmentId: '1',
        patch: {
          blueX7: {
            type: 'setOperatorEnvelopePoint',
            operatorIndex: 0,
            stageIndex: 3,
            point: { rate: 85, level: 10 },
          },
        },
      },
    });

    let instr = useProjectStore.getState().orchestra.instruments[0] as BlueX7InstrumentSnapshot;
    expect(instr.voice.operators[0].envelope[3]).toEqual({ rate: 85, level: 10 });

    const newVoice = createDefaultBlueX7Voice();
    newVoice.common.algorithm = 28;
    newVoice.csoundPostCode = 'outs aout, aout';

    await useProjectStore.getState().applyProjectDocumentPatch({
      orchestra: {
        type: 'updateInstrument',
        assignmentId: '1',
        patch: {
          blueX7: {
            type: 'replaceVoice',
            voice: newVoice,
          },
        },
      },
    });

    instr = useProjectStore.getState().orchestra.instruments[0] as BlueX7InstrumentSnapshot;
    expect(instr.voice.common.algorithm).toBe(28);
    expect(instr.voice.csoundPostCode).toBe('outs aout, aout');
  });
});
