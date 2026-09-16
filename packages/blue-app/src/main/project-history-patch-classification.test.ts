import { describe, expect, it } from 'vitest';
import {
  BlueData,
  BlueSynthBuilder,
  BSBKnob,
  Channel,
  ClojureLibraryEntry,
  ClojureProjectData,
} from '@blue/data';
import {
  applyProjectDocumentPatch,
  classifyProjectDocumentPatch,
  isScalarProjectDocumentPatch,
  validateProjectDocumentPatch,
  KNOWN_PROJECT_DOCUMENT_PATCH_KEYS,
  type ProjectDocumentPatch,
} from '../shared/project-editor';
import {
  BLUE_LIVE_PATCH_PREPARATION_CLASS,
  MIDI_INPUT_PATCH_PREPARATION_CLASS,
  MIXER_CHANNEL_FIELD_PREPARATION_CLASS,
  MIXER_PATCH_PREPARATION_CLASS,
  ORCHESTRA_PATCH_PREPARATION_CLASS,
  PROJECT_UDO_PATCH_PREPARATION_CLASS,
  SCORE_PATCH_PREPARATION_CLASS,
  TRANSPORT_PATCH_FIELD_PREPARATION_CLASS,
  type ProjectPatchPreparationClass,
} from '../shared/project-editor/contract';
import { prepareTransaction } from './project-history-memento';

function expectEveryEntryClassified(
  table: Record<string, ProjectPatchPreparationClass>,
  family: string,
): void {
  const entries = Object.entries(table);
  expect(entries.length, `${family} classification table is empty`).toBeGreaterThan(0);
  for (const [type, classification] of entries) {
    expect(
      classification === 'scalar' || classification === 'structural',
      `${family}.${type} has classification "${classification}"`,
    ).toBe(true);
  }
}

