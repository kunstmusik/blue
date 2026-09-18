import { describe, expect, it } from 'vitest';
import {
  AddProcessor,
  getProjectParameterCatalog,
  AudioFile,
  BlueData,
  BSBKnob,
  BSBHSlider,
  BSBHSliderBank,
  BSBDropdown,
  BlueSynthBuilder,
  Channel,
  Effect,
  GenericInstrument,
  GenericScore,
  LiveObject,
  NoteProcessorChain,
  ObjectBuilder,
  PolyObject,
  PatternsLayerGroup,
  PythonObject,
  TrackLayer,
  TrackLayerGroup,
} from '@blue/data';
import { ProjectSession } from './project-session';
import type { ProjectSession as ProjectSessionType } from './project-session';
import { ProjectHistory } from './project-history';
import { FakePublicationRecorder, MockHistoryContext } from './project-history-test-support';
import {
  assignExplicitScoreObjectId,
  assignLayerGroupId,
  assignLayerSelectionId,
  assignPatternLayerId,
  getMixerChannelSnapshotId,
  getMixerEntrySnapshotId,
  getScoreObjectId,
} from '../shared/project-editor/identity';
import {
  createMixerSnapshot,
  createOrchestraSnapshot,
  createClojureProjectSnapshot,
} from '../shared/project-editor/snapshot-mixer-orchestra';
import { createNoteProcessorChainSnapshot } from '../shared/project-editor/snapshot-score';
import {
  applyProjectDocumentPatch,
  createProjectEditorSnapshot,
  type ProjectDocumentPatch,
} from '../shared/project-editor';
import type {
  BsbInterfacePatch,
  MixerChainEntrySnapshot,
  ScoreObjectEditorTargetSnapshot,
} from '../shared/project-editor/contract';
import {
  BLUE_LIVE_PATCH_PREPARATION_CLASS,
  MIDI_INPUT_PATCH_PREPARATION_CLASS,
  MIXER_PATCH_PREPARATION_CLASS,
  ORCHESTRA_PATCH_PREPARATION_CLASS,
  PROJECT_UDO_PATCH_PREPARATION_CLASS,
  SCORE_PATCH_PREPARATION_CLASS,
  TRANSPORT_PATCH_FIELD_PREPARATION_CLASS,
} from '../shared/project-editor/contract';

/**
 * T117: table-driven commit → undo → redo round trips for every
 * ProjectDocumentPatch variant through a real ProjectHistory/ProjectSession.
 *
 * The fixture table below is completeness-checked against the preparation
 * classification tables: a variant added to the patch union without a
 * round-trip fixture fails this suite. Structural variants restore from
 * detached history-copy mementos, so exact canonical equality of the whole
 * document (the affected-subtree superset) is asserted via saveToString().
 */

interface RoundTripCase {
  family: string;
  type: string;
  /** Patches applied as one committed action on a freshly built project. */
  patches: (data: BlueData, session: ProjectSessionType) => ProjectDocumentPatch[];
  /** JSON-able identity fingerprint asserted stable across undo and redo. */
  identity?: (data: BlueData) => unknown;
  /**
   * Canonical state fingerprint asserted to change on commit and restore
   * exactly on undo/redo. Defaults to the whole-document XML; variants whose
   * affected state is not serialized (editor selection, resolution text)
   * supply a superset fingerprint.
   */
  fingerprint?: (data: BlueData) => string;
  /** Variant intentionally mutates nothing: no history entry is created. */
  noOp?: boolean;
}

/** A real note-processor chain snapshot built from live model objects. */
function noteProcessorChain(): ReturnType<typeof createNoteProcessorChainSnapshot> {
  const chain = new NoteProcessorChain();
  const add = new AddProcessor();
  add.setVal('1.0');
  chain.addProcessor(add);
  return createNoteProcessorChainSnapshot(chain);
}

function buildProject(): BlueData {
  const data = new BlueData();

  const instrument = new GenericInstrument();
  instrument.setName('Lead');
  instrument.setComment('original comment');
  data.getArrangement().addInstrument(instrument, '1');

  const channel = new Channel();
  channel.setName('Lead Channel');
  channel.setAssociation('1');
  data.getMixer().getChannels().splice(0, 0, channel);

  const bsb = new BlueSynthBuilder();
  bsb.setName('Automation Source');
  for (const knobName of ['gain', 'tone']) {
    const knob = new BSBKnob();
    knob.objectName = knobName;
    knob.setValue(0.5);
    knob.minimum = 0;
    knob.maximum = 1;
    bsb.getGraphicInterface().getRootGroup().addChild(knob);
  }
  bsb.getParameters();
  data.getArrangement().addInstrument(bsb);

  const score = data.getScore();
  score.length = 0;
  const group = new TrackLayerGroup();
  score.push(group);
  const layer0 = group.newLayerAt(0);
  layer0.setName('Layer 0');
  const layer1 = group.newLayerAt(1);
  layer1.setName('Layer 1');

  const obj = new GenericScore();
  obj.setName('Lead Object');
  assignExplicitScoreObjectId(obj, 'sobj-1');
  layer0.push(obj);

  return data;
}

function scoreGroup(data: BlueData): TrackLayerGroup {
  return data.getScore()[0] as TrackLayerGroup;
}

function groupId(data: BlueData): string {
  return scoreGroup(data).getUniqueId();
}

function scoreLayer(data: BlueData, index: number): TrackLayer {
  return scoreGroup(data)[index]!;
}

function scoreObjectTarget(
  data: BlueData,
  layerIndex = 0,
  objectIndex = 0,
): ScoreObjectEditorTargetSnapshot {
  return {
    selectionId: 'sobj-1',
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
      layerIndex,
      objectIndex,
    },
  };
}

function trackRef(data: BlueData, session: ProjectSessionType) {
  return {
    rootGroupId: groupId(data),
    trackId: scoreLayer(data, 0).getUniqueId(),
    projectSessionId: session.read().sessionId,
    projectRevision: session.read().revision,
  };
}

/** Context matching the current session for direct applier calls in setup. */
function patchContext(session: ProjectSessionType) {
  return {
    projectSessionId: session.read().sessionId,
    projectRevision: session.read().revision,
  };
}

function effectXml(name = 'Delay'): string {
  const effect = new Effect();
  effect.setName(name);
  effect.setComments('Library note');
  effect.setCode('aout = ain * 0.5');
  effect.setEnabled(true);
  effect.setNumIns(1);
  effect.setNumOuts(1);
  return effect.saveAsXML().toXml();
}

function clipboardEffectEntry(name: string): MixerChainEntrySnapshot {
  return {
    entryId: `clipboard-${name}`,
    kind: 'effect' as const,
    effectXml: effectXml(name),
    name,
    enabled: true,
    numIns: 1,
    numOuts: 1,
    style: 'CLASSIC' as const,
    code: 'aout = ain',
    comments: '',
    editEnabled: false,
    gridSettings: { enabled: false, snapEnabled: false, width: 10, height: 10, gridStyle: 'NONE' },
    objectNames: [],
    widgets: [],
    widgetTree: {
      id: 'tree-root',
      type: 'bsbCanvas',
      objectName: '',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      value: 0,
      minimum: 0,
      maximum: 0,
      editable: false,
      properties: {},
      children: [],
    },
    udos: [],
  };
}

function preChainEntryIds(data: BlueData): string[] {
  const snapshot = createMixerSnapshot(data.getMixer());
  const channel = snapshot.channels.find((entry) => entry.name === 'Lead Channel');
  return (channel?.preChain ?? []).map((entry) => entry.entryId);
}

function mixerChannelEntryId(data: BlueData): string | undefined {
  return createMixerSnapshot(data.getMixer()).channels.find(
    (entry) => entry.name === 'Lead Channel',
  )?.id;
}

function assignmentId(data: BlueData): string {
  const rows = createOrchestraSnapshot(data).arrangement.rows;
  return rows[0]!.assignmentId!;
}

function automationParameterId(data: BlueData, index = 0): string {
  const rows = createOrchestraSnapshot(data).arrangement.rows;
  const bsbRow = rows.find((row) => row.instrumentType === 'blueSynthBuilder');
  if (!bsbRow) throw new Error('BSB instrument missing from fixture');
  const bsb = data.getArrangement().getInstrumentById(bsbRow.assignmentId) as BlueSynthBuilder;
  return bsb.getParameters()[index]!.getUniqueId();
}

function mixerParameterId(data: BlueData): string {
  const entry = getProjectParameterCatalog(data).find(
    (candidate) => candidate.ownerKind === 'mixer',
  );
  if (!entry) throw new Error('mixer parameter missing from fixture');
  return entry.parameter.getUniqueId();
}

function addMarker(data: BlueData, name: string): void {
  applyProjectDocumentPatch(data, { score: { type: 'addMarker', timeBeats: 4, name } });
}

function addPreChainEffect(data: BlueData, entryId: string, name = 'Reverb'): void {
  applyProjectDocumentPatch(data, {
    mixer: {
      type: 'addEffectFromLibrary',
      channelId: getMixerChannelSnapshotId(data.getMixer().getChannels()[0]!),
      chain: 'pre',
      libraryEffectId: 'library-effect-1',
      effectXml: effectXml(name),
      entryId,
    },
  });
}

function captureSets(data: BlueData, count: number): void {
  for (let i = 0; i < count; i++) {
    applyProjectDocumentPatch(data, { blueLive: { type: 'captureEnabledSet' } });
  }
}

function placeTrackItem(data: BlueData, session: ProjectSessionType): void {
  applyProjectDocumentPatch(
    data,
    {
      score: {
        type: 'addTrackItem',
        track: trackRef(data, session),
        item: { objectType: 'GenericScore', name: 'Track Item', durationBeats: 4 },
        startBeats: 0,
      },
    },
    patchContext(session),
  );
}

function placeTrackInstrument(data: BlueData, session: ProjectSessionType): void {
  applyProjectDocumentPatch(
    data,
    {
      score: {
        type: 'createTrackInstrument',
        track: trackRef(data, session),
        instrumentType: 'generic',
      },
    },
    patchContext(session),
  );
}

function placeLiveCell(data: BlueData, uniqueId = 'cell-1'): void {
  const bins = data.getLiveData().getLiveObjectBins();
  const liveObject = new LiveObject();
  liveObject.setUniqueId(uniqueId);
  liveObject.setEnabled(true);
  liveObject.setSoundObject(new GenericScore());
  bins.setLiveObject(0, 0, liveObject);
}

function addNamedChain(data: BlueData, name: string): void {
  applyProjectDocumentPatch(data, {
    score: { type: 'saveNamedNoteProcessorChain', name, chain: noteProcessorChain() },
  });
}

function addProjectUdos(data: BlueData, count: number): void {
  for (let i = 0; i < count; i++) {
    applyProjectDocumentPatch(data, {
      projectUdo: {
        type: 'add',
        definition: {
          name: `udo${i}`,
          style: 'CLASSIC',
          outTypes: 'a',
          inTypes: 'k',
          inputArguments: 'kin',
          code: `aout = ain * ${i + 1}`,
          comments: '',
        },
      },
    });
  }
}

