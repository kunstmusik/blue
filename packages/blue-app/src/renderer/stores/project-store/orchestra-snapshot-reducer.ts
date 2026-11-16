import {
  BlueSynthBuilder,
  BlueX7,
  cloneBlueX7Voice,
  GenericInstrument,
  JavaScriptInstrument,
  PythonInstrument,
} from '@blue/data';
import {
  createInstrumentSnapshot,
  isValidBlueX7Patch,
  type ArrangementRowSnapshot,
  type BsbActionLabelContext,
  type BsbWidgetNodeSnapshot,
  type BlueLivePatch,
  type BlueLiveProjectSnapshot,
  type BlueX7InstrumentSnapshot,
  type EmbeddedOpcodeListPatch,
  type GenericInstrumentSnapshot,
  type InstrumentPatch,
  type InstrumentSnapshot,
  type JavaScriptInstrumentSnapshot,
  type MidiInputPatch,
  type MidiInputProcessorSnapshot,
  type OrchestraPatch,
  type OrchestraSnapshot,
  type PresetGroupSnapshot,
  type ProjectUdoPatch,
  type PythonInstrumentSnapshot,
  type SupportedNewInstrumentType,
  type UdoDefinitionSnapshot,
} from '../../../shared/project-editor';
import {
  EMPTY_UDO_SNAPSHOT,
  cloneUdoSnapshot,
  convertUdoSnapshotStyle,
} from '../../components/workbench/panels/udo/udo-snapshot-utils';
import { applyBsbInstrumentPatchToSnapshot } from './bsb-interface-snapshot';

function cloneInstrumentSnapshot(instrument: InstrumentSnapshot): InstrumentSnapshot {
  return structuredClone(instrument);
}

export function applyProjectUdoPatchToSnapshot(
  udos: UdoDefinitionSnapshot[],
  patch: ProjectUdoPatch,
): UdoDefinitionSnapshot[] {
  const list = udos.map((udo) => cloneUdoSnapshot(udo));

  switch (patch.type) {
    case 'add': {
      const def = patch.definition ?? EMPTY_UDO_SNAPSHOT;
      const index = patch.index ?? list.length;
      list.splice(index, 0, cloneUdoSnapshot(def));
      break;
    }
    case 'remove': {
      if (patch.index >= 0 && patch.index < list.length) {
        list.splice(patch.index, 1);
      }
      break;
    }
    case 'update': {
      if (patch.index >= 0 && patch.index < list.length) {
        list[patch.index] = { ...list[patch.index], ...patch.patch };
      }
      break;
    }
    case 'reorder': {
      if (
        patch.from >= 0 &&
        patch.from < list.length &&
        patch.to >= 0 &&
        patch.to < list.length &&
        patch.from !== patch.to
      ) {
        const [moved] = list.splice(patch.from, 1);
        list.splice(patch.to, 0, moved);
      }
      break;
    }
    case 'convertStyle': {
      if (patch.index >= 0 && patch.index < list.length) {
        list[patch.index] = convertUdoSnapshotStyle(list[patch.index]!, patch.style);
      }
      break;
    }
  }

  return list;
}