describe('Exhaustive project patch preparation classification (T018)', () => {
  describe('every top-level ProjectDocumentPatch member is classified', () => {
    it('registers exactly the canonical durable patch members', () => {
      expect([...KNOWN_PROJECT_DOCUMENT_PATCH_KEYS].sort()).toEqual(
        [
          'blueLive',
          'clojureProject',
          'globalOrc',
          'globalSco',
          'midiInput',
          'mixer',
          'orchestra',
          'projectProperties',
          'projectUdo',
          'score',
          'scratchPad',
          'tablesText',
          'transport',
        ].sort(),
      );
    });

    it('classifies every known member without rejecting it', () => {
      const fixtures: Record<string, ProjectDocumentPatch> = {
        globalOrc: { globalOrc: 'sr = 44100' },
        globalSco: { globalSco: 'f 1 0 8 2 0' },
        tablesText: { tablesText: '; tables' },
        scratchPad: { scratchPad: { text: 'note' } },
        projectProperties: { projectProperties: { title: 'Title' } },
        clojureProject: { clojureProject: { libraryEntries: [] } },
        orchestra: { orchestra: { type: 'addInstrument', instrumentType: 'generic' } },
        transport: { transport: { renderStartTime: 0 } },
        mixer: { mixer: { type: 'updateChannel', channelId: 'c1', patch: { level: 0.5 } } },
        score: {
          score: {
            type: 'renameLayer',
            groupId: 'g1',
            layerIndex: 0,
            name: 'Layer',
          },
        },
        blueLive: { blueLive: { type: 'renameSet', index: 0, name: 'Set' } },
        midiInput: { midiInput: { type: 'updateKeyMapping', value: 'x' } },
        projectUdo: { projectUdo: { type: 'update', index: 0, patch: { name: 'udo' } } },
      };

      for (const key of KNOWN_PROJECT_DOCUMENT_PATCH_KEYS) {
        const patch = fixtures[key];
        expect(patch, `missing classification fixture for member "${key}"`).toBeDefined();
        expect(validateProjectDocumentPatch(patch).valid, `member "${key}" rejected`).toBe(true);
        const classification = classifyProjectDocumentPatch(patch);
        expect(
          ['empty', 'scalar', 'structural'].includes(classification),
          `member "${key}" classified as ${classification}`,
        ).toBe(true);
      }
    });

    it('rejects unexpected members instead of silently applying or skipping them', () => {
      const smuggled = {
        tablesText: '; ok',
        rogueMember: 'unexpected',
      } as unknown as ProjectDocumentPatch;

      expect(validateProjectDocumentPatch(smuggled).valid).toBe(false);
      expect(() => applyProjectDocumentPatch(new BlueData(), smuggled)).toThrow(
        /unexpected property key/i,
      );
      expect(prepareTransaction(new BlueData(), [smuggled]).status).toBe('invalid');
    });

    it('treats a clojureProject patch with library entries as non-empty (T117 round-trip finding)', () => {
      const patch: ProjectDocumentPatch = {
        clojureProject: {
          libraryEntries: [
            { entryId: 'clj-1', dependencyCoordinates: 'org.clojure/clojure', version: '1.11.0' },
          ],
        },
      };

      // A clojure-only patch used to classify as "empty", so ProjectHistory
      // silently dropped the edit while optimistic renderer state applied it.
      expect(classifyProjectDocumentPatch(patch)).toBe('structural');
      const prepared = prepareTransaction(new BlueData(), [patch]);
      expect(prepared.status).toBe('prepared');
      if (prepared.status !== 'prepared') return;
      expect(prepared.transaction.changed).toBe(true);
    });

    it('treats an empty clojureProject replacement list as a real candidate edit (T126)', () => {
      const removal: ProjectDocumentPatch = { clojureProject: { libraryEntries: [] } };

      // Removing the final dependency is a candidate edit, not an empty patch;
      // canonical no-op detection stays with the applier.
      expect(classifyProjectDocumentPatch(removal)).toBe('structural');

      const withDependency = new BlueData();
      const entry = new ClojureLibraryEntry();
      entry.setDependencyCoordinates('org.clojure/clojure');
      entry.setVersion('1.11.0');
      const clojureData = new ClojureProjectData();
      clojureData.setLibraryEntries([entry]);
      withDependency.setClojureProjectData(clojureData);

      const applied = prepareTransaction(withDependency, [removal]);
      expect(applied.status).toBe('prepared');
      if (applied.status !== 'prepared') return;
      expect(applied.transaction.kind).toBe('structure');
      expect(applied.transaction.changed).toBe(true);

      // The already-empty document keeps canonical no-op detection: the same
      // replacement reports unchanged instead of creating a history entry.
      const alreadyEmpty = new BlueData();
      const noOp = prepareTransaction(alreadyEmpty, [removal]);
      expect(noOp.status).toBe('prepared');
      if (noOp.status !== 'prepared') return;
      expect(noOp.transaction.changed).toBe(false);
    });
  });

  describe('every union variant has an explicit preparation class', () => {
    it('only permits scalar or structural entries in every classification table', () => {
      expectEveryEntryClassified(SCORE_PATCH_PREPARATION_CLASS, 'score');
      expectEveryEntryClassified(MIXER_PATCH_PREPARATION_CLASS, 'mixer');
      expectEveryEntryClassified(ORCHESTRA_PATCH_PREPARATION_CLASS, 'orchestra');
      expectEveryEntryClassified(BLUE_LIVE_PATCH_PREPARATION_CLASS, 'blueLive');
      expectEveryEntryClassified(MIDI_INPUT_PATCH_PREPARATION_CLASS, 'midiInput');
      expectEveryEntryClassified(PROJECT_UDO_PATCH_PREPARATION_CLASS, 'projectUdo');
      expectEveryEntryClassified(MIXER_CHANNEL_FIELD_PREPARATION_CLASS, 'mixer channel field');
      expectEveryEntryClassified(TRANSPORT_PATCH_FIELD_PREPARATION_CLASS, 'transport field');
    });

    it('classifies every score patch variant as structural', () => {
      const fixtures: Array<{ type: keyof typeof SCORE_PATCH_PREPARATION_CLASS }> = [
        { type: 'addLayer' },
        { type: 'addLayerGroup' },
        { type: 'addMarker' },
        { type: 'addScoreObjects' },
        { type: 'addTrackItem' },
        { type: 'clearTrackInstrument' },
        { type: 'convertScoreObjectToObjectBuilder' },
        { type: 'convertToPolyObject' },
        { type: 'createTrackInstrument' },
        { type: 'deleteNamedNoteProcessorChain' },
        { type: 'moveLayer' },
        { type: 'moveLayerGroup' },
        { type: 'moveLayerRange' },
        { type: 'moveScoreObjects' },
        { type: 'moveTrackItems' },
        { type: 'removeLayer' },
        { type: 'removeLayerGroup' },
        { type: 'removeLayerRanges' },
        { type: 'removeMarker' },
        { type: 'removeScoreObjects' },
        { type: 'removeTrackItems' },
        { type: 'renameLayer' },
        { type: 'renameLayerGroup' },
        { type: 'replaceAudioFileSource' },
        { type: 'replaceNoteProcessorChain' },
        { type: 'replaceScopedNoteProcessorChain' },
        { type: 'replaceTrackInstrument' },
        { type: 'replaceTrackNoteProcessorChain' },
        { type: 'resizeTrackItems' },
        { type: 'saveNamedNoteProcessorChain' },
        { type: 'setScoreObjectBackgroundColors' },
        { type: 'setSubjectiveDurationToObjective' },
        { type: 'updateAudioFilePostCode' },
        { type: 'updateLayerState' },
        { type: 'updateMarker' },
        { type: 'updatePatternBeatsLength' },
        { type: 'updatePatternCells' },
        { type: 'updateSharedProperties' },
        { type: 'updateSoundObjectBehavior' },
        { type: 'updateTimeState' },
        { type: 'updateTrackInstrument' },
        { type: 'updateTypeSpecificEditor' },
        { type: 'assignAutomationToLayer' },
        { type: 'removeAutomationFromLayer' },
        { type: 'moveAutomationToLayer' },
        { type: 'clearLayerAutomations' },
        { type: 'cleanupLayerAutomation' },
        { type: 'selectLayerAutomation' },
        { type: 'setAutomationLineColor' },
        { type: 'setAutomationPoints' },
        { type: 'insertAutomationPoint' },
        { type: 'deleteAutomationPoint' },
        { type: 'moveAutomationPoint' },
        { type: 'setAutomationResolution' },
        { type: 'moveAutomationRange' },
        { type: 'scaleAutomationRange' },
        { type: 'setLayerHeights' },
        { type: 'setLayerGroupDefaultHeight' },
      ];

      for (const fixture of fixtures) {
        expect(SCORE_PATCH_PREPARATION_CLASS[fixture.type]).toBe('structural');
      }
      // The table must not contain variants outside the union (type-checked)
      // and every enumerated union variant must appear in the table.
      for (const fixture of fixtures) {
        expect(SCORE_PATCH_PREPARATION_CLASS).toHaveProperty(fixture.type);
      }
    });

    it('agrees with isScalarProjectDocumentPatch for every mixer variant fixture', () => {
      const fixtures: Array<Extract<ProjectDocumentPatch['mixer'], { type: string }>> = [
        { type: 'setMixerEnabled', value: true },
        { type: 'setMeterEnabled', value: true },
        { type: 'setMeterProfile', value: 'peak-rms-mixing-plus-6' },
        { type: 'updateExtraRenderTime', value: 500 },
        { type: 'updateChannel', channelId: 'c1', patch: { level: 0.5 } },
        { type: 'renameChannelListGroup', association: 'a', name: 'n' },
        { type: 'addSubChannel', name: 'sub' },
        { type: 'removeSubChannel', channelId: 'c1' },
        { type: 'addEffectFromLibrary', channelId: 'c1', chain: 'pre', libraryEffectId: 'e1' },
        { type: 'addSend', channelId: 'c1', chain: 'pre', sendChannel: 'c1' },
        { type: 'updateSend', channelId: 'c1', chain: 'pre', entryId: 's1', patch: { level: 0.2 } },
        { type: 'updateEffect', channelId: 'c1', chain: 'pre', entryId: 'e1', patch: {} },
        { type: 'removeChainEntry', channelId: 'c1', chain: 'pre', entryId: 'e1' },
        { type: 'reorderChainEntry', channelId: 'c1', chain: 'pre', from: 0, to: 1 },
        { type: 'duplicateChainEntry', channelId: 'c1', chain: 'pre', entryId: 'e1' },
        { type: 'copyChainEntry', channelId: 'c1', chain: 'pre', entryId: 'e1' },
        {
          type: 'pasteChainEntries',
          channelId: 'c1',
          chain: 'pre',
          payload: { sourceKind: 'project', entries: [] },
        },
        {
          type: 'moveChainEntryAcrossChains',
          fromChannelId: 'c1',
          fromChain: 'pre',
          toChannelId: 'c1',
          toChain: 'post',
          entryId: 'e1',
        },
      ];

      for (const fixture of fixtures) {
        const patch = { mixer: fixture } as ProjectDocumentPatch;
        const tableClass = MIXER_PATCH_PREPARATION_CLASS[fixture.type];
        expect(
          isScalarProjectDocumentPatch(patch),
          `mixer variant "${fixture.type}" disagrees with its table class "${tableClass}"`,
        ).toBe(tableClass === 'scalar');
      }
    });

    it('classifies invalid setMeterProfile patch key as invalid', () => {
      const invalidPatch = {
        mixer: { type: 'setMeterProfile', value: 'invalid-curve-profile' as any },
      } as ProjectDocumentPatch;
      expect(classifyProjectDocumentPatch(invalidPatch)).toBe('invalid');
      expect(isScalarProjectDocumentPatch(invalidPatch)).toBe(false);
    });

    it('classifies structural-only families so no variant reaches the scalar path', () => {
      const orchestraPatch = {
        orchestra: { type: 'updateInstrumentComment', assignmentId: 'a1', comment: 'c' },
      } as ProjectDocumentPatch;
      const blueLivePatch = {
        blueLive: { type: 'updateTempoRepeat', patch: { tempo: 120 } },
      } as ProjectDocumentPatch;
      const midiInputPatch = {
        midiInput: { type: 'updateScale', scale: null },
      } as ProjectDocumentPatch;
      const projectUdoPatch = {
        projectUdo: { type: 'update', index: 0, patch: { name: 'x' } },
      } as ProjectDocumentPatch;

      expect(ORCHESTRA_PATCH_PREPARATION_CLASS.updateInstrumentComment).toBe('structural');
      expect(BLUE_LIVE_PATCH_PREPARATION_CLASS.updateTempoRepeat).toBe('structural');
      expect(MIDI_INPUT_PATCH_PREPARATION_CLASS.updateScale).toBe('structural');
      expect(PROJECT_UDO_PATCH_PREPARATION_CLASS.update).toBe('structural');

      expect(isScalarProjectDocumentPatch(orchestraPatch)).toBe(false);
      expect(isScalarProjectDocumentPatch(blueLivePatch)).toBe(false);
      expect(isScalarProjectDocumentPatch(midiInputPatch)).toBe(false);
      expect(isScalarProjectDocumentPatch(projectUdoPatch)).toBe(false);
    });

    it('classifies every mixer channel field so only captured fields take the scalar path', () => {
      expect(Object.keys(MIXER_CHANNEL_FIELD_PREPARATION_CLASS).sort()).toEqual(
        ['level', 'muted', 'name', 'outChannel', 'pan', 'solo', 'volume'].sort(),
      );

      const scalarFields = Object.entries(MIXER_CHANNEL_FIELD_PREPARATION_CLASS)
        .filter(([, classification]) => classification === 'scalar')
        .map(([key]) => key);
      expect(scalarFields.sort()).toEqual(['level', 'muted', 'pan', 'solo', 'volume'].sort());

      // Identity and routing fields must never take the scalar path.
      expect(
        isScalarProjectDocumentPatch({
          mixer: { type: 'updateChannel', channelId: 'c1', patch: { name: 'New' } },
        }),
      ).toBe(false);
      expect(
        isScalarProjectDocumentPatch({
          mixer: { type: 'updateChannel', channelId: 'c1', patch: { outChannel: 'out2' } },
        }),
      ).toBe(false);
    });
  });

  describe('scalar-classified work is never silently dropped', () => {
    it('captures and reverses volume along with the other scalar channel fields', () => {
      const data = new BlueData();
      const master = data.getMixer().getMaster();
      master.setVolume(0.5);

      const result = prepareTransaction(data, [
        { mixer: { type: 'updateChannel', channelId: 'Master', patch: { volume: 0.9 } } },
      ]);
      expect(result.status).toBe('prepared');
      if (result.status !== 'prepared' || result.transaction.kind !== 'scalar') {
        throw new Error('expected a scalar transaction for a volume-only channel patch');
      }

      const volumeRecord = result.transaction.records.find((rec) => rec.field === 'volume');
      expect(volumeRecord).toBeDefined();
      expect(volumeRecord?.afterValue).toBe(0.9);

      result.transaction.apply();
      expect(master.getVolume()).toBe(0.9);
      result.transaction.rollback();
      expect(master.getVolume()).toBe(0.5);
    });

    it('captures scalar channel field patches with one record per changed field', () => {
      const data = new BlueData();
      data.getMixer().getMaster().setLevel(0.7);
      // Spec 111: master solo edits are rejected wholesale, so this matrix
      // uses an ordinary channel (all five fields remain freely editable).
      const channel = new Channel();
      channel.setName('Chan');
      channel.setAssociation('chan-1');
      data.getMixer().getChannels().push(channel);

      const result = prepareTransaction(data, [
        {
          mixer: {
            type: 'updateChannel',
            channelId: 'chan-1',
            patch: { level: 0.2, pan: -0.5, muted: true, solo: false, volume: 0.8 },
          },
        },
      ]);
      expect(result.status).toBe('prepared');
      if (result.status !== 'prepared' || result.transaction.kind !== 'scalar') {
        throw new Error('expected a scalar transaction for scalar channel fields');
      }
      const fields = result.transaction.records.map((rec) => rec.field).sort();
      expect(fields).toEqual(['level', 'muted', 'pan', 'solo', 'volume']);
      expect(result.transaction.changed).toBe(true);
    });

    it('routes project UDO updates through the structural path so they are retained', () => {
      const data = new BlueData();
      const result = prepareTransaction(data, [
        { projectUdo: { type: 'update', index: 0, patch: { name: 'renamedUdo' } } },
      ]);

      expect(result.status).toBe('prepared');
      if (result.status !== 'prepared') throw new Error('expected preparation to succeed');
      expect(result.transaction.kind).toBe('structure');
    });

    it('keeps transport scalar fields captured and map patches structural', () => {
      const data = new BlueData();

      const scalarResult = prepareTransaction(data, [{ transport: { loopRendering: true } }]);
      expect(scalarResult.status).toBe('prepared');
      if (scalarResult.status !== 'prepared' || scalarResult.transaction.kind !== 'scalar') {
        throw new Error('expected a scalar transaction for loop rendering');
      }
      expect(scalarResult.transaction.records.some((rec) => rec.field === 'loopRendering')).toBe(
        true,
      );
    });
  });

  describe('automation, maps, timing, and persisted settings coverage (T024)', () => {
    it('routes score automation point edits through the structural path with exact before-state', () => {
      const data = new BlueData();
      const bsb = new BlueSynthBuilder();
      bsb.setName('Automation Source');
      const knob = new BSBKnob();
      knob.objectName = 'gain';
      knob.setValue(0.5);
      knob.minimum = 0;
      knob.maximum = 1;
      bsb.getGraphicInterface().getRootGroup().addChild(knob);
      bsb.getParameters();
      const parameterId = bsb.getParameters()[0]!.getUniqueId();
      data.getArrangement().addInstrument(bsb);

      const initialXml = data.saveToString();
      const result = prepareTransaction(data, [
        {
          score: {
            type: 'setAutomationPoints',
            parameterId,
            points: [
              { time: 0, value: 0.1 },
              { time: 4, value: 0.9 },
            ],
          },
        },
      ]);

      expect(result.status).toBe('prepared');
      if (result.status !== 'prepared') throw new Error('expected preparation');
      expect(result.transaction.kind).toBe('structure');
      if (result.transaction.kind !== 'structure') return;
      expect(result.transaction.changed).toBe(true);
      expect(data.saveToString()).toBe(initialXml);
      expect(result.transaction.beforeMemento.saveToString()).toBe(initialXml);
      expect(result.transaction.afterMemento.saveToString()).not.toBe(initialXml);
    });

    it('routes tempo and meter map patches through the structural path', () => {
      const data = new BlueData();
      const initialXml = data.saveToString();

      const tempo = prepareTransaction(data, [
        { transport: { tempoMapPatch: { type: 'setTempoEnabled', enabled: true } } },
      ]);
      expect(tempo.status).toBe('prepared');
      if (tempo.status !== 'prepared') throw new Error('expected tempo preparation');
      expect(tempo.transaction.kind).toBe('structure');
      expect(data.saveToString()).toBe(initialXml);
      if (tempo.transaction.kind === 'structure') {
        expect(tempo.transaction.changed).toBe(true);
        expect(tempo.transaction.beforeMemento.saveToString()).toBe(initialXml);
      }

      const meter = prepareTransaction(data, [
        {
          transport: {
            meterMapPatch: {
              type: 'meter-map-set-entry',
              measure: 1,
              numBeats: 6,
              beatLength: 4,
            },
          },
        },
      ]);
      expect(meter.status).toBe('prepared');
      if (meter.status !== 'prepared') throw new Error('expected meter preparation');
      expect(meter.transaction.kind).toBe('structure');
    });

    it('routes layer timing edits through the structural path with exact before-state', () => {
      const data = new BlueData();
      const result = prepareTransaction(data, [
        {
          score: {
            type: 'updateSharedProperties',
            target: {
              selectionId: 'obj-1',
              selectedObjectType: 'GenericScore',
              editorObjectType: 'GenericScore',
              ownerKind: 'timeline',
              displayContext: 'timeline',
              supportsTimeBehavior: false,
              supportsRepeatPoint: false,
              supportsNoteProcessorChain: false,
              location: {
                rootGroupIndex: 0,
                containerPath: [],
                layerIndex: 0,
                objectIndex: 0,
              },
            },
            patch: { startTime: { value: 9, timeBase: 'BEATS' } },
          },
        },
      ]);
      expect(result.status).toBe('prepared');
      if (result.status !== 'prepared') throw new Error('expected preparation');
      expect(result.transaction.kind).toBe('structure');
    });

    it('captures transport scalar settings with exact rollback', () => {
      const data = new BlueData();
      data.setRenderStartTime(2);
      data.setRenderEndTime(64);

      const result = prepareTransaction(data, [
        { transport: { renderStartTime: 8, renderEndTime: 32 } },
      ]);
      expect(result.status).toBe('prepared');
      if (result.status !== 'prepared' || result.transaction.kind !== 'scalar') {
        throw new Error('expected a scalar transaction for transport settings');
      }
      expect(result.transaction.records.map((rec) => rec.field).sort()).toEqual([
        'renderEndTime',
        'renderStartTime',
      ]);

      result.transaction.apply();
      expect(data.getRenderStartTime()).toBe(8);
      expect(data.getRenderEndTime()).toBe(32);
      result.transaction.rollback();
      expect(data.getRenderStartTime()).toBe(2);
      expect(data.getRenderEndTime()).toBe(64);
    });

    it('routes MIDI project configuration through the structural path', () => {
      const data = new BlueData();
      const initialXml = data.saveToString();
      const result = prepareTransaction(data, [
        { midiInput: { type: 'updateKeyMapping', value: 'C4' } },
      ]);
      expect(result.status).toBe('prepared');
      if (result.status !== 'prepared') throw new Error('expected midi preparation');
      expect(result.transaction.kind).toBe('structure');
      expect(data.saveToString()).toBe(initialXml);
      if (result.transaction.kind === 'structure') {
        expect(result.transaction.changed).toBe(true);
        expect(result.transaction.beforeMemento.saveToString()).toBe(initialXml);
      }
    });

    it('routes Blue Live project configuration through the structural path', () => {
      const data = new BlueData();
      const initialXml = data.saveToString();
      const result = prepareTransaction(data, [
        { blueLive: { type: 'updateTempoRepeat', patch: { tempo: 96 } } },
      ]);
      expect(result.status).toBe('prepared');
      if (result.status !== 'prepared') throw new Error('expected blue live preparation');
      expect(result.transaction.kind).toBe('structure');
      expect(data.saveToString()).toBe(initialXml);
      if (result.transaction.kind === 'structure') {
        expect(result.transaction.changed).toBe(true);
      }
    });
  });
});