const cases: RoundTripCase[] = [
  // ── Top-level scalar members ────────────────────────────────────────────
  {
    family: 'document',
    type: 'globalOrc',
    patches: () => [{ globalOrc: 'sr = 48000' }],
  },
  {
    family: 'document',
    type: 'globalSco',
    patches: () => [{ globalSco: 'f 1 0 8 2 0' }],
  },
  {
    family: 'document',
    type: 'tablesText',
    patches: () => [{ tablesText: '; roundtrip tables' }],
  },
  {
    family: 'document',
    type: 'scratchPad',
    patches: () => [{ scratchPad: { text: 'pad notes', wordWrapEnabled: true } }],
  },
  {
    family: 'document',
    type: 'projectProperties',
    patches: () => [{ projectProperties: { title: 'Roundtrip Title' } }],
  },
  {
    family: 'document',
    type: 'clojureProject',
    patches: () => [
      {
        clojureProject: {
          libraryEntries: [
            { entryId: 'clj-1', dependencyCoordinates: 'org.clojure/clojure', version: '1.11.0' },
          ],
        },
      },
    ],
  },

  // ── Transport fields ────────────────────────────────────────────────────
  {
    family: 'transport',
    type: 'renderStartTime',
    patches: () => [{ transport: { renderStartTime: 4 } }],
  },
  {
    family: 'transport',
    type: 'renderEndTime',
    patches: () => [{ transport: { renderEndTime: 32 } }],
  },
  {
    family: 'transport',
    type: 'loopRendering',
    patches: () => [{ transport: { loopRendering: true } }],
  },
  {
    family: 'transport',
    type: 'tempoMap',
    patches: () => [{ transport: { tempoMap: { enabled: true } } }],
  },
  {
    family: 'transport',
    type: 'tempoMapPatch',
    patches: () => [
      {
        transport: {
          tempoMapPatch: {
            type: 'addTempoPoint',
            point: { beat: 4, tempo: 90, curveType: 'constant' },
          },
        },
      },
    ],
  },
  {
    family: 'transport',
    type: 'meterMapPatch',
    patches: () => [
      {
        transport: {
          meterMapPatch: { type: 'meter-map-set-entry', measure: 1, numBeats: 6, beatLength: 4 },
        },
      },
    ],
  },

  // ── Mixer ───────────────────────────────────────────────────────────────
  {
    family: 'mixer',
    type: 'setMixerEnabled',
    patches: () => [{ mixer: { type: 'setMixerEnabled', value: false } }],
  },
  {
    family: 'mixer',
    type: 'setMeterEnabled',
    patches: () => [{ mixer: { type: 'setMeterEnabled', value: false } }],
    identity: (data) => ({
      channelId: mixerChannelEntryId(data),
      channels: data
        .getMixer()
        .getChannels()
        .map((c) => getMixerChannelSnapshotId(c)),
    }),
  },
  {
    family: 'mixer',
    type: 'setMeterProfile',
    patches: () => [{ mixer: { type: 'setMeterProfile', value: 'k14-rms-peak' } }],
    identity: (data) => ({
      channelId: mixerChannelEntryId(data),
      channels: data
        .getMixer()
        .getChannels()
        .map((c) => getMixerChannelSnapshotId(c)),
    }),
  },
  {
    family: 'mixer',
    type: 'updateExtraRenderTime',
    patches: () => [{ mixer: { type: 'updateExtraRenderTime', value: 500 } }],
  },
  {
    family: 'mixer',
    type: 'updateChannel',
    patches: (data) => [
      {
        mixer: {
          type: 'updateChannel',
          channelId: getMixerChannelSnapshotId(data.getMixer().getChannels()[0]!),
          patch: { level: 0.3, volume: -6, pan: 0.25, muted: true },
        },
      },
    ],
    identity: (data) => mixerChannelEntryId(data),
  },
  {
    family: 'mixer',
    type: 'updateChannel.name',
    patches: (data) => [
      {
        mixer: {
          type: 'updateChannel',
          channelId: getMixerChannelSnapshotId(data.getMixer().getChannels()[0]!),
          patch: { name: 'Renamed Channel' },
        },
      },
    ],
  },
  {
    family: 'mixer',
    type: 'renameChannelListGroup',
    patches: () => [
      { mixer: { type: 'renameChannelListGroup', association: '1', name: 'Synth Group' } },
    ],
  },
  {
    family: 'mixer',
    type: 'addSubChannel',
    patches: (data) => [
      {
        mixer: {
          type: 'addSubChannel',
          name: 'Sub One',
          channelId: getMixerChannelSnapshotId(data.getMixer().getChannels()[0]!),
        },
      },
    ],
  },
  {
    family: 'mixer',
    type: 'removeSubChannel',
    patches: (data) => {
      const channelId = getMixerChannelSnapshotId(data.getMixer().getChannels()[0]!);
      applyProjectDocumentPatch(data, {
        mixer: { type: 'addSubChannel', name: 'Sub Two', channelId },
      });
      const subChannel = data.getMixer().getSubChannels()[0]!;
      return [
        { mixer: { type: 'removeSubChannel', channelId: getMixerChannelSnapshotId(subChannel) } },
      ];
    },
  },
  {
    family: 'mixer',
    type: 'addEffectFromLibrary',
    patches: (data) => [
      {
        mixer: {
          type: 'addEffectFromLibrary',
          channelId: getMixerChannelSnapshotId(data.getMixer().getChannels()[0]!),
          chain: 'pre',
          libraryEffectId: 'library-effect-1',
          effectXml: effectXml('RoundtripEffect'),
          entryId: 'added-effect-1',
        },
      },
    ],
    identity: (data) => preChainEntryIds(data),
  },
  {
    family: 'mixer',
    type: 'addSend',
    patches: (data) => [
      {
        mixer: {
          type: 'addSend',
          channelId: getMixerChannelSnapshotId(data.getMixer().getChannels()[0]!),
          chain: 'pre',
          sendChannel: 'Master',
          level: 0.25,
          entryId: 'added-send-1',
        },
      },
    ],
    identity: (data) => preChainEntryIds(data),
  },
  {
    family: 'mixer',
    type: 'updateSend',
    patches: (data) => {
      const channelId = getMixerChannelSnapshotId(data.getMixer().getChannels()[0]!);
      applyProjectDocumentPatch(data, {
        mixer: {
          type: 'addSend',
          channelId,
          chain: 'pre',
          sendChannel: 'Master',
          level: 0.25,
          entryId: 'send-1',
        },
      });
      return [
        {
          mixer: {
            type: 'updateSend',
            channelId,
            chain: 'pre',
            entryId: 'send-1',
            patch: { level: 0.6 },
          },
        },
      ];
    },
  },
  {
    family: 'mixer',
    type: 'updateEffect',
    patches: (data) => {
      addPreChainEffect(data, 'effect-1', 'Editable');
      return [
        {
          mixer: {
            type: 'updateEffect',
            channelId: getMixerChannelSnapshotId(data.getMixer().getChannels()[0]!),
            chain: 'pre',
            entryId: 'effect-1',
            patch: { name: 'Edited Effect', enabled: false },
          },
        },
      ];
    },
  },
  {
    family: 'mixer',
    type: 'removeChainEntry',
    patches: (data) => {
      addPreChainEffect(data, 'effect-remove-1');
      return [
        {
          mixer: {
            type: 'removeChainEntry',
            channelId: getMixerChannelSnapshotId(data.getMixer().getChannels()[0]!),
            chain: 'pre',
            entryId: 'effect-remove-1',
          },
        },
      ];
    },
  },
  {
    family: 'mixer',
    type: 'reorderChainEntry',
    patches: (data) => {
      const channelId = getMixerChannelSnapshotId(data.getMixer().getChannels()[0]!);
      addPreChainEffect(data, 'effect-a', 'A');
      addPreChainEffect(data, 'effect-b', 'B');
      return [{ mixer: { type: 'reorderChainEntry', channelId, chain: 'pre', from: 0, to: 1 } }];
    },
  },
  {
    family: 'mixer',
    type: 'duplicateChainEntry',
    patches: (data) => {
      addPreChainEffect(data, 'effect-dup-src');
      return [
        {
          mixer: {
            type: 'duplicateChainEntry',
            channelId: getMixerChannelSnapshotId(data.getMixer().getChannels()[0]!),
            chain: 'pre',
            entryId: 'effect-dup-src',
            newEntryId: 'effect-dup-copy',
          },
        },
      ];
    },
    identity: (data) => preChainEntryIds(data),
  },
  {
    family: 'mixer',
    type: 'copyChainEntry',
    patches: (data) => {
      addPreChainEffect(data, 'effect-copy-src');
      return [
        {
          mixer: {
            type: 'copyChainEntry',
            channelId: getMixerChannelSnapshotId(data.getMixer().getChannels()[0]!),
            chain: 'pre',
            entryId: 'effect-copy-src',
          },
        },
      ];
    },
    // Clipboard-only intent: the canonical document never changes, so the
    // commit is history-neutral (unchanged) rather than document-invariant.
    noOp: true,
  },
  {
    family: 'mixer',
    type: 'pasteChainEntries',
    patches: (data) => [
      {
        mixer: {
          type: 'pasteChainEntries',
          channelId: getMixerChannelSnapshotId(data.getMixer().getChannels()[0]!),
          chain: 'pre',
          payload: { sourceKind: 'project', entries: [clipboardEffectEntry('Pasted')] },
          newEntryIds: ['pasted-effect-1'],
        },
      },
    ],
    identity: (data) => preChainEntryIds(data),
  },
  {
    family: 'mixer',
    type: 'moveChainEntryAcrossChains',
    patches: (data) => {
      addPreChainEffect(data, 'effect-move-1');
      return [
        {
          mixer: {
            type: 'moveChainEntryAcrossChains',
            fromChannelId: getMixerChannelSnapshotId(data.getMixer().getChannels()[0]!),
            fromChain: 'pre',
            toChannelId: getMixerChannelSnapshotId(data.getMixer().getChannels()[0]!),
            toChain: 'post',
            entryId: 'effect-move-1',
          },
        },
      ];
    },
  },

  // ── Orchestra ───────────────────────────────────────────────────────────
  {
    family: 'orchestra',
    type: 'addInstrument',
    patches: () => [{ orchestra: { type: 'addInstrument', instrumentType: 'generic' } }],
  },
  {
    family: 'orchestra',
    type: 'removeAssignment',
    patches: (data) => [
      { orchestra: { type: 'removeAssignment', assignmentId: assignmentId(data) } },
    ],
    identity: (data) =>
      createOrchestraSnapshot(data).arrangement.rows.map((row) => row.assignmentId),
  },
  {
    family: 'orchestra',
    type: 'duplicateAssignment',
    patches: (data) => [
      { orchestra: { type: 'duplicateAssignment', sourceAssignmentId: assignmentId(data) } },
    ],
  },
  {
    family: 'orchestra',
    type: 'pasteInstrument',
    patches: (data) => {
      const instrument = createOrchestraSnapshot(data).instruments[0]!;
      return [{ orchestra: { type: 'pasteInstrument', instrument } }];
    },
  },
  {
    family: 'orchestra',
    type: 'updateAssignment',
    patches: (data) => [
      { orchestra: { type: 'updateAssignment', assignmentId: assignmentId(data), enabled: false } },
    ],
  },
  {
    family: 'orchestra',
    type: 'replaceInstrument',
    patches: (data) => [
      {
        orchestra: {
          type: 'replaceInstrument',
          assignmentId: assignmentId(data),
          instrumentType: 'blueSynthBuilder',
        },
      },
    ],
  },
  {
    family: 'orchestra',
    type: 'convertGenericToBsb',
    patches: (data) => [
      { orchestra: { type: 'convertGenericToBsb', assignmentId: assignmentId(data) } },
    ],
  },
  {
    family: 'orchestra',
    type: 'updateInstrument',
    patches: (data) => [
      {
        orchestra: {
          type: 'updateInstrument',
          assignmentId: assignmentId(data),
          patch: { name: 'Renamed Instrument' },
        },
      },
    ],
  },
  {
    family: 'orchestra',
    type: 'updateInstrumentComment',
    patches: (data) => [
      {
        orchestra: {
          type: 'updateInstrumentComment',
          assignmentId: assignmentId(data),
          comment: 'updated comment',
        },
      },
    ],
  },

  // ── Score: layers, groups, markers ──────────────────────────────────────
  {
    family: 'score',
    type: 'addLayer',
    patches: (data) => [{ score: { type: 'addLayer', groupId: groupId(data), layerIndex: 2 } }],
  },
  {
    family: 'score',
    type: 'removeLayer',
    patches: (data) => [{ score: { type: 'removeLayer', groupId: groupId(data), layerIndex: 1 } }],
  },
  {
    family: 'score',
    type: 'moveLayer',
    patches: (data) => [
      { score: { type: 'moveLayer', groupId: groupId(data), layerIndex: 0, targetIndex: 1 } },
    ],
  },
  {
    family: 'score',
    type: 'moveLayerRange',
    patches: (data) => [
      {
        score: {
          type: 'moveLayerRange',
          groupId: groupId(data),
          startIndex: 0,
          endIndex: 0,
          targetIndex: 1,
        },
      },
    ],
  },
  {
    family: 'score',
    type: 'removeLayerRanges',
    patches: (data) => [
      {
        score: {
          type: 'removeLayerRanges',
          ranges: [{ groupId: groupId(data), startIndex: 0, endIndex: 0 }],
          deleteEmptyLayerGroups: false,
        },
      },
    ],
  },
  {
    family: 'score',
    type: 'updateLayerState',
    patches: (data) => [
      {
        score: {
          type: 'updateLayerState',
          groupId: groupId(data),
          layerIndex: 0,
          patch: { muted: true },
        },
      },
    ],
  },
  {
    family: 'score',
    type: 'setLayerHeights',
    patches: (data) => {
      const gId = groupId(data);
      const layer = scoreLayer(data, 0);
      const selId = assignLayerSelectionId(layer);
      return [
        {
          score: {
            type: 'setLayerHeights',
            scopeGroupId: null,
            updates: [{ groupId: gId, layerIndex: 0, layerSelectionId: selId, height: 66 }],
          },
        },
      ];
    },
  },
  {
    family: 'score',
    type: 'setLayerGroupDefaultHeight',
    patches: (data) => [
      {
        score: {
          type: 'setLayerGroupDefaultHeight',
          scopeGroupId: null,
          groupId: groupId(data),
          defaultHeightIndex: 2,
        },
      },
    ],
  },
  {
    family: 'score',
    type: 'renameLayer',
    patches: (data) => [
      { score: { type: 'renameLayer', groupId: groupId(data), layerIndex: 0, name: 'Renamed' } },
    ],
  },
  {
    family: 'score',
    type: 'addLayerGroup',
    patches: () => [{ score: { type: 'addLayerGroup', groupType: 'track' } }],
  },
  {
    family: 'score',
    type: 'removeLayerGroup',
    patches: (data) => {
      applyProjectDocumentPatch(data, { score: { type: 'addLayerGroup', groupType: 'track' } });
      const extraGroupId = (data.getScore()[1] as TrackLayerGroup).getUniqueId();
      return [{ score: { type: 'removeLayerGroup', groupId: extraGroupId } }];
    },
  },
  {
    family: 'score',
    type: 'moveLayerGroup',
    patches: (data) => {
      applyProjectDocumentPatch(data, { score: { type: 'addLayerGroup', groupType: 'track' } });
      return [{ score: { type: 'moveLayerGroup', groupId: groupId(data), targetIndex: 1 } }];
    },
  },
  {
    family: 'score',
    type: 'renameLayerGroup',
    patches: (data) => [
      { score: { type: 'renameLayerGroup', groupId: groupId(data), name: 'Renamed Group' } },
    ],
  },
  {
    family: 'score',
    type: 'addMarker',
    patches: () => [{ score: { type: 'addMarker', timeBeats: 8, name: 'M1' } }],
  },
  {
    family: 'score',
    type: 'updateMarker',
    patches: (data) => {
      addMarker(data, 'M1');
      return [{ score: { type: 'updateMarker', sourceIndex: 0, patch: { name: 'M2' } } }];
    },
  },
  {
    family: 'score',
    type: 'removeMarker',
    patches: (data) => {
      addMarker(data, 'M1');
      return [{ score: { type: 'removeMarker', sourceIndex: 0 } }];
    },
  },

  // ── Score: sound objects ────────────────────────────────────────────────
  {
    family: 'score',
    type: 'addScoreObjects',
    patches: (data) => [
      {
        score: {
          type: 'addScoreObjects',
          groupId: groupId(data),
          objects: [
            {
              selectionId: 'sobj-new',
              layerIndex: 1,
              objectType: 'GenericScore',
              name: 'Added Object',
              startBeats: 2,
              durationBeats: 4,
            },
          ],
        },
      },
    ],
    identity: (data) => {
      const layer = scoreLayer(data, 1);
      return layer.map((entry) => getScoreObjectId(entry));
    },
  },
  {
    family: 'score',
    type: 'moveScoreObjects',
    patches: (data) => [
      {
        score: {
          type: 'moveScoreObjects',
          moves: [
            {
              target: scoreObjectTarget(data),
              targetGroupId: groupId(data),
              targetLayerIndex: 1,
              targetStartBeats: 10,
            },
          ],
        },
      },
    ],
    identity: (data) => getScoreObjectId(scoreLayer(data, 0)[0] ?? scoreLayer(data, 1)[0]!),
  },
  {
    family: 'score',
    type: 'removeScoreObjects',
    patches: (data) => [
      { score: { type: 'removeScoreObjects', targets: [scoreObjectTarget(data)] } },
    ],
  },
  {
    family: 'score',
    type: 'setScoreObjectBackgroundColors',
    patches: (data) => [
      {
        score: {
          type: 'setScoreObjectBackgroundColors',
          updates: [{ target: scoreObjectTarget(data), backgroundColor: 0x334455 }],
        },
      },
    ],
  },
  {
    family: 'score',
    type: 'updateSharedProperties',
    patches: (data) => [
      {
        score: {
          type: 'updateSharedProperties',
          target: scoreObjectTarget(data),
          patch: { name: 'Renamed Obj' },
        },
      },
    ],
  },
  {
    family: 'score',
    type: 'updateSoundObjectBehavior',
    patches: (data) => [
      {
        score: {
          type: 'updateSoundObjectBehavior',
          target: scoreObjectTarget(data),
          patch: { timeBehavior: 'REPEAT' },
        },
      },
    ],
  },
  {
    family: 'score',
    type: 'setSubjectiveDurationToObjective',
    patches: (data) => [
      { score: { type: 'setSubjectiveDurationToObjective', targets: [scoreObjectTarget(data)] } },
    ],
  },
  {
    family: 'score',
    type: 'convertToPolyObject',
    patches: (data) => {
      const poly = new PolyObject();
      poly.setName('Target Poly');
      poly.newLayerAt(0);
      data.getScore().push(poly);
      return [
        {
          score: {
            type: 'convertToPolyObject',
            targets: [scoreObjectTarget(data)],
            targetGroupId: assignLayerGroupId(poly),
            targetLayerIndex: 0,
            selectionId: 'poly-1',
          },
        },
      ];
    },
    identity: (data) => {
      const polyGroup = data.getScore().find((entry) => entry instanceof PolyObject) as PolyObject;
      return polyGroup[0].map((entry) => getScoreObjectId(entry));
    },
  },
  {
    family: 'score',
    type: 'convertScoreObjectToObjectBuilder',
    patches: (data) => {
      const python = new PythonObject();
      python.setName('Py Obj');
      assignExplicitScoreObjectId(python, 'pyobj-1');
      scoreLayer(data, 1).push(python);
      const target = {
        ...scoreObjectTarget(data, 1, 0),
        selectionId: 'pyobj-1',
        selectedObjectType: 'PythonObject',
        editorObjectType: 'PythonObject',
      };
      return [{ score: { type: 'convertScoreObjectToObjectBuilder', target } }];
    },
    identity: (data) => {
      const layer = scoreLayer(data, 1);
      return layer.map((entry) => ({
        id: getScoreObjectId(entry),
        name: entry.getName(),
        isBuilder: entry instanceof ObjectBuilder,
      }));
    },
  },
  {
    family: 'score',
    type: 'updateTypeSpecificEditor',
    patches: (data) => {
      const builder = new ObjectBuilder();
      builder.setName('Builder Obj');
      assignExplicitScoreObjectId(builder, 'builder-1');
      scoreLayer(data, 1).push(builder);
      const target = {
        ...scoreObjectTarget(data, 1, 0),
        selectionId: 'builder-1',
        selectedObjectType: 'ObjectBuilder',
        editorObjectType: 'ObjectBuilder',
      };
      return [
        { score: { type: 'updateTypeSpecificEditor', target, patch: { text: 'aout = aout' } } },
      ];
    },
  },
  {
    family: 'score',
    type: 'replaceAudioFileSource',
    patches: (data) => {
      const audio = new AudioFile();
      audio.setName('Audio Obj');
      assignExplicitScoreObjectId(audio, 'audio-1');
      scoreLayer(data, 1).push(audio);
      const target = {
        ...scoreObjectTarget(data, 1, 0),
        selectionId: 'audio-1',
        selectedObjectType: 'AudioFile',
        editorObjectType: 'AudioFile',
      };
      return [
        {
          score: {
            type: 'replaceAudioFileSource',
            target,
            filePath: 'C:\\audio\\loop.wav',
            name: 'Loop',
          },
        },
      ];
    },
  },
  {
    family: 'score',
    type: 'updateAudioFilePostCode',
    patches: (data) => {
      const audio = new AudioFile();
      audio.setName('Audio Obj');
      assignExplicitScoreObjectId(audio, 'audio-1');
      scoreLayer(data, 1).push(audio);
      const target = {
        ...scoreObjectTarget(data, 1, 0),
        selectionId: 'audio-1',
        selectedObjectType: 'AudioFile',
        editorObjectType: 'AudioFile',
      };
      return [
        { score: { type: 'updateAudioFilePostCode', target, csoundPostCode: 'aout = aout * 0.5' } },
      ];
    },
  },
  {
    family: 'score',
    type: 'updateTimeState',
    patches: () => [
      { score: { type: 'updateTimeState', patch: { snapEnabled: true, snapValue: '1/4' } } },
    ],
  },
  {
    family: 'score',
    type: 'updateTrackLayerMuteSoloMode',
    patches: () => [{ score: { type: 'updateTrackLayerMuteSoloMode', mode: 'event' } }],
    identity: (data) => ({
      groupId: groupId(data),
      trackId: scoreLayer(data, 0).getUniqueId(),
      channelId: mixerChannelEntryId(data),
    }),
  },
  {
    family: 'score',
    type: 'updateScorePanning',
    patches: () => [{ score: { type: 'updateScorePanning', panningEnabled: false } }],
    identity: (data) => ({
      groupId: groupId(data),
      channelId: mixerChannelEntryId(data),
    }),
  },

  // ── Score: note processors ──────────────────────────────────────────────
  {
    family: 'score',
    type: 'replaceNoteProcessorChain',
    patches: (data) => [
      {
        score: {
          type: 'replaceNoteProcessorChain',
          target: scoreObjectTarget(data),
          chain: noteProcessorChain(),
        },
      },
    ],
  },
  {
    family: 'score',
    type: 'replaceScopedNoteProcessorChain',
    patches: (data) => {
      const poly = new PolyObject();
      poly.setName('Chain Poly');
      poly.newLayerAt(0);
      data.getScore().push(poly);
      return [
        {
          score: {
            type: 'replaceScopedNoteProcessorChain',
            scope: 'soundLayer',
            groupId: assignLayerGroupId(poly),
            layerIndex: 0,
            chain: noteProcessorChain(),
          },
        },
      ];
    },
  },
  {
    family: 'score',
    type: 'replaceScopedNoteProcessorChain.layerGroup',
    patches: (data) => {
      const poly = new PolyObject();
      poly.setName('Chain Poly Group');
      poly.newLayerAt(0);
      data.getScore().push(poly);
      return [
        {
          score: {
            type: 'replaceScopedNoteProcessorChain',
            scope: 'layerGroup',
            groupId: assignLayerGroupId(poly),
            chain: noteProcessorChain(),
          },
        },
      ];
    },
  },
  {
    family: 'score',
    type: 'replaceScopedNoteProcessorChain.rootScore',
    patches: () => [
      {
        score: {
          type: 'replaceScopedNoteProcessorChain',
          scope: 'rootScore',
          chain: noteProcessorChain(),
        },
      },
    ],
  },
  {
    family: 'score',
    type: 'saveNamedNoteProcessorChain',
    patches: () => [
      {
        score: {
          type: 'saveNamedNoteProcessorChain',
          name: 'Saved Chain',
          chain: noteProcessorChain(),
        },
      },
    ],
  },
  {
    family: 'score',
    type: 'deleteNamedNoteProcessorChain',
    patches: (data) => {
      addNamedChain(data, 'Doomed Chain');
      return [{ score: { type: 'deleteNamedNoteProcessorChain', name: 'Doomed Chain' } }];
    },
  },

  // ── Score: tracks and track items ───────────────────────────────────────
  {
    family: 'score',
    type: 'addTrackItem',
    patches: (data, session) => [
      {
        score: {
          type: 'addTrackItem',
          track: trackRef(data, session),
          item: { objectType: 'GenericScore', name: 'Track Item', durationBeats: 4 },
          startBeats: 0,
        },
      },
    ],
    identity: (data) => scoreLayer(data, 0).map((entry) => getScoreObjectId(entry)),
  },
  {
    family: 'score',
    type: 'moveTrackItems',
    patches: (data, session) => {
      placeTrackItem(data, session);
      return [
        {
          score: {
            type: 'moveTrackItems',
            moves: [
              {
                source: { track: trackRef(data, session), objectIndex: 0 },
                destination: trackRef(data, session),
                targetStartBeats: 8,
              },
            ],
          },
        },
      ];
    },
  },
  {
    family: 'score',
    type: 'resizeTrackItems',
    patches: (data, session) => {
      placeTrackItem(data, session);
      return [
        {
          score: {
            type: 'resizeTrackItems',
            resizes: [
              {
                target: { track: trackRef(data, session), objectIndex: 0 },
                targetStartBeats: 2,
                targetDurationBeats: 8,
              },
            ],
          },
        },
      ];
    },
  },
  {
    family: 'score',
    type: 'removeTrackItems',
    patches: (data, session) => {
      placeTrackItem(data, session);
      return [
        {
          score: {
            type: 'removeTrackItems',
            targets: [{ track: trackRef(data, session), objectIndex: 0 }],
          },
        },
      ];
    },
  },
  {
    family: 'score',
    type: 'createTrackInstrument',
    patches: (data, session) => [
      {
        score: {
          type: 'createTrackInstrument',
          track: trackRef(data, session),
          instrumentType: 'generic',
        },
      },
    ],
  },
  {
    family: 'score',
    type: 'replaceTrackInstrument',
    patches: (data, session) => {
      placeTrackInstrument(data, session);
      return [
        {
          score: {
            type: 'replaceTrackInstrument',
            track: trackRef(data, session),
            instrument: {
              assignmentId: 'track-instr-1',
              type: 'generic',
              name: 'Track Generic',
              enabled: true,
              comment: '',
              text: 'aout = aout',
              globalOrc: '',
              globalSco: '',
              udolist: [],
            },
          },
        },
      ];
    },
  },
  {
    family: 'score',
    type: 'clearTrackInstrument',
    patches: (data, session) => {
      placeTrackInstrument(data, session);
      return [{ score: { type: 'clearTrackInstrument', track: trackRef(data, session) } }];
    },
  },
  {
    family: 'score',
    type: 'updateTrackInstrument',
    patches: (data, session) => {
      placeTrackInstrument(data, session);
      return [
        {
          score: {
            type: 'updateTrackInstrument',
            track: trackRef(data, session),
            patch: { name: 'Track Instr Renamed' },
          },
        },
      ];
    },
  },
  {
    family: 'score',
    type: 'replaceTrackNoteProcessorChain',
    patches: (data, session) => [
      {
        score: {
          type: 'replaceTrackNoteProcessorChain',
          track: trackRef(data, session),
          chain: noteProcessorChain(),
        },
      },
    ],
  },

  // ── Score: patterns ─────────────────────────────────────────────────────
  {
    family: 'score',
    type: 'updatePatternBeatsLength',
    patches: (data) => {
      const patterns = new PatternsLayerGroup();
      patterns.newLayerAt(0);
      data.getScore().push(patterns);
      return [
        {
          score: {
            type: 'updatePatternBeatsLength',
            groupId: assignLayerGroupId(patterns),
            patternBeatsLength: 16,
          },
        },
      ];
    },
  },
  {
    family: 'score',
    type: 'updatePatternCells',
    patches: (data) => {
      const patterns = new PatternsLayerGroup();
      const patternLayer = patterns.newLayerAt(0);
      data.getScore().push(patterns);
      return [
        {
          score: {
            type: 'updatePatternCells',
            groupId: assignLayerGroupId(patterns),
            changes: [{ layerId: assignPatternLayerId(patternLayer), cellIndex: 0, active: true }],
          },
        },
      ];
    },
  },

  // ── Score: automation ───────────────────────────────────────────────────
  {
    family: 'score',
    type: 'assignAutomationToLayer',
    patches: (data) => [
      {
        score: {
          type: 'assignAutomationToLayer',
          layer: {
            rootGroupIndex: 0,
            groupId: groupId(data),
            layerId: scoreLayer(data, 0).getUniqueId(),
            layerIndex: 0,
            layerKind: 'track',
          },
          parameterId: automationParameterId(data),
          enableAutomation: true,
        },
      },
    ],
  },
  {
    family: 'score',
    type: 'removeAutomationFromLayer',
    patches: (data) => {
      const layer = {
        rootGroupIndex: 0,
        groupId: groupId(data),
        layerId: scoreLayer(data, 0).getUniqueId(),
        layerIndex: 0,
        layerKind: 'track' as const,
      };
      const parameterId = automationParameterId(data);
      applyProjectDocumentPatch(data, {
        score: { type: 'assignAutomationToLayer', layer, parameterId },
      });
      return [{ score: { type: 'removeAutomationFromLayer', layer, parameterId } }];
    },
  },
  {
    family: 'score',
    type: 'moveAutomationToLayer',
    patches: (data) => {
      const fromLayer = {
        rootGroupIndex: 0,
        groupId: groupId(data),
        layerId: scoreLayer(data, 0).getUniqueId(),
        layerIndex: 0,
        layerKind: 'track' as const,
      };
      const toLayer = {
        rootGroupIndex: 0,
        groupId: groupId(data),
        layerId: scoreLayer(data, 1).getUniqueId(),
        layerIndex: 1,
        layerKind: 'track' as const,
      };
      const parameterId = automationParameterId(data);
      applyProjectDocumentPatch(data, {
        score: { type: 'assignAutomationToLayer', layer: fromLayer, parameterId },
      });
      return [{ score: { type: 'moveAutomationToLayer', fromLayer, toLayer, parameterId } }];
    },
  },
  {
    family: 'score',
    type: 'clearLayerAutomations',
    patches: (data) => {
      const layer = {
        rootGroupIndex: 0,
        groupId: groupId(data),
        layerId: scoreLayer(data, 0).getUniqueId(),
        layerIndex: 0,
        layerKind: 'track' as const,
      };
      const parameterId = automationParameterId(data);
      applyProjectDocumentPatch(data, {
        score: { type: 'assignAutomationToLayer', layer, parameterId },
      });
      return [{ score: { type: 'clearLayerAutomations', layer } }];
    },
  },
  {
    family: 'score',
    type: 'selectLayerAutomation',
    patches: (data) => {
      const layer = {
        rootGroupIndex: 0,
        groupId: groupId(data),
        layerId: scoreLayer(data, 0).getUniqueId(),
        layerIndex: 0,
        layerKind: 'track' as const,
      };
      // Assign both parameters so either can be selected; the last
      // assignment auto-selects parameter 1, so selecting parameter 0 in the
      // committed action has a real effect to reverse.
      applyProjectDocumentPatch(data, {
        score: { type: 'assignAutomationToLayer', layer, parameterId: automationParameterId(data) },
      });
      applyProjectDocumentPatch(data, {
        score: {
          type: 'assignAutomationToLayer',
          layer,
          parameterId: automationParameterId(data, 1),
        },
      });
      return [
        {
          score: { type: 'selectLayerAutomation', layer, parameterId: automationParameterId(data) },
        },
      ];
    },
    fingerprint: (data) =>
      `${data.saveToString()}#selected:${scoreLayer(data, 0).getAutomationParameters().getSelectedIndex()}`,
  },
  {
    family: 'score',
    type: 'setAutomationLineColor',
    patches: (data) => [
      {
        score: {
          type: 'setAutomationLineColor',
          parameterId: automationParameterId(data),
          lineColor: 0x00ff00,
        },
      },
    ],
  },
  {
    family: 'score',
    type: 'setAutomationPoints',
    patches: (data) => [
      {
        score: {
          type: 'setAutomationPoints',
          parameterId: automationParameterId(data),
          points: [
            { time: 0, value: 0.1 },
            { time: 4, value: 0.9 },
          ],
        },
      },
    ],
  },
  {
    family: 'score',
    type: 'insertAutomationPoint',
    patches: (data) => {
      const parameterId = automationParameterId(data);
      applyProjectDocumentPatch(data, {
        score: { type: 'setAutomationPoints', parameterId, points: [{ time: 0, value: 0.1 }] },
      });
      return [
        { score: { type: 'insertAutomationPoint', parameterId, point: { time: 2, value: 0.5 } } },
      ];
    },
  },
  {
    family: 'score',
    type: 'deleteAutomationPoint',
    patches: (data) => {
      const parameterId = automationParameterId(data);
      applyProjectDocumentPatch(data, {
        score: {
          type: 'setAutomationPoints',
          parameterId,
          points: [
            { time: 0, value: 0.1 },
            { time: 4, value: 0.9 },
          ],
        },
      });
      // Index 0 is a guarded no-op in the applier (first point is pinned);
      // delete the second point to exercise the real path.
      return [{ score: { type: 'deleteAutomationPoint', parameterId, pointIndex: 1 } }];
    },
  },
  {
    family: 'score',
    type: 'moveAutomationPoint',
    patches: (data) => {
      const parameterId = automationParameterId(data);
      applyProjectDocumentPatch(data, {
        score: { type: 'setAutomationPoints', parameterId, points: [{ time: 0, value: 0.1 }] },
      });
      return [
        {
          score: {
            type: 'moveAutomationPoint',
            parameterId,
            pointIndex: 0,
            point: { time: 1, value: 0.2 },
          },
        },
      ];
    },
  },
  {
    // Mixer parameters are covered here; BSB widget parameters (whose
    // resolution survives parameter synchronization) are covered by the
    // dedicated T128 test below.
    family: 'score',
    type: 'setAutomationResolution',
    patches: (data) => [
      {
        score: {
          type: 'setAutomationResolution',
          parameterId: mixerParameterId(data),
          resolutionDecimal: '0.25',
        },
      },
    ],
  },
  {
    family: 'score',
    type: 'moveAutomationRange',
    patches: (data) => {
      const parameterId = automationParameterId(data);
      const layerId = scoreLayer(data, 0).getUniqueId();
      applyProjectDocumentPatch(data, {
        score: {
          type: 'assignAutomationToLayer',
          layer: {
            rootGroupIndex: 0,
            groupId: groupId(data),
            layerId,
            layerIndex: 0,
            layerKind: 'track',
          },
          parameterId,
        },
      });
      applyProjectDocumentPatch(data, {
        score: {
          type: 'setAutomationPoints',
          parameterId,
          points: [
            { time: 0, value: 0.1 },
            { time: 4, value: 0.9 },
          ],
        },
      });
      return [
        {
          score: {
            type: 'moveAutomationRange',
            range: {
              startBeat: 0,
              endBeat: 8,
              layerIds: [layerId],
              parameterIdsByLayer: { [layerId]: [parameterId] },
            },
            beatDelta: 2,
            objectIds: [],
          },
        },
      ];
    },
  },
  {
    family: 'score',
    type: 'scaleAutomationRange',
    patches: (data) => {
      const parameterId = automationParameterId(data);
      const layerId = scoreLayer(data, 0).getUniqueId();
      applyProjectDocumentPatch(data, {
        score: {
          type: 'assignAutomationToLayer',
          layer: {
            rootGroupIndex: 0,
            groupId: groupId(data),
            layerId,
            layerIndex: 0,
            layerKind: 'track',
          },
          parameterId,
        },
      });
      applyProjectDocumentPatch(data, {
        score: {
          type: 'setAutomationPoints',
          parameterId,
          points: [
            { time: 2, value: 0.1 },
            { time: 4, value: 0.9 },
          ],
        },
      });
      return [
        {
          score: {
            type: 'scaleAutomationRange',
            range: {
              startBeat: 0,
              endBeat: 8,
              layerIds: [layerId],
              parameterIdsByLayer: { [layerId]: [parameterId] },
            },
            anchorBeat: 0,
            scaleFactor: 2,
            objectIds: [],
          },
        },
      ];
    },
  },
  {
    family: 'score',
    type: 'cleanupLayerAutomation',
    patches: (data) => {
      const layer = {
        rootGroupIndex: 0,
        groupId: groupId(data),
        layerId: scoreLayer(data, 0).getUniqueId(),
        layerIndex: 0,
        layerKind: 'track' as const,
      };
      const parameterId = automationParameterId(data);
      applyProjectDocumentPatch(data, {
        score: { type: 'assignAutomationToLayer', layer, parameterId },
      });
      applyProjectDocumentPatch(data, {
        score: { type: 'setAutomationPoints', parameterId, points: [{ time: 0, value: 0.1 }] },
      });
      // Orphan the assigned parameter by removing its owning BSB instrument;
      // cleanup must then drop the stale layer assignment.
      const rows = createOrchestraSnapshot(data).arrangement.rows;
      const bsbRow = rows.find((row) => row.instrumentType === 'blueSynthBuilder');
      applyProjectDocumentPatch(data, {
        orchestra: { type: 'removeAssignment', assignmentId: bsbRow!.assignmentId },
      });
      return [{ score: { type: 'cleanupLayerAutomation', layer } }];
    },
  },

  // ── Blue Live ───────────────────────────────────────────────────────────
  {
    family: 'blueLive',
    type: 'updateOptions',
    patches: () => [{ blueLive: { type: 'updateOptions', patch: { commandLine: '-odac' } } }],
  },
  {
    family: 'blueLive',
    type: 'updateTempoRepeat',
    patches: () => [{ blueLive: { type: 'updateTempoRepeat', patch: { tempo: 120 } } }],
  },
  {
    family: 'blueLive',
    type: 'updateLiveCodeText',
    patches: () => [{ blueLive: { type: 'updateLiveCodeText', text: '; live code' } }],
  },
  {
    family: 'blueLive',
    type: 'setCellEnabled',
    patches: (data) => {
      placeLiveCell(data);
      return [{ blueLive: { type: 'setCellEnabled', column: 0, row: 0, enabled: false } }];
    },
  },
  {
    family: 'blueLive',
    type: 'insertRow',
    patches: () => [{ blueLive: { type: 'insertRow', index: 0 } }],
  },
  {
    family: 'blueLive',
    type: 'removeRow',
    patches: (data) => {
      applyProjectDocumentPatch(data, { blueLive: { type: 'insertRow', index: 0 } });
      return [{ blueLive: { type: 'removeRow', index: 0 } }];
    },
  },
  {
    family: 'blueLive',
    type: 'insertColumn',
    patches: () => [{ blueLive: { type: 'insertColumn', index: 0 } }],
  },
  {
    family: 'blueLive',
    type: 'removeColumn',
    patches: (data) => {
      applyProjectDocumentPatch(data, { blueLive: { type: 'insertColumn', index: 0 } });
      return [{ blueLive: { type: 'removeColumn', index: 0 } }];
    },
  },
  {
    family: 'blueLive',
    type: 'captureEnabledSet',
    patches: () => [{ blueLive: { type: 'captureEnabledSet' } }],
  },
  {
    family: 'blueLive',
    type: 'renameSet',
    patches: (data) => {
      captureSets(data, 1);
      return [{ blueLive: { type: 'renameSet', index: 0, name: 'Renamed Set' } }];
    },
  },
  {
    family: 'blueLive',
    type: 'removeSet',
    patches: (data) => {
      captureSets(data, 2);
      return [{ blueLive: { type: 'removeSet', index: 0 } }];
    },
  },
  {
    family: 'blueLive',
    type: 'moveSet',
    patches: (data) => {
      captureSets(data, 2);
      return [{ blueLive: { type: 'moveSet', from: 0, to: 1 } }];
    },
  },
  {
    family: 'blueLive',
    type: 'applySet',
    patches: (data) => {
      placeLiveCell(data);
      captureSets(data, 1);
      applyProjectDocumentPatch(data, {
        blueLive: { type: 'setCellEnabled', column: 0, row: 0, enabled: false },
      });
      return [{ blueLive: { type: 'applySet', index: 0 } }];
    },
  },
  {
    family: 'blueLive',
    type: 'setCell',
    patches: () => [
      {
        blueLive: {
          type: 'setCell',
          column: 0,
          row: 0,
          cell: {
            uniqueId: 'cell-set-1',
            enabled: true,
            keyTrigger: 0,
            midiTrigger: 0,
            displayName: 'Cell A',
            soundObjectType: 'GenericScore',
            hasSoundObject: true,
            serializedXml: new GenericScore().saveAsXML().toXml(),
          },
        },
      },
    ],
  },

  // ── MIDI input ──────────────────────────────────────────────────────────
  {
    family: 'midiInput',
    type: 'updateKeyMapping',
    patches: () => [{ midiInput: { type: 'updateKeyMapping', value: 'C4' } }],
  },
  {
    family: 'midiInput',
    type: 'updateVelocityMapping',
    patches: () => [{ midiInput: { type: 'updateVelocityMapping', value: '2' } }],
  },
  {
    family: 'midiInput',
    type: 'updatePitchConstant',
    patches: () => [{ midiInput: { type: 'updatePitchConstant', value: '1.5' } }],
  },
  {
    family: 'midiInput',
    type: 'updateAmpConstant',
    patches: () => [{ midiInput: { type: 'updateAmpConstant', value: '3' } }],
  },
  {
    family: 'midiInput',
    type: 'updateScale',
    patches: () => [
      {
        midiInput: {
          type: 'updateScale',
          scale: {
            scaleName: 'Just Intonation',
            baseFrequency: 261.63,
            octave: 4,
            ratios: [1, 1.125, 1.25],
          },
        },
      },
    ],
  },

  // ── Project UDO ─────────────────────────────────────────────────────────
  {
    family: 'projectUdo',
    type: 'add',
    patches: () => [
      {
        projectUdo: {
          type: 'add',
          definition: {
            name: 'roundtripUdo',
            style: 'CLASSIC',
            outTypes: 'a',
            inTypes: 'k',
            inputArguments: 'kin',
            code: 'aout = ain',
            comments: '',
          },
        },
      },
    ],
  },
  {
    family: 'projectUdo',
    type: 'remove',
    patches: (data) => {
      addProjectUdos(data, 1);
      return [{ projectUdo: { type: 'remove', index: 0 } }];
    },
  },
  {
    family: 'projectUdo',
    type: 'update',
    patches: (data) => {
      addProjectUdos(data, 1);
      return [{ projectUdo: { type: 'update', index: 0, patch: { name: 'renamedUdo' } } }];
    },
  },
  {
    family: 'projectUdo',
    type: 'reorder',
    patches: (data) => {
      addProjectUdos(data, 2);
      return [{ projectUdo: { type: 'reorder', from: 0, to: 1 } }];
    },
  },
  {
    family: 'projectUdo',
    type: 'convertStyle',
    patches: (data) => {
      addProjectUdos(data, 1);
      return [{ projectUdo: { type: 'convertStyle', index: 0, style: 'MODERN' } }];
    },
  },
];