export function applyBlueLivePatchToSnapshot(
  snap: BlueLiveProjectSnapshot,
  patch: BlueLivePatch,
  onGridStructureChanged?: () => void,
): BlueLiveProjectSnapshot {
  const next = {
    ...snap,
    bins: {
      ...snap.bins,
      cells: snap.bins.cells.map((col) => [...col]),
    },
    sets: snap.sets.map((set) => ({
      ...set,
      liveObjectIds: [...set.liveObjectIds],
    })),
  };

  switch (patch.type) {
    case 'updateOptions':
      if (patch.patch.commandLine !== undefined) next.commandLine = patch.patch.commandLine;
      if (patch.patch.commandLineEnabled !== undefined)
        next.commandLineEnabled = patch.patch.commandLineEnabled;
      if (patch.patch.commandLineOverride !== undefined)
        next.commandLineOverride = patch.patch.commandLineOverride;
      break;
    case 'updateTempoRepeat':
      if (patch.patch.tempo !== undefined) next.tempo = patch.patch.tempo;
      if (patch.patch.repeat !== undefined) next.repeat = patch.patch.repeat;
      if (patch.patch.repeatEnabled !== undefined) next.repeatEnabled = patch.patch.repeatEnabled;
      break;
    case 'updateLiveCodeText':
      next.liveCodeText = patch.text;
      break;
    case 'setCellEnabled':
      if (
        patch.column >= 0 &&
        patch.column < next.bins.cells.length &&
        patch.row >= 0 &&
        patch.row < next.bins.cells[patch.column]!.length
      ) {
        const cell = next.bins.cells[patch.column]![patch.row];
        if (cell) {
          next.bins.cells[patch.column]![patch.row] = { ...cell, enabled: patch.enabled };
        }
      }
      break;
    case 'setCell':
      if (
        (patch.expectedColumns !== undefined && next.bins.columns !== patch.expectedColumns) ||
        (patch.expectedRows !== undefined && next.bins.rows !== patch.expectedRows)
      ) {
        break;
      }
      if (
        patch.column >= 0 &&
        patch.column < next.bins.cells.length &&
        patch.row >= 0 &&
        patch.row < next.bins.cells[patch.column]!.length
      ) {
        const currentCell = next.bins.cells[patch.column]![patch.row] ?? null;
        if (
          patch.expectedLiveObjectId !== undefined &&
          (currentCell?.uniqueId ?? null) !== patch.expectedLiveObjectId
        ) {
          break;
        }
        next.bins.cells[patch.column]![patch.row] = patch.cell ? { ...patch.cell } : null;
      }
      break;
    case 'insertRow':
      {
        const insertIndex = Math.min(Math.max(patch.index, 0), next.bins.rows);
        onGridStructureChanged?.();
        next.bins = {
          ...next.bins,
          rows: next.bins.rows + 1,
          cells: next.bins.cells.map((col) => {
            const nextCol = [...col];
            nextCol.splice(insertIndex, 0, null);
            return nextCol;
          }),
        };
      }
      break;
    case 'removeRow':
      if (next.bins.rows <= 1 || patch.index < 0 || patch.index >= next.bins.rows) {
        break;
      }
      onGridStructureChanged?.();
      next.bins = {
        ...next.bins,
        rows: next.bins.rows - 1,
        cells: next.bins.cells.map((col) => {
          const nextCol = [...col];
          nextCol.splice(patch.index, 1);
          return nextCol;
        }),
      };
      break;
    case 'insertColumn':
      {
        const insertIndex = Math.min(Math.max(patch.index, 0), next.bins.cells.length);
        onGridStructureChanged?.();
        const cells = [...next.bins.cells];
        cells.splice(
          insertIndex,
          0,
          Array.from({ length: next.bins.rows }, () => null),
        );
        next.bins = { ...next.bins, columns: next.bins.columns + 1, cells };
      }
      break;
    case 'removeColumn':
      if (next.bins.columns <= 1 || patch.index < 0 || patch.index >= next.bins.cells.length) {
        break;
      }
      {
        onGridStructureChanged?.();
        const cells = [...next.bins.cells];
        cells.splice(patch.index, 1);
        next.bins = { ...next.bins, columns: next.bins.columns - 1, cells };
      }
      break;
    case 'captureEnabledSet':
      next.sets = [
        ...next.sets,
        {
          name: `Set ${next.sets.length + 1}`,
          liveObjectIds: next.bins.cells
            .flatMap((col) => col)
            .filter((cell): cell is NonNullable<typeof cell> => cell !== null && cell.enabled)
            .map((cell) => cell.uniqueId),
        },
      ];
      break;
    case 'renameSet':
      if (patch.index >= 0 && patch.index < next.sets.length) {
        next.sets = next.sets.map((s, i) => (i === patch.index ? { ...s, name: patch.name } : s));
      }
      break;
    case 'removeSet':
      if (patch.index >= 0 && patch.index < next.sets.length) {
        next.sets = next.sets.filter((_, i) => i !== patch.index);
      }
      break;
    case 'moveSet':
      if (
        patch.from >= 0 &&
        patch.from < next.sets.length &&
        patch.to >= 0 &&
        patch.to < next.sets.length
      ) {
        const sets = [...next.sets];
        const [moved] = sets.splice(patch.from, 1);
        sets.splice(patch.to, 0, moved);
        next.sets = sets;
      }
      break;
    case 'applySet':
      if (patch.index >= 0 && patch.index < next.sets.length) {
        const enabledIds = new Set(next.sets[patch.index]!.liveObjectIds);
        next.bins = {
          ...next.bins,
          cells: next.bins.cells.map((col) =>
            col.map((cell) => (cell ? { ...cell, enabled: enabledIds.has(cell.uniqueId) } : cell)),
          ),
        };
      }
      break;
  }

  return next;
}

export function createDefaultMidiInputSnapshot(): MidiInputProcessorSnapshot {
  return {
    keyMapping: 'PCH',
    velocityMapping: 'MIDI',
    pitchConstant: '',
    ampConstant: '',
    scale: null,
  };
}

export function applyMidiInputPatchToSnapshot(
  snap: MidiInputProcessorSnapshot,
  patch: MidiInputPatch,
): MidiInputProcessorSnapshot {
  const next = structuredClone(snap);

  switch (patch.type) {
    case 'updateKeyMapping':
      next.keyMapping = patch.value;
      break;
    case 'updateVelocityMapping':
      next.velocityMapping = patch.value;
      break;
    case 'updatePitchConstant':
      next.pitchConstant = patch.value;
      break;
    case 'updateAmpConstant':
      next.ampConstant = patch.value;
      break;
    case 'updateScale':
      next.scale = patch.scale ? structuredClone(patch.scale) : null;
      break;
  }

  return next;
}

function cloneInstrumentSnapshotForMutation<T extends InstrumentSnapshot>(instrument: T): T {
  if (instrument.type === 'blueX7') {
    const x7 = instrument as unknown as BlueX7InstrumentSnapshot;
    return {
      ...x7,
      voice: x7.voice ? cloneBlueX7Voice(x7.voice) : x7.voice,
    } as unknown as T;
  }
  return { ...instrument };
}

function updateBlueX7OperatorEnableParameters(
  instrument: BlueX7InstrumentSnapshot,
  enabled: readonly boolean[],
): void {
  if (!instrument.parameters || enabled.length !== 6) {
    return;
  }
  instrument.parameters = instrument.parameters.map((parameter) => {
    const match = /^operator\.([1-6])\.enabled$/.exec(parameter.semanticKey);
    if (!match) {
      return parameter;
    }
    const operatorIndex = Number(match[1]) - 1;
    return {
      ...parameter,
      fixedValue: enabled[operatorIndex] ? 1 : 0,
    };
  });
}

function cloneArrangementRowSnapshot(row: ArrangementRowSnapshot): ArrangementRowSnapshot {
  return { ...row };
}

function cloneOrchestraSnapshot(orchestra: OrchestraSnapshot): OrchestraSnapshot {
  return {
    ...orchestra,
    arrangement: {
      ...orchestra.arrangement,
    },
    instruments: orchestra.instruments,
    temporaryLibrary: orchestra.temporaryLibrary,
  };
}

function findPresetNameInGroup(
  group: PresetGroupSnapshot | undefined,
  presetUniqueId: string,
): string | undefined {
  if (!group) return undefined;
  for (const preset of group.presets) {
    if (preset.uniqueId === presetUniqueId) return preset.name;
  }
  for (const subGroup of group.subGroups) {
    const found = findPresetNameInGroup(subGroup, presetUniqueId);
    if (found !== undefined) return found;
  }
  return undefined;
}