/** Union-family classification tables mirrored by fixture families above. */
const FAMILY_CLASSIFICATION_TABLES: Record<string, Record<string, string>> = {
  mixer: MIXER_PATCH_PREPARATION_CLASS,
  orchestra: ORCHESTRA_PATCH_PREPARATION_CLASS,
  score: SCORE_PATCH_PREPARATION_CLASS,
  blueLive: BLUE_LIVE_PATCH_PREPARATION_CLASS,
  midiInput: MIDI_INPUT_PATCH_PREPARATION_CLASS,
  projectUdo: PROJECT_UDO_PATCH_PREPARATION_CLASS,
};

const TRANSPORT_FIXTURE_TYPES = Object.keys(TRANSPORT_PATCH_FIELD_PREPARATION_CLASS);
const DOCUMENT_FIXTURE_TYPES = [
  'globalOrc',
  'globalSco',
  'tablesText',
  'scratchPad',
  'projectProperties',
  'clojureProject',
];

describe('Project patch round trips through real ProjectHistory (T117)', () => {
  it('covers every classified patch variant with a round-trip fixture', () => {
    const covered = new Set(cases.map((entry) => `${entry.family}.${entry.type}`));

    for (const [family, table] of Object.entries(FAMILY_CLASSIFICATION_TABLES)) {
      for (const type of Object.keys(table)) {
        // Union variants with dedicated channel-field or scope sub-cases use
        // a "<type>.<suffix>" fixture key.
        expect(
          covered.has(`${family}.${type}`),
          `patch variant "${family}.${type}" has no round-trip fixture`,
        ).toBe(true);
      }
      for (const key of covered) {
        if (!key.startsWith(`${family}.`)) continue;
        const type = key.slice(family.length + 1);
        expect(
          Object.hasOwn(table, type.split('.')[0]!),
          `round-trip fixture "${key}" does not match any classified variant`,
        ).toBe(true);
      }
    }

    for (const type of TRANSPORT_FIXTURE_TYPES) {
      expect(covered.has(`transport.${type}`), `transport field "${type}" has no fixture`).toBe(
        true,
      );
    }
    for (const type of DOCUMENT_FIXTURE_TYPES) {
      expect(covered.has(`document.${type}`), `document member "${type}" has no fixture`).toBe(
        true,
      );
    }
  });

  for (const entry of cases) {
    it(`round-trips ${entry.family}.${entry.type}`, async () => {
      const session = new ProjectSession();
      session.replace(buildProject(), '/tmp/roundtrip.blue');
      const recorder = new FakePublicationRecorder();
      const history = new ProjectHistory({
        session,
        publishUpdated: (evt) => recorder.record(evt),
      });
      const context = new MockHistoryContext('ctx-roundtrip');
      const docId = session.read().documentId!;
      // Structural commits publish a candidate copy, so the canonical
      // document object changes: always read it through the session.
      const live = () => session.read().data!;

      // patches() may first prepare baseline state (setup) before returning
      // the committed action, so the baseline snapshot follows it.
      const patches = entry.patches(live(), session);

      const fingerprintOf = (data: BlueData): string =>
        entry.fingerprint ? entry.fingerprint(data) : data.saveToString();

      const baselineFingerprint = fingerprintOf(live());
      const baselineIdentity = entry.identity?.(live());

      const commit = await history.commit(
        context.nextCommitRequest(docId, 0, `Roundtrip ${entry.type}`, patches),
      );

      if (entry.noOp) {
        expect(commit.status).toBe('unchanged');
        expect(fingerprintOf(live())).toBe(baselineFingerprint);
        expect(session.read().revision).toBe(0);
        expect(history.read().canUndo).toBe(false);
        expect(history.read().length).toBe(0);
        const undo = await history.undo(context.nextUndoRequest(docId, session.read().revision));
        expect(undo.status).toBe('unchanged');
        return;
      }

      expect(commit.status, `commit failed: ${JSON.stringify(commit)}`).toBe('committed');
      if (commit.status !== 'committed') return;
      expect(session.read().revision).toBe(commit.revision);

      const committedFingerprint = fingerprintOf(live());
      expect(committedFingerprint).not.toBe(baselineFingerprint);

      const identityAfterCommit = entry.identity?.(live());

      const undo = await history.undo(context.nextUndoRequest(docId, commit.revision));
      expect(undo.status, `undo failed: ${JSON.stringify(undo)}`).toBe('committed');
      expect(fingerprintOf(live()), 'undo must restore the exact canonical state').toBe(
        baselineFingerprint,
      );
      expect(entry.identity?.(live())).toEqual(baselineIdentity);

      // The single action is now reversed: the undo stack is empty (the
      // entry stays retained on the redo branch) and a second undo reports
      // unchanged with the document untouched.
      expect(history.read().canUndo).toBe(false);
      expect(history.read().canRedo).toBe(true);
      const secondUndo = await history.undo(
        context.nextUndoRequest(docId, session.read().revision),
      );
      expect(secondUndo.status).toBe('unchanged');
      expect(fingerprintOf(live())).toBe(baselineFingerprint);

      const redo = await history.redo(context.nextRedoRequest(docId, session.read().revision));
      expect(redo.status, `redo failed: ${JSON.stringify(redo)}`).toBe('committed');
      expect(fingerprintOf(live()), 'redo must restore the committed canonical state').toBe(
        committedFingerprint,
      );
      expect(entry.identity?.(live())).toEqual(identityAfterCommit);
    });
  }

  it('commit→undo→redo publishes mixer snapshot with updated presentation values and unchanged channel identities (T036)', async () => {
    const session = new ProjectSession();
    session.replace(buildProject(), '/tmp/roundtrip-meter.blue');
    const recorder = new FakePublicationRecorder();
    const history = new ProjectHistory({
      session,
      captureSnapshot: () =>
        createProjectEditorSnapshot(session.read().data!, '/tmp/roundtrip-meter.blue'),
      publishUpdated: (evt) => recorder.record(evt),
    });
    const context = new MockHistoryContext('ctx-meter-roundtrip');
    const docId = session.read().documentId!;

    const baselineSnapshot = createProjectEditorSnapshot(
      session.read().data!,
      '/tmp/roundtrip-meter.blue',
    ).mixer!;
    const channelIdsBefore = baselineSnapshot.channels.map((c) => c.id);
    expect(baselineSnapshot.enableMeters).toBe(true);
    expect(baselineSnapshot.meterProfileKey).toBe('peak-rms-mixing-plus-6');

    const lastMixerSnapshot = () => (recorder.latest()?.snapshot as any)?.mixer;

    // 1. Commit setMeterEnabled (false)
    const commitEnabled = await history.commit(
      context.nextCommitRequest(docId, 0, 'Disable Meters', [
        { mixer: { type: 'setMeterEnabled', value: false } },
      ]),
    );
    expect(commitEnabled.status).toBe('committed');
    if (commitEnabled.status !== 'committed') return;
    const pubEnabled = lastMixerSnapshot();
    expect(pubEnabled?.enableMeters).toBe(false);
    expect(pubEnabled?.meterProfileKey).toBe('peak-rms-mixing-plus-6');
    expect(pubEnabled?.channels.map((c: any) => c.id)).toEqual(channelIdsBefore);

    // 2. Commit setMeterProfile ('k14-rms-peak')
    const commitProfile = await history.commit(
      context.nextCommitRequest(docId, commitEnabled.revision, 'Set Meter Profile', [
        { mixer: { type: 'setMeterProfile', value: 'k14-rms-peak' } },
      ]),
    );
    expect(commitProfile.status).toBe('committed');
    if (commitProfile.status !== 'committed') return;
    const pubProfile = lastMixerSnapshot();
    expect(pubProfile?.enableMeters).toBe(false);
    expect(pubProfile?.meterProfileKey).toBe('k14-rms-peak');
    expect(pubProfile?.channels.map((c: any) => c.id)).toEqual(channelIdsBefore);

    // 3. Undo profile
    const undoProfile = await history.undo(context.nextUndoRequest(docId, commitProfile.revision));
    expect(undoProfile.status).toBe('committed');
    if (undoProfile.status !== 'committed') return;
    const pubUndoProfile = lastMixerSnapshot();
    expect(pubUndoProfile?.enableMeters).toBe(false);
    expect(pubUndoProfile?.meterProfileKey).toBe('peak-rms-mixing-plus-6');
    expect(pubUndoProfile?.channels.map((c: any) => c.id)).toEqual(channelIdsBefore);

    // 4. Undo enabled
    const undoEnabled = await history.undo(context.nextUndoRequest(docId, undoProfile.revision));
    expect(undoEnabled.status).toBe('committed');
    if (undoEnabled.status !== 'committed') return;
    const pubUndoEnabled = lastMixerSnapshot();
    expect(pubUndoEnabled?.enableMeters).toBe(true);
    expect(pubUndoEnabled?.meterProfileKey).toBe('peak-rms-mixing-plus-6');
    expect(pubUndoEnabled?.channels.map((c: any) => c.id)).toEqual(channelIdsBefore);

    // 5. Redo enabled
    const redoEnabled = await history.redo(context.nextRedoRequest(docId, undoEnabled.revision));
    expect(redoEnabled.status).toBe('committed');
    if (redoEnabled.status !== 'committed') return;
    expect(lastMixerSnapshot()?.enableMeters).toBe(false);
    expect(lastMixerSnapshot()?.channels.map((c: any) => c.id)).toEqual(channelIdsBefore);

    // 6. Redo profile
    const redoProfile = await history.redo(context.nextRedoRequest(docId, redoEnabled.revision));
    expect(redoProfile.status).toBe('committed');
    if (redoProfile.status !== 'committed') return;
    expect(lastMixerSnapshot()?.meterProfileKey).toBe('k14-rms-peak');
    expect(lastMixerSnapshot()?.channels.map((c: any) => c.id)).toEqual(channelIdsBefore);
  });

  it('commit→undo→redo round-trips removing the final Clojure dependency (T126)', async () => {
    const session = new ProjectSession();
    session.replace(buildProject(), '/tmp/roundtrip-clojure.blue');
    const history = new ProjectHistory({
      session,
      publishUpdated: () => {},
    });
    const context = new MockHistoryContext('ctx-clojure');
    const docId = session.read().documentId!;
    const live = () => session.read().data!;
    const snapshotEntries = () =>
      createClojureProjectSnapshot(live().getClojureProjectData(), live()).libraryEntries;

    const baselineXml = live().saveToString();

    // Add the first dependency.
    const add = await history.commit(
      context.nextCommitRequest(docId, 0, 'Add Clojure Library', [
        {
          clojureProject: {
            libraryEntries: [
              {
                entryId: 'clj-a',
                dependencyCoordinates: 'org.clojure/clojure',
                version: '1.11.0',
              },
              {
                entryId: 'clj-b',
                dependencyCoordinates: 'org.clojure/data.json',
                version: '2.4.0',
              },
            ],
          },
        },
      ]),
    );
    expect(add.status).toBe('committed');
    if (add.status !== 'committed') return;
    expect(snapshotEntries()).toEqual([
      {
        entryId: 'clj-a',
        dependencyCoordinates: 'org.clojure/clojure',
        version: '1.11.0',
      },
      {
        entryId: 'clj-b',
        dependencyCoordinates: 'org.clojure/data.json',
        version: '2.4.0',
      },
    ]);
    expect(snapshotEntries()).toEqual(snapshotEntries());

    // Remove the final dependencies with an empty replacement list: this used
    // to classify as an empty patch and leave the entries canonically present.
    const remove = await history.commit(
      context.nextCommitRequest(docId, add.revision, 'Remove Clojure Library', [
        { clojureProject: { libraryEntries: [] } },
      ]),
    );
    expect(remove.status, JSON.stringify(remove)).toBe('committed');
    if (remove.status !== 'committed') return;
    expect(snapshotEntries()).toEqual([]);

    // Undo restores the original dependency identities and order.
    const undo = await history.undo(context.nextUndoRequest(docId, remove.revision));
    expect(undo.status).toBe('committed');
    if (undo.status !== 'committed') return;
    expect(snapshotEntries()).toEqual([
      {
        entryId: 'clj-a',
        dependencyCoordinates: 'org.clojure/clojure',
        version: '1.11.0',
      },
      {
        entryId: 'clj-b',
        dependencyCoordinates: 'org.clojure/data.json',
        version: '2.4.0',
      },
    ]);

    // Redo reapplies the removal.
    const redo = await history.redo(context.nextRedoRequest(docId, undo.revision));
    expect(redo.status).toBe('committed');
    if (redo.status !== 'committed') return;
    expect(snapshotEntries()).toEqual([]);
    expect(live().saveToString()).not.toBe(baselineXml);

    // Undo both actions to return to the exact baseline document.
    const undoAll = await history.undo(context.nextUndoRequest(docId, redo.revision));
    expect(undoAll.status).toBe('committed');
    if (undoAll.status !== 'committed') return;
    const undoFirst = await history.undo(context.nextUndoRequest(docId, undoAll.revision));
    expect(undoFirst.status).toBe('committed');
    expect(live().saveToString()).toBe(baselineXml);
  });

  it('keeps distinct identical Clojure rows stable through history copies and replay (T129)', async () => {
    const session = new ProjectSession();
    session.replace(buildProject(), '/tmp/roundtrip-clojure-identities.blue');
    const history = new ProjectHistory({
      session,
      publishUpdated: () => {},
    });
    const context = new MockHistoryContext('ctx-clojure-identities');
    const docId = session.read().documentId!;
    const live = () => session.read().data!;
    const identicalEntries = [
      {
        entryId: 'clj-identical-a',
        dependencyCoordinates: 'org.clojure/data.json',
        version: '2.4.0',
      },
      {
        entryId: 'clj-identical-b',
        dependencyCoordinates: 'org.clojure/data.json',
        version: '2.4.0',
      },
    ];

    const add = await history.commit(
      context.nextCommitRequest(docId, 0, 'Add Clojure Libraries', [
        { clojureProject: { libraryEntries: identicalEntries } },
      ]),
    );
    expect(add.status).toBe('committed');
    if (add.status !== 'committed') return;

    const committedSnapshot = createClojureProjectSnapshot(live().getClojureProjectData(), live());
    expect(committedSnapshot.libraryEntries.map((entry) => entry.entryId)).toEqual([
      'clj-identical-a',
      'clj-identical-b',
    ]);
    expect(
      createClojureProjectSnapshot(live().getClojureProjectData(), live()).libraryEntries,
    ).toEqual(committedSnapshot.libraryEntries);

    const undo = await history.undo(context.nextUndoRequest(docId, add.revision));
    expect(undo.status).toBe('committed');
    if (undo.status !== 'committed') return;
    expect(
      createClojureProjectSnapshot(live().getClojureProjectData(), live()).libraryEntries,
    ).toEqual([]);

    const redo = await history.redo(context.nextRedoRequest(docId, undo.revision));
    expect(redo.status).toBe('committed');
    expect(
      createClojureProjectSnapshot(live().getClojureProjectData(), live()).libraryEntries,
    ).toEqual(committedSnapshot.libraryEntries);
  });

  it('rejects duplicate Clojure row identities without mutation and round-trips a unique insertion (T132)', async () => {
    const session = new ProjectSession();
    session.replace(buildProject(), '/tmp/roundtrip-clojure-duplicate.blue');
    const history = new ProjectHistory({
      session,
      publishUpdated: () => {},
    });
    const context = new MockHistoryContext('ctx-clojure-duplicate');
    const docId = session.read().documentId!;
    const live = () => session.read().data!;
    const snapshotEntries = () =>
      createClojureProjectSnapshot(live().getClojureProjectData(), live()).libraryEntries;

    const add = await history.commit(
      context.nextCommitRequest(docId, 0, 'Add Draft Clojure Library', [
        {
          clojureProject: {
            libraryEntries: [
              {
                entryId: 'draft-clj-lib-1',
                dependencyCoordinates: 'org/library-name',
                version: '1.0.0',
              },
            ],
          },
        },
      ]),
    );
    expect(add.status).toBe('committed');
    if (add.status !== 'committed') return;

    const undoAdd = await history.undo(context.nextUndoRequest(docId, add.revision));
    expect(undoAdd.status).toBe('committed');
    if (undoAdd.status !== 'committed') return;
    expect(history.read().canRedo).toBe(true);

    const baselineXml = live().saveToString();
    const baselineRevision = session.read().revision;
    const baselineHistory = history.read();
    const rejected = await history.commit(
      context.nextCommitRequest(docId, baselineRevision, 'Duplicate Clojure Libraries', [
        {
          clojureProject: {
            libraryEntries: [
              {
                entryId: 'duplicate',
                dependencyCoordinates: 'org/a',
                version: '1.0.0',
              },
              {
                entryId: 'duplicate',
                dependencyCoordinates: 'org/b',
                version: '2.0.0',
              },
            ],
          },
        },
      ]),
    );
    expect(rejected.status).toBe('invalid');
    expect(live().saveToString()).toBe(baselineXml);
    expect(session.read().revision).toBe(baselineRevision);
    expect(history.read()).toMatchObject({
      cursor: baselineHistory.cursor,
      length: baselineHistory.length,
      canRedo: true,
    });
    expect(snapshotEntries()).toEqual([]);

    const insert = await history.commit(
      context.nextCommitRequest(docId, baselineRevision, 'Insert Unique Clojure Library', [
        {
          clojureProject: {
            libraryEntries: [
              {
                entryId: 'draft-clj-lib-2',
                dependencyCoordinates: 'org/library-name',
                version: '1.0.0',
              },
            ],
          },
        },
      ]),
    );
    expect(insert.status).toBe('committed');
    if (insert.status !== 'committed') return;
    expect(snapshotEntries().map((entry) => entry.entryId)).toEqual(['draft-clj-lib-2']);
    expect(live().saveToString()).not.toContain('draft-clj-lib-2');

    const undoInsert = await history.undo(context.nextUndoRequest(docId, insert.revision));
    expect(undoInsert.status).toBe('committed');
    if (undoInsert.status !== 'committed') return;
    expect(snapshotEntries()).toEqual([]);

    const redoInsert = await history.redo(context.nextRedoRequest(docId, undoInsert.revision));
    expect(redoInsert.status).toBe('committed');
    expect(snapshotEntries().map((entry) => entry.entryId)).toEqual(['draft-clj-lib-2']);
  });

  it('treats an identical-row reorder as a structural identity transition (T133)', async () => {
    const session = new ProjectSession();
    session.replace(buildProject(), '/tmp/roundtrip-clojure-reorder.blue');
    const history = new ProjectHistory({
      session,
      publishUpdated: () => {},
    });
    const context = new MockHistoryContext('ctx-clojure-reorder');
    const docId = session.read().documentId!;
    const live = () => session.read().data!;
    const snapshotEntries = () =>
      createClojureProjectSnapshot(live().getClojureProjectData(), live()).libraryEntries;
    const rows = [
      {
        entryId: 'clj-reorder-a',
        dependencyCoordinates: 'org.clojure/data.json',
        version: '2.4.0',
      },
      {
        entryId: 'clj-reorder-b',
        dependencyCoordinates: 'org.clojure/data.json',
        version: '2.4.0',
      },
    ];

    const add = await history.commit(
      context.nextCommitRequest(docId, 0, 'Add Reorder Fixtures', [
        { clojureProject: { libraryEntries: rows } },
      ]),
    );
    expect(add.status).toBe('committed');
    if (add.status !== 'committed') return;

    const reorder = await history.commit(
      context.nextCommitRequest(docId, add.revision, 'Reorder Clojure Libraries', [
        { clojureProject: { libraryEntries: [rows[1]!, rows[0]!] } },
      ]),
    );
    expect(reorder.status, JSON.stringify(reorder)).toBe('committed');
    if (reorder.status !== 'committed') return;
    expect(snapshotEntries().map((entry) => entry.entryId)).toEqual([
      'clj-reorder-b',
      'clj-reorder-a',
    ]);
    expect(live().saveToString()).not.toContain('clj-reorder-a');

    const undo = await history.undo(context.nextUndoRequest(docId, reorder.revision));
    expect(undo.status).toBe('committed');
    if (undo.status !== 'committed') return;
    expect(snapshotEntries().map((entry) => entry.entryId)).toEqual([
      'clj-reorder-a',
      'clj-reorder-b',
    ]);

    const redo = await history.redo(context.nextRedoRequest(docId, undo.revision));
    expect(redo.status).toBe('committed');
    if (redo.status !== 'committed') return;
    expect(snapshotEntries().map((entry) => entry.entryId)).toEqual([
      'clj-reorder-b',
      'clj-reorder-a',
    ]);

    const edit = await history.commit(
      context.nextCommitRequest(docId, redo.revision, 'Edit Reordered Library', [
        {
          clojureProject: {
            libraryEntries: [
              {
                ...rows[1]!,
                dependencyCoordinates: 'org.clojure/data.json-edited',
              },
              rows[0]!,
            ],
          },
        },
      ]),
    );
    expect(edit.status).toBe('committed');
    expect(snapshotEntries()).toEqual([
      {
        entryId: 'clj-reorder-b',
        dependencyCoordinates: 'org.clojure/data.json-edited',
        version: '2.4.0',
      },
      rows[0]!,
    ]);
  });

  it('an already-empty Clojure replacement is unchanged and preserves the redo branch (T126)', async () => {
    const session = new ProjectSession();
    session.replace(buildProject(), '/tmp/roundtrip-clojure-noop.blue');
    const history = new ProjectHistory({
      session,
      publishUpdated: () => {},
    });
    const context = new MockHistoryContext('ctx-clojure-noop');
    const docId = session.read().documentId!;
    const live = () => session.read().data!;

    // Create a redo branch with an unrelated reversible edit.
    const edit = await history.commit(
      context.nextCommitRequest(docId, 0, 'Edit Tables', [{ tablesText: '; pending' }]),
    );
    expect(edit.status).toBe('committed');
    if (edit.status !== 'committed') return;
    const undo = await history.undo(context.nextUndoRequest(docId, edit.revision));
    expect(undo.status).toBe('committed');
    expect(history.read().canRedo).toBe(true);

    const baselineXml = live().saveToString();
    const baselineRevision = session.read().revision;

    const unchanged = await history.commit(
      context.nextCommitRequest(docId, baselineRevision, 'Remove Clojure Library', [
        { clojureProject: { libraryEntries: [] } },
      ]),
    );
    expect(unchanged.status).toBe('unchanged');
    expect(live().saveToString()).toBe(baselineXml);
    expect(session.read().revision).toBe(baselineRevision);
    expect(history.read().length).toBe(1);

    // The pre-existing redo branch survives the history-neutral commit.
    expect(history.read().canRedo).toBe(true);
    const redo = await history.redo(context.nextRedoRequest(docId, session.read().revision));
    expect(redo.status).toBe('committed');
    expect(live().getTableSet().getTables()).toBe('; pending');
  });

  it('copyChainEntry is history-neutral: clean stays clean and redo branches survive (T127)', async () => {
    const session = new ProjectSession();
    session.replace(buildProject(), '/tmp/roundtrip-copy-neutral.blue');
    const history = new ProjectHistory({
      session,
      publishUpdated: () => {},
    });
    const context = new MockHistoryContext('ctx-copy-neutral');
    const docId = session.read().documentId!;
    const live = () => session.read().data!;

    addPreChainEffect(live(), 'effect-copy-src');
    const channelId = getMixerChannelSnapshotId(live().getMixer().getChannels()[0]!);
    history.checkpointSave();
    expect(history.isDirty()).toBe(false);

    // A clean project stays clean: no empty undo entry, no revision bump, and
    // the canonical content is untouched by the clipboard-only intent.
    const baselineXml = live().saveToString();
    const cleanCopy = await history.commit(
      context.nextCommitRequest(docId, 0, 'Copy Mixer Chain Entry', [
        {
          mixer: { type: 'copyChainEntry', channelId, chain: 'pre', entryId: 'effect-copy-src' },
        },
      ]),
    );
    expect(cleanCopy.status).toBe('unchanged');
    expect(live().saveToString()).toBe(baselineXml);
    expect(session.read().revision).toBe(0);
    expect(history.isDirty()).toBe(false);
    expect(history.read().canUndo).toBe(false);
    expect(history.read().length).toBe(0);

    // With an existing redo branch, the copy must not dirty the document,
    // add an empty undo entry, or discard the retained redo entry.
    const edit = await history.commit(
      context.nextCommitRequest(docId, 0, 'Set Channel Level', [
        {
          mixer: {
            type: 'updateChannel',
            channelId,
            patch: { level: 0.4 },
          },
        },
      ]),
    );
    expect(edit.status, JSON.stringify(edit)).toBe('committed');
    if (edit.status !== 'committed') return;
    const undo = await history.undo(context.nextUndoRequest(docId, edit.revision));
    expect(undo.status).toBe('committed');
    expect(history.read().canRedo).toBe(true);

    const beforeCopyXml = live().saveToString();
    const beforeCopyRevision = session.read().revision;
    const beforeCopyDirty = history.isDirty();

    const copy = await history.commit(
      context.nextCommitRequest(docId, beforeCopyRevision, 'Copy Mixer Chain Entry', [
        {
          mixer: { type: 'copyChainEntry', channelId, chain: 'pre', entryId: 'effect-copy-src' },
        },
      ]),
    );
    expect(copy.status).toBe('unchanged');
    expect(live().saveToString()).toBe(beforeCopyXml);
    expect(session.read().revision).toBe(beforeCopyRevision);
    expect(history.isDirty()).toBe(beforeCopyDirty);
    expect(history.read().canUndo).toBe(false);
    expect(history.read().canRedo).toBe(true);
    expect(history.read().length).toBe(1);

    // The retained redo entry is still replayable after the copy.
    const redo = await history.redo(context.nextRedoRequest(docId, session.read().revision));
    expect(redo.status).toBe('committed');
    expect(live().saveToString()).not.toBe(beforeCopyXml);
  });

  it('setAutomationResolution on a BSB parameter survives parameter sync, serialization, and replay (T128)', async () => {
    const session = new ProjectSession();
    session.replace(buildProject(), '/tmp/roundtrip-bsb-resolution.blue');
    const history = new ProjectHistory({
      session,
      publishUpdated: () => {},
    });
    const context = new MockHistoryContext('ctx-bsb-resolution');
    const docId = session.read().documentId!;
    const live = () => session.read().data!;

    const parameterId = automationParameterId(live());
    const knobResolution = (): string => {
      // Re-catalog (which re-syncs parameters from widgets) before reading:
      // the committed resolution must survive that synchronization.
      const entry = getProjectParameterCatalog(live()).find(
        (candidate) => candidate.parameter.getUniqueId() === parameterId,
      );
      if (!entry) throw new Error('BSB knob parameter missing after sync');
      return entry.parameter.getResolutionText();
    };

    expect(knobResolution()).toBe('-1');

    const commit = await history.commit(
      context.nextCommitRequest(docId, 0, 'Set Automation Resolution', [
        { score: { type: 'setAutomationResolution', parameterId, resolutionDecimal: '0.25' } },
      ]),
    );
    expect(commit.status, JSON.stringify(commit)).toBe('committed');
    if (commit.status !== 'committed') return;

    // The requested value is durable through widget synchronization and is
    // serialized canonically (parameter bdresolution), not silently lost to
    // the widget-derived default.
    expect(knobResolution()).toBe('0.25');
    const committedXml = live().saveToString();
    expect(committedXml).toContain('bdresolution="0.25"');

    const undo = await history.undo(context.nextUndoRequest(docId, commit.revision));
    expect(undo.status).toBe('committed');
    if (undo.status !== 'committed') return;
    expect(knobResolution()).toBe('-1');
    expect(live().saveToString()).not.toContain('bdresolution="0.25"');

    const redo = await history.redo(context.nextRedoRequest(docId, undo.revision));
    expect(redo.status).toBe('committed');
    expect(knobResolution()).toBe('0.25');
    expect(live().saveToString()).toBe(committedXml);
  });

  it('a malformed setAutomationResolution edit is unchanged and preserves points, history, and redo (T128)', async () => {
    const session = new ProjectSession();
    session.replace(buildProject(), '/tmp/roundtrip-bsb-resolution-bad.blue');
    const history = new ProjectHistory({
      session,
      publishUpdated: () => {},
    });
    const context = new MockHistoryContext('ctx-bsb-resolution-bad');
    const docId = session.read().documentId!;
    const live = () => session.read().data!;

    const parameterId = automationParameterId(live());
    applyProjectDocumentPatch(live(), {
      score: {
        type: 'setAutomationPoints',
        parameterId,
        points: [
          { time: 0, value: 0.1 },
          { time: 4, value: 0.9 },
        ],
      },
    });

    // A reversible edit creates the redo branch the rejection must preserve.
    const edit = await history.commit(
      context.nextCommitRequest(docId, 0, 'Set Channel Level', [
        {
          mixer: {
            type: 'updateChannel',
            channelId: getMixerChannelSnapshotId(live().getMixer().getChannels()[0]!),
            patch: { level: 0.7 },
          },
        },
      ]),
    );
    expect(edit.status).toBe('committed');
    if (edit.status !== 'committed') return;
    const undo = await history.undo(context.nextUndoRequest(docId, edit.revision));
    expect(undo.status).toBe('committed');

    const entry = getProjectParameterCatalog(live()).find(
      (candidate) => candidate.parameter.getUniqueId() === parameterId,
    );
    const pointsBefore = entry?.parameter.getPoints();
    const baselineXml = live().saveToString();
    const baselineRevision = session.read().revision;

    const rejected = await history.commit(
      context.nextCommitRequest(docId, baselineRevision, 'Set Automation Resolution', [
        {
          score: {
            type: 'setAutomationResolution',
            parameterId,
            resolutionDecimal: 'not-a-number',
          },
        },
      ]),
    );
    expect(rejected.status).toBe('unchanged');
    expect(live().saveToString()).toBe(baselineXml);
    expect(session.read().revision).toBe(baselineRevision);
    expect(history.read().canRedo).toBe(true);
    expect(history.read().length).toBe(1);

    const after = getProjectParameterCatalog(live()).find(
      (candidate) => candidate.parameter.getUniqueId() === parameterId,
    );
    expect(after?.parameter.getPoints()).toEqual(pointsBefore);
  });

  it('preserves BSB slider identities and values through dropdown history copies (T135)', async () => {
    const data = new BlueData();
    const bsb = new BlueSynthBuilder();
    bsb.setName('BSB Slider History');

    const slider = new BSBHSlider();
    slider.id = 'history-slider';
    slider.objectName = 'cutoff';
    slider.minimum = 0;
    slider.maximum = 1;
    slider.setResolutionText('0.01');
    slider.value = 0.37;

    const dropdown = new BSBDropdown();
    dropdown.id = 'history-dropdown';
    dropdown.objectName = 'mode';
    dropdown.dropdownItems = [
      { name: 'Gate', value: 'gate', uniqueId: 'mode-gate' },
      { name: 'Envelope', value: 'envelope', uniqueId: 'mode-envelope' },
    ];
    dropdown.setValue(0);

    const bank = new BSBHSliderBank();
    bank.id = 'history-bank';
    bank.objectName = 'harmonics';
    bank.minimum = 0;
    bank.maximum = 1;
    bank.numberOfSliders = 2;
    bank.setResolutionText('0.001');
    bank.sliders[0]!.id = 'history-bank-0';
    bank.sliders[1]!.id = 'history-bank-1';
    bank.sliders[0]!.value = 0.123;
    bank.sliders[1]!.value = 0.456;

    const root = bsb.getGraphicInterface().getRootGroup();
    root.addChild(slider);
    root.addChild(dropdown);
    root.addChild(bank);
    bsb.getParameters();
    data.getArrangement().addInstrument(bsb, 'bsb-history-assignment');

    const session = new ProjectSession();
    session.replace(data, '/tmp/roundtrip-bsb-slider-history.blue');
    const history = new ProjectHistory({ session, publishUpdated: () => {} });
    const context = new MockHistoryContext('ctx-bsb-slider-history');
    const docId = session.read().documentId!;
    const assignmentId = 'bsb-history-assignment';
    const liveBsb = (): BlueSynthBuilder => {
      const instrument = session.read().data?.getArrangement().getInstrumentById(assignmentId);
      if (!(instrument instanceof BlueSynthBuilder)) throw new Error('BSB fixture missing');
      return instrument;
    };

    const state = () => {
      const current = liveBsb();
      const children = current.getGraphicInterface().getRootGroup().getChildren();
      const currentSlider = children.find((child) => child.id === 'history-slider') as BSBHSlider;
      const currentDropdown = children.find(
        (child) => child.id === 'history-dropdown',
      ) as BSBDropdown;
      const currentBank = children.find((child) => child.id === 'history-bank') as BSBHSliderBank;
      return {
        sliderId: currentSlider?.id,
        sliderValue: currentSlider?.value,
        sliderResolution: currentSlider?.getResolutionText(),
        dropdownId: currentDropdown?.id,
        dropdownIndex: currentDropdown?.selectedIndex,
        bankId: currentBank?.id,
        bankChildIds: currentBank?.sliders.map((child) => child.id),
        bankValues: currentBank?.sliders.map((child) => child.value),
        bankResolution: currentBank?.getResolutionText(),
        parameters: current.getParameters().map((parameter) => ({
          name: parameter.getName(),
          id: parameter.getUniqueId(),
          value: parameter.getFixedValue(),
        })),
      };
    };

    const baseline = state();
    const commitBsbPatch = (patch: BsbInterfacePatch) =>
      history.commit(
        context.nextCommitRequest(session.read().documentId!, session.read().revision, patch.type, [
          {
            orchestra: {
              type: 'updateInstrument',
              assignmentId,
              patch: { bsbInterface: patch },
            },
          },
        ]),
      );

    const sliderEdit = await commitBsbPatch({
      type: 'updateWidgetProperties',
      widgetId: 'history-slider',
      properties: { value: 0.73 },
    });
    expect(sliderEdit.status).toBe('committed');
    if (sliderEdit.status !== 'committed') return;
    expect(state()).toMatchObject({
      sliderId: 'history-slider',
      sliderValue: 0.73,
      bankChildIds: baseline.bankChildIds,
    });

    const bankEdit = await commitBsbPatch({
      type: 'updateSliderBankValue',
      widgetId: 'history-bank',
      sliderIndex: 1,
      value: 0.789,
    });
    expect(bankEdit.status).toBe('committed');
    if (bankEdit.status !== 'committed') return;
    expect(state()).toMatchObject({
      sliderValue: 0.73,
      bankChildIds: baseline.bankChildIds,
      bankValues: [0.123, 0.789],
    });

    const dropdownEdit = await commitBsbPatch({
      type: 'updateWidgetProperties',
      widgetId: 'history-dropdown',
      properties: { selectedIndex: 1 },
    });
    expect(dropdownEdit.status).toBe('committed');
    if (dropdownEdit.status !== 'committed') return;
    expect(state()).toMatchObject({
      sliderId: 'history-slider',
      sliderValue: 0.73,
      dropdownId: 'history-dropdown',
      dropdownIndex: 1,
      bankId: 'history-bank',
      bankChildIds: baseline.bankChildIds,
      bankValues: [0.123, 0.789],
    });

    const sliderAfterDropdown = await commitBsbPatch({
      type: 'updateWidgetProperties',
      widgetId: 'history-slider',
      properties: { value: 0.41 },
    });
    expect(sliderAfterDropdown.status).toBe('committed');
    if (sliderAfterDropdown.status !== 'committed') return;
    const committed = state();
    expect(committed).toMatchObject({
      sliderValue: 0.41,
      dropdownIndex: 1,
      bankValues: [0.123, 0.789],
      sliderResolution: '0.01',
      bankResolution: '0.001',
    });
    expect(committed.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'cutoff', value: 0.41 }),
        expect.objectContaining({ name: 'mode', value: 1 }),
        expect.objectContaining({ name: 'harmonics_1', value: 0.789 }),
      ]),
    );

    const committedXml = session.read().data!.saveToString();
    const reloaded = BlueData.loadFromString(committedXml);
    const reloadedBsb = reloaded
      .getArrangement()
      .getInstrumentById(assignmentId) as BlueSynthBuilder;
    const reloadedState = (() => {
      const children = reloadedBsb.getGraphicInterface().getRootGroup().getChildren();
      const reloadedSlider = children.find((child) => child.id === 'history-slider') as BSBHSlider;
      const reloadedDropdown = children.find(
        (child) => child.id === 'history-dropdown',
      ) as BSBDropdown;
      const reloadedBank = children.find((child) => child.id === 'history-bank') as BSBHSliderBank;
      return {
        sliderValue: reloadedSlider?.value,
        dropdownIndex: reloadedDropdown?.selectedIndex,
        bankValues: reloadedBank?.sliders.map((child) => child.value),
        ids: [
          reloadedSlider?.id,
          reloadedDropdown?.id,
          reloadedBank?.id,
          ...(reloadedBank?.sliders.map((child) => child.id) ?? []),
        ],
      };
    })();
    expect(reloadedState).toEqual({
      sliderValue: 0.41,
      dropdownIndex: 1,
      bankValues: [0.123, 0.789],
      ids: [
        'history-slider',
        'history-dropdown',
        'history-bank',
        'history-bank-0',
        'history-bank-1',
      ],
    });

    const undoSlider = await history.undo(
      context.nextUndoRequest(docId, sliderAfterDropdown.revision),
    );
    expect(undoSlider.status).toBe('committed');
    expect(state()).toMatchObject({
      sliderValue: 0.73,
      dropdownIndex: 1,
      bankValues: [0.123, 0.789],
    });

    const undoDropdown = await history.undo(
      context.nextUndoRequest(docId, session.read().revision),
    );
    expect(undoDropdown.status).toBe('committed');
    expect(state()).toMatchObject({
      sliderValue: 0.73,
      dropdownIndex: 0,
      bankValues: [0.123, 0.789],
    });

    const undoBank = await history.undo(context.nextUndoRequest(docId, session.read().revision));
    expect(undoBank.status).toBe('committed');
    expect(state()).toMatchObject({
      sliderValue: 0.73,
      dropdownIndex: 0,
      bankValues: [0.123, 0.456],
    });

    const undoSliderInitial = await history.undo(
      context.nextUndoRequest(docId, session.read().revision),
    );
    expect(undoSliderInitial.status).toBe('committed');
    expect(state()).toMatchObject({
      sliderValue: 0.37,
      dropdownIndex: 0,
      bankValues: [0.123, 0.456],
    });

    const redoSlider = await history.redo(context.nextRedoRequest(docId, session.read().revision));
    expect(redoSlider.status).toBe('committed');
    const redoBank = await history.redo(context.nextRedoRequest(docId, session.read().revision));
    expect(redoBank.status).toBe('committed');
    const redoDropdown = await history.redo(
      context.nextRedoRequest(docId, session.read().revision),
    );
    expect(redoDropdown.status).toBe('committed');
    const redoSliderAfter = await history.redo(
      context.nextRedoRequest(docId, session.read().revision),
    );
    expect(redoSliderAfter.status).toBe('committed');
    expect(state()).toMatchObject({
      sliderValue: 0.41,
      dropdownIndex: 1,
      bankValues: [0.123, 0.789],
    });
  });
});