function findWidgetObjectNameInTree(
  node: BsbWidgetNodeSnapshot | null | undefined,
  widgetId: string,
): string | undefined {
  if (!node) return undefined;
  if (node.id === widgetId) {
    const objectName = node.objectName.trim();
    return objectName.length > 0 ? objectName : undefined;
  }
  for (const child of node.children ?? []) {
    const found = findWidgetObjectNameInTree(child, widgetId);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * Resolves preset and widget display names from the current orchestra snapshot
 * so BSB undo entries read like "Apply Preset Ocarina" instead of a generic
 * "Edit Instrument".
 */
export function bsbActionLabelContext(
  orchestra: OrchestraSnapshot,
  assignmentId: string,
): BsbActionLabelContext | undefined {
  const instrument = orchestra.instruments.find(
    (candidate) => candidate.assignmentId === assignmentId,
  );
  if (instrument?.type !== 'blueSynthBuilder') return undefined;
  return {
    presetName: (presetUniqueId) => findPresetNameInGroup(instrument.presetGroup, presetUniqueId),
    widgetName: (widgetId) => findWidgetObjectNameInTree(instrument.widgetTree, widgetId),
  };
}

function cloneArrangementRowsForMutation(orchestra: OrchestraSnapshot): ArrangementRowSnapshot[] {
  const nextRows = orchestra.arrangement.rows.slice();
  orchestra.arrangement.rows = nextRows;
  return nextRows;
}

function cloneInstrumentsForMutation(orchestra: OrchestraSnapshot): InstrumentSnapshot[] {
  const nextInstruments = orchestra.instruments.slice();
  orchestra.instruments = nextInstruments;
  return nextInstruments;
}

function getNextArrangementId(rows: ArrangementRowSnapshot[]): string {
  let max = 0;
  for (const row of rows) {
    const value = Number.parseInt(row.assignmentId, 10);
    if (Number.isFinite(value)) {
      max = Math.max(max, value);
    }
  }
  return String(max + 1);
}

function createDefaultInstrumentSnapshot(
  instrumentType: SupportedNewInstrumentType,
  assignmentId: string,
  enabled = true,
): InstrumentSnapshot {
  switch (instrumentType) {
    case 'generic':
      return createInstrumentSnapshot(assignmentId, new GenericInstrument(), enabled);
    case 'javascript':
      return createInstrumentSnapshot(assignmentId, new JavaScriptInstrument(), enabled);
    case 'python':
      return createInstrumentSnapshot(assignmentId, new PythonInstrument(), enabled);
    case 'blueX7':
      return createInstrumentSnapshot(assignmentId, new BlueX7(), enabled);
    case 'blueSynthBuilder':
      return createInstrumentSnapshot(assignmentId, new BlueSynthBuilder(), enabled);
  }

  throw new Error(`Unsupported instrument type: ${instrumentType}`);
}

export function updateInstrumentSnapshot(
  orchestra: OrchestraSnapshot,
  assignmentId: string,
  patch: InstrumentPatch,
): void {
  const instrumentIndex = orchestra.instruments.findIndex(
    (candidate) => candidate.assignmentId === assignmentId,
  );
  const rowIndex = orchestra.arrangement.rows.findIndex(
    (candidate) => candidate.assignmentId === assignmentId,
  );

  if (instrumentIndex < 0) {
    return;
  }

  const nextInstruments = cloneInstrumentsForMutation(orchestra);
  const instrument = cloneInstrumentSnapshotForMutation(nextInstruments[instrumentIndex]!);
  nextInstruments[instrumentIndex] = instrument;

  const rowNeedsMutation = patch.name !== undefined || patch.enabled !== undefined;
  let row = rowIndex >= 0 ? orchestra.arrangement.rows[rowIndex]! : undefined;
  if (rowNeedsMutation && rowIndex >= 0 && row) {
    const nextRows = cloneArrangementRowsForMutation(orchestra);
    row = cloneArrangementRowSnapshot(nextRows[rowIndex]!);
    nextRows[rowIndex] = row;
  }

  if (patch.name !== undefined) {
    instrument.name = patch.name;
    if (row) {
      row.instrumentName = patch.name;
    }
  }

  if (patch.enabled !== undefined) {
    instrument.enabled = patch.enabled;
    if (row) {
      row.enabled = patch.enabled;
    }
  }

  if (patch.comment !== undefined) {
    instrument.comment = patch.comment;
  }

  if (
    instrument.type === 'generic' ||
    instrument.type === 'javascript' ||
    instrument.type === 'python'
  ) {
    if (patch.text !== undefined) {
      instrument.text = patch.text;
    }
    if (patch.globalOrc !== undefined) {
      instrument.globalOrc = patch.globalOrc;
    }
    if (patch.globalSco !== undefined) {
      instrument.globalSco = patch.globalSco;
    }
    if (patch.embeddedOpcodeList) {
      applyEmbeddedOpcodeListPatchToSnapshot(instrument, patch.embeddedOpcodeList);
    }
  } else if (instrument.type === 'blueSynthBuilder') {
    if (patch.instrumentText !== undefined) {
      instrument.instrumentText = patch.instrumentText;
    }
    if (patch.alwaysOnInstrumentText !== undefined) {
      instrument.alwaysOnInstrumentText = patch.alwaysOnInstrumentText;
    }
    if (patch.globalOrc !== undefined) {
      instrument.globalOrc = patch.globalOrc;
    }
    if (patch.globalSco !== undefined) {
      instrument.globalSco = patch.globalSco;
    }
    if (patch.bsbWidgetValues) {
      instrument.widgets = instrument.widgets.map((widget) => {
        const value = patch.bsbWidgetValues?.[widget.objectName];
        return value === undefined ? widget : { ...widget, value };
      });
    }
    if (patch.bsbOpcodeListText !== undefined) {
      instrument.opcodeListText = patch.bsbOpcodeListText;
    }
    if (patch.bsbInterface) {
      applyBsbInstrumentPatchToSnapshot(instrument, patch.bsbInterface);
    }
  } else if (instrument.type === 'blueX7') {
    const x7 = instrument as BlueX7InstrumentSnapshot;
    if (patch.blueX7 && x7.voice && isValidBlueX7Patch(patch.blueX7)) {
      const p = patch.blueX7;
      const v = x7.voice;
      switch (p.type) {
        case 'setCommonField':
          if (p.field === 'operatorEnabled') {
            const enabled = p.value as [boolean, boolean, boolean, boolean, boolean, boolean];
            v.common = { ...v.common, operatorEnabled: [...enabled] };
            updateBlueX7OperatorEnableParameters(x7, enabled);
          } else {
            v.common = { ...v.common, [p.field]: p.value };
          }
          break;
        case 'setOperatorEnabled':
          if (p.operatorIndex >= 0 && p.operatorIndex < 6) {
            const nextEnabled = [...v.common.operatorEnabled] as [
              boolean,
              boolean,
              boolean,
              boolean,
              boolean,
              boolean,
            ];
            nextEnabled[p.operatorIndex] = p.enabled;
            v.common = { ...v.common, operatorEnabled: nextEnabled };
            updateBlueX7OperatorEnableParameters(x7, nextEnabled);
          }
          break;
        case 'setLfoField':
          v.lfo = { ...v.lfo, [p.field]: p.value };
          break;
        case 'setOperatorField':
          if (p.operatorIndex >= 0 && p.operatorIndex < 6) {
            const nextOps = [...v.operators] as typeof v.operators;
            nextOps[p.operatorIndex] = { ...nextOps[p.operatorIndex], [p.field]: p.value };
            v.operators = nextOps;
          }
          break;
        case 'setSharedOscillatorSync':
          v.operators = v.operators.map((op) => ({ ...op, sync: p.value })) as typeof v.operators;
          break;
        case 'setSharedPitchModulationSensitivity':
          v.operators = v.operators.map((op) => ({
            ...op,
            modulationPitch: p.value,
          })) as typeof v.operators;
          break;
        case 'setOperatorEnvelopePoint':
          if (
            p.operatorIndex >= 0 &&
            p.operatorIndex < 6 &&
            p.stageIndex >= 0 &&
            p.stageIndex < 4
          ) {
            const nextOps = [...v.operators] as typeof v.operators;
            const nextEnv = [
              ...nextOps[p.operatorIndex].envelope,
            ] as (typeof nextOps)[0]['envelope'];
            nextEnv[p.stageIndex] = { ...p.point };
            nextOps[p.operatorIndex] = { ...nextOps[p.operatorIndex], envelope: nextEnv };
            v.operators = nextOps;
          }
          break;
        case 'setPitchEnvelopePoint':
          if (p.stageIndex >= 0 && p.stageIndex < 4) {
            const nextPeg = [...v.pitchEnvelope] as typeof v.pitchEnvelope;
            nextPeg[p.stageIndex] = { ...p.point };
            v.pitchEnvelope = nextPeg;
          }
          break;
        case 'setCsoundPostCode':
          v.csoundPostCode = p.text;
          break;
        case 'replaceVoice':
          x7.voice = cloneBlueX7Voice(p.voice);
          break;
      }
      const syncs = x7.voice.operators.map((op) => op.sync);
      const pmss = x7.voice.operators.map((op) => op.modulationPitch);
      x7.sharedOscillatorSync = syncs.every((s) => s === syncs[0]) ? syncs[0] : 'mixed';
      x7.sharedPitchModulationSensitivity = pmss.every((s) => s === pmss[0]) ? pmss[0] : 'mixed';
    }
  }
}

function applyEmbeddedOpcodeListPatchToSnapshot(
  instrument: GenericInstrumentSnapshot | JavaScriptInstrumentSnapshot | PythonInstrumentSnapshot,
  patch: EmbeddedOpcodeListPatch,
): void {
  switch (patch.type) {
    case 'addUdo': {
      const udolist = instrument.udolist ? [...instrument.udolist] : [];
      const newUdo = patch.definition
        ? cloneUdoSnapshot(patch.definition)
        : cloneUdoSnapshot(EMPTY_UDO_SNAPSHOT);
      if (patch.index !== undefined && patch.index >= 0 && patch.index <= udolist.length) {
        udolist.splice(patch.index, 0, newUdo);
      } else {
        udolist.push(newUdo);
      }
      instrument.udolist = udolist;
      break;
    }
    case 'removeUdo': {
      const removeUdolist = instrument.udolist ? [...instrument.udolist] : [];
      if (patch.index >= 0 && patch.index < removeUdolist.length) {
        removeUdolist.splice(patch.index, 1);
      }
      instrument.udolist = removeUdolist;
      break;
    }
    case 'updateUdo': {
      const updateUdolist = instrument.udolist
        ? instrument.udolist.map((udo) => cloneUdoSnapshot(udo))
        : [];
      if (patch.index >= 0 && patch.index < updateUdolist.length) {
        updateUdolist[patch.index] = { ...updateUdolist[patch.index], ...patch.patch };
      }
      instrument.udolist = updateUdolist;
      break;
    }
    case 'convertUdoStyle': {
      const convertedUdolist = instrument.udolist
        ? instrument.udolist.map((udo) => cloneUdoSnapshot(udo))
        : [];
      if (patch.index >= 0 && patch.index < convertedUdolist.length) {
        convertedUdolist[patch.index] = convertUdoSnapshotStyle(
          convertedUdolist[patch.index]!,
          patch.style,
        );
      }
      instrument.udolist = convertedUdolist;
      break;
    }
    case 'reorderUdo': {
      const reorderUdolist = instrument.udolist ? [...instrument.udolist] : [];
      if (
        patch.from >= 0 &&
        patch.from < reorderUdolist.length &&
        patch.to >= 0 &&
        patch.to < reorderUdolist.length
      ) {
        const [moved] = reorderUdolist.splice(patch.from, 1);
        reorderUdolist.splice(patch.to, 0, moved);
      }
      instrument.udolist = reorderUdolist;
      break;
    }
  }
}

export function applyOrchestraPatchSnapshot(
  orchestra: OrchestraSnapshot,
  patch: OrchestraPatch,
): OrchestraSnapshot {
  const next = cloneOrchestraSnapshot(orchestra);

  switch (patch.type) {
    case 'addInstrument': {
      const assignmentId = getNextArrangementId(next.arrangement.rows);
      const instrument = createDefaultInstrumentSnapshot(patch.instrumentType, assignmentId);
      const nextRows = cloneArrangementRowsForMutation(next);
      const nextInstruments = cloneInstrumentsForMutation(next);
      nextRows.push({
        assignmentId,
        enabled: instrument.enabled,
        instrumentName: instrument.name,
        instrumentType: instrument.type,
        instrumentSummary: instrument.type,
        editable: true,
      });
      nextInstruments.push(instrument);
      break;
    }
    case 'removeAssignment': {
      next.arrangement.rows = next.arrangement.rows.filter(
        (row) => row.assignmentId !== patch.assignmentId,
      );
      next.instruments = next.instruments.filter(
        (instrument) => instrument.assignmentId !== patch.assignmentId,
      );
      break;
    }
    case 'duplicateAssignment': {
      const sourceRow = next.arrangement.rows.find(
        (row) => row.assignmentId === patch.sourceAssignmentId,
      );
      const sourceInstrument = next.instruments.find(
        (instrument) => instrument.assignmentId === patch.sourceAssignmentId,
      );
      if (sourceRow && sourceInstrument) {
        const assignmentId = getNextArrangementId(next.arrangement.rows);
        const duplicatedInstrument = cloneInstrumentSnapshot(sourceInstrument);
        duplicatedInstrument.assignmentId = assignmentId;
        const nextRows = cloneArrangementRowsForMutation(next);
        const nextInstruments = cloneInstrumentsForMutation(next);
        nextRows.push({
          ...sourceRow,
          assignmentId,
        });
        nextInstruments.push(duplicatedInstrument);
      }
      break;
    }
    case 'pasteInstrument': {
      const assignmentId = getNextArrangementId(next.arrangement.rows);
      const pastedInstrument = cloneInstrumentSnapshot(patch.instrument);
      pastedInstrument.assignmentId = assignmentId;
      const nextRows = cloneArrangementRowsForMutation(next);
      const nextInstruments = cloneInstrumentsForMutation(next);
      const pastedRow = {
        assignmentId,
        enabled: pastedInstrument.enabled,
        instrumentName: pastedInstrument.name,
        instrumentType: pastedInstrument.type,
        instrumentSummary: pastedInstrument.type,
        editable: true,
      };
      const insertAfterIndex = patch.insertAfterAssignmentId
        ? nextRows.findIndex((row) => row.assignmentId === patch.insertAfterAssignmentId)
        : -1;
      const insertIndex = insertAfterIndex >= 0 ? insertAfterIndex + 1 : nextRows.length;
      nextRows.splice(insertIndex, 0, pastedRow);
      nextInstruments.splice(insertIndex, 0, pastedInstrument);
      break;
    }
    case 'updateAssignment': {
      const rowIndex = next.arrangement.rows.findIndex(
        (candidate) => candidate.assignmentId === patch.assignmentId,
      );
      const instrumentIndex = next.instruments.findIndex(
        (candidate) => candidate.assignmentId === patch.assignmentId,
      );
      const row =
        rowIndex >= 0 ? cloneArrangementRowSnapshot(next.arrangement.rows[rowIndex]!) : undefined;
      const instrument =
        instrumentIndex >= 0
          ? cloneInstrumentSnapshotForMutation(next.instruments[instrumentIndex]!)
          : undefined;

      if (rowIndex >= 0 && row) {
        next.arrangement.rows = next.arrangement.rows.slice();
        next.arrangement.rows[rowIndex] = row;
      }
      if (instrumentIndex >= 0 && instrument) {
        next.instruments = next.instruments.slice();
        next.instruments[instrumentIndex] = instrument;
      }

      if (row) {
        if (patch.enabled !== undefined) {
          row.enabled = patch.enabled;
          if (instrument) {
            instrument.enabled = patch.enabled;
          }
        }

        if (patch.nextAssignmentId && patch.nextAssignmentId.trim()) {
          const nextAssignmentId = patch.nextAssignmentId.trim();
          const duplicate = next.arrangement.rows.some(
            (candidate) => candidate !== row && candidate.assignmentId === nextAssignmentId,
          );
          if (!duplicate && row.assignmentId !== nextAssignmentId) {
            row.assignmentId = nextAssignmentId;
            if (instrument) {
              instrument.assignmentId = nextAssignmentId;
            }
          }
        }
      }
      break;
    }
    case 'replaceInstrument': {
      const rowIndex = next.arrangement.rows.findIndex(
        (candidate) => candidate.assignmentId === patch.assignmentId,
      );
      if (rowIndex >= 0) {
        const row = cloneArrangementRowSnapshot(next.arrangement.rows[rowIndex]!);
        const instrument = createDefaultInstrumentSnapshot(
          patch.instrumentType,
          patch.assignmentId,
          row.enabled,
        );
        next.arrangement.rows = next.arrangement.rows.slice();
        next.arrangement.rows[rowIndex] = row;
        row.instrumentType = instrument.type;
        row.instrumentName = instrument.name;
        row.instrumentSummary = instrument.type;
        const index = next.instruments.findIndex(
          (candidate) => candidate.assignmentId === patch.assignmentId,
        );
        if (index >= 0) {
          next.instruments = next.instruments.slice();
          next.instruments[index] = instrument;
        }
      }
      break;
    }
    case 'convertGenericToBsb': {
      const source = next.instruments.find(
        (candidate) => candidate.assignmentId === patch.assignmentId,
      );
      const rowIndex = next.arrangement.rows.findIndex(
        (candidate) => candidate.assignmentId === patch.assignmentId,
      );
      if (source?.type === 'generic' && rowIndex >= 0) {
        const row = cloneArrangementRowSnapshot(next.arrangement.rows[rowIndex]!);
        const converted: InstrumentSnapshot = {
          assignmentId: source.assignmentId,
          type: 'blueSynthBuilder',
          name: source.name,
          enabled: source.enabled,
          comment: source.comment,
          instrumentText: source.text,
          alwaysOnInstrumentText: '',
          globalOrc: source.globalOrc,
          globalSco: source.globalSco,
          objectNames: [],
          widgets: [],
          editEnabled: true,
          gridSettings: new BlueSynthBuilder().getGraphicInterface().getGridSettings(),
          widgetTree: {
            id: 'root',
            type: 'BSBRootGroup',
            objectName: '',
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            value: 0,
            minimum: 0,
            maximum: 1,
            properties: {},
            editable: true,
            children: [],
          },
        };
        next.arrangement.rows = next.arrangement.rows.slice();
        next.arrangement.rows[rowIndex] = row;
        row.instrumentType = converted.type;
        row.instrumentName = converted.name;
        row.instrumentSummary = converted.type;
        const index = next.instruments.findIndex(
          (candidate) => candidate.assignmentId === patch.assignmentId,
        );
        if (index >= 0) {
          next.instruments = next.instruments.slice();
          next.instruments[index] = converted;
        }
      }
      break;
    }
    case 'updateInstrument': {
      updateInstrumentSnapshot(next, patch.assignmentId, patch.patch);
      break;
    }
    case 'updateInstrumentComment': {
      updateInstrumentSnapshot(next, patch.assignmentId, { comment: patch.comment });
      break;
    }
  }

  return next;
}