describe('save-state-aware serialization compatibility (spec 109)', () => {
  it('keeps XML round-trip and identity stable while save state is queried and checkpointed', async () => {
    const session = new ProjectSession();
    session.replace(new BlueData(), '/tmp/save-state.blue');
    const recorder = new FakePublicationRecorder();
    const history = new ProjectHistory({
      session,
      publishUpdated: (evt) => recorder.record(evt),
    });
    const context = new MockHistoryContext('ctx-save-state');
    const docId = session.read().documentId!;
    const live = () => session.read().data!;

    history.checkpointSave();
    expect(history.getSaveState()).toBe('saved');
    const baselineXml = live().saveToString();

    const commit = await history.commit(
      context.nextCommitRequest(docId, 0, 'Retitle', [
        { projectProperties: { title: 'Retitled' } },
      ]),
    );
    expect(commit.status).toBe('committed');
    expect(history.getSaveState()).toBe('modified');
    const modifiedXml = live().saveToString();
    expect(modifiedXml).not.toBe(baselineXml);

    // Undo restores both the baseline content and the saved state.
    const undo = await history.undo(context.nextUndoRequest(docId, session.read().revision));
    expect(undo.status).toBe('committed');
    expect(history.getSaveState()).toBe('saved');
    expect(live().saveToString()).toBe(baselineXml);

    // Save-state queries and checkpoints never perturb the serialized form.
    expect(history.getSaveState()).toBe('saved');
    history.checkpointSave();
    expect(live().saveToString()).toBe(baselineXml);

    const redo = await history.redo(context.nextRedoRequest(docId, session.read().revision));
    expect(redo.status).toBe('committed');
    expect(history.getSaveState()).toBe('modified');
    expect(live().saveToString()).toBe(modifiedXml);

    for (const xml of [baselineXml, modifiedXml]) {
      expect(xml).not.toContain('saveState');
      expect(xml).not.toContain('savedStateId');
      expect(BlueData.loadFromString(xml).saveToString()).toBe(xml);
    }
  });
});
