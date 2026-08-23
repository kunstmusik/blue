import {
  BlueData,
  Channel,
  ChannelList,
  BlueSynthBuilder,
  BlueX7,
  cloneBlueX7Voice,
  BSBGroup,
  BSBWidget,
  BSBXYController,
  BSBDropdown,
  Element,
  GenericInstrument,
  Instrument,
  JavaScriptInstrument,
  Effect,
  OpcodeDefinition,
  OpcodeList,
  Preset,
  PresetGroup,
  ProjectProperties,
  PythonInstrument,
  Mixer,
  Scale,
  TempoMap,
  TempoPoint,
  CurveType,
  UDOStyle,
  convertToModern,
  convertToClassic,
  LiveData,
  LiveObject,
  LiveObjectBins,
  LiveObjectSetList,
  Send,
  Score,
  PolyObject,
  SoundLayer,
  TrackLayer,
  TrackLayerGroup,
  PatternLayer,
  PatternsLayerGroup,
  TimeBase,
  isValidSnapValueName,
  SoundObject,
  SoundObjectLibrary,
  collectInstanceSoundObjects,
  Instance,
  AbstractSoundObject,
  TimeBehavior,
  NoteProcessorChain,
  AudioClip,
  ObjRefLoadMap,
  TimePosition,
  TimeDuration,
  TimeContext,
  GenericScore,
  PythonObject,
  ClojureLibraryEntry,
  ClojureProjectData,
  ClojureObject,
  JavaScriptObject,
  Comment,
  External,
  AudioFile,
  FrozenSoundObject,
  PatternObject,
  Pattern,
  LineObject,
  ZakLineObject,
  PianoRoll,
  PianoNote,
  FieldDef,
  TrackerObject,
  Track,
  TrackerNote,
  Column,
  JMask,
  loadFieldFromSnapshot,
  Sound,
  createSoundObject,
  loadSoundObjectFromXML,
  convertTimePosition,
  beatsToTimePosition,
  timePositionToBeats,
  beatsToDuration,
  MeterMap,
  MeasureMeterPair,
  Meter,
  FadeType,
  ObjectBuilder,
  ScratchPadData,
  getTrackPlacementForSoundObject,
  getNotes as parseScoreNotes,
  createNoteProcessorChainSnapshot as createNoteProcessorChainSnapshotFromData,
  reifyChainFromSnapshot,
} from '@blue/data';
import type { NoteProcessorChainSnapshot as DataNoteProcessorChainSnapshot, Parameter as BlueDataParameter, ScoreObject as BlueDataScoreObject, AutomatableLayer as BlueDataAutomatableLayer, Arrangement as BlueDataArrangement, Mixer as BlueDataMixer } from '@blue/data';
import { AutomationCurve as BlueDataAutomationCurve, LineColors } from '@blue/data';
import { ParameterHelper } from '@blue/data';
import type { SnapValueName, BlueX7Voice, BlueX7Common, BlueX7Lfo, BlueX7Operator, BlueX7EnvelopePoint } from '@blue/data';
import type { MissingAudioAssetsSession } from '../missing-audio-assets';
import type { ScoreInsertionLocation } from '../unified-library';

import { moveRangeWithAnchors, scaleRangeWithAnchors } from '../automation-range-math';
import {
  BSB_LINE_SELECTOR_HEIGHT,
  getBsbWidgetDisplaySize,
} from '../bsb-widget-layout';
import {
  collectBsbReplacementKeysFromSnapshotTree,
  collectBsbReplacementKeysFromWidgetTree,
  getBsbReplacementKeysFromSnapshot,
  getBsbReplacementKeysFromWidget,
  getDerivedKeysFromSnapshot,
  getDerivedKeysFromWidget,
} from '../bsb-widget-keys';

import type {
  AutomationParameterSnapshot,
  BsbInterfacePatch,
  BsbWidgetNodeSnapshot,
  BsbWidgetSnapshot,
  EmbeddedOpcodeListPatch,
  GridSettingsSnapshot,
  PresetGroupSnapshot,
  PresetSnapshot,
  SoundAutomationParameterSnapshot,
  UdoDefinitionSnapshot,
} from './contract';

export function toGridSettingsSnapshot(settings: {
  enabled: boolean;
  snapEnabled: boolean;
  width: number;
  height: number;
  gridStyle: string;
}): GridSettingsSnapshot {
  return {
    enabled: settings.enabled,
    snapEnabled: settings.snapEnabled,
    width: settings.width,
    height: settings.height,
    gridStyle: settings.gridStyle as GridSettingsSnapshot['gridStyle'],
  };
}

export function collectGraphicInterfaceWidgets(graphicInterface: {
  getRootGroup(): {
    id?: string;
    getChildren(): unknown[];
  };
  getGridSettings(): {
    enabled: boolean;
    snapEnabled: boolean;
    width: number;
    height: number;
    gridStyle: string;
  };
  isEditEnabled(): boolean;
}): BsbWidgetSnapshot[] {
  const widgets: BsbWidgetSnapshot[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    const objectName =
      typeof record.getObjectName === 'function'
        ? (record.getObjectName as () => unknown)()
        : record.objectName ?? record._objectName;
    if (typeof objectName === 'string' && objectName.trim()) {
      widgets.push({
        objectName: objectName.trim(),
        widgetType:
          typeof record.constructor === 'function' && 'name' in record.constructor
            ? String(record.constructor.name)
            : 'BSBObject',
        value: typeof record.value === 'number' ? record.value : 0,
        minimum: typeof record.minimum === 'number' ? record.minimum : 0,
        maximum: typeof record.maximum === 'number' ? record.maximum : 1,
      });
    }

    const children =
      typeof record.getChildren === 'function'
        ? (record.getChildren as () => unknown[]).call(node)
        : record.children ?? record._children;
    if (Array.isArray(children)) {
      children.forEach(visit);
    }
  };

  visit(graphicInterface.getRootGroup());
  return widgets.sort((a, b) => a.objectName.localeCompare(b.objectName));
}

export function collectGraphicInterfaceObjectNames(graphicInterface: {
  getRootGroup(): {
    id?: string;
    getChildren(): unknown[];
  };
  getGridSettings(): {
    enabled: boolean;
    snapEnabled: boolean;
    width: number;
    height: number;
    gridStyle: string;
  };
  isEditEnabled(): boolean;
}): string[] {
  return collectBsbReplacementKeysFromWidgetTree(graphicInterface.getRootGroup() as unknown as BSBWidget);
}

function cloneBsbSnapshotValue<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneBsbSnapshotValue(item)) as T;
  }

  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    next[key] = cloneBsbSnapshotValue(item);
  }
  return next as T;
}

function getWidgetSnapshotFallbackSize(record: Record<string, unknown>): { width: number; height: number } {
  return {
    width:
      typeof record.width === 'number'
        ? record.width
        : typeof record.sliderWidth === 'number'
          ? record.sliderWidth
          : typeof record.textFieldWidth === 'number'
            ? record.textFieldWidth
            : typeof record.canvasWidth === 'number'
              ? record.canvasWidth
              : 60,
    height:
      typeof record.height === 'number'
        ? record.height
        : typeof record.sliderHeight === 'number'
          ? record.sliderHeight
          : typeof record.canvasHeight === 'number'
            ? record.canvasHeight + BSB_LINE_SELECTOR_HEIGHT
            : 24,
  };
}

function serializeBsbWidgetSnapshot(widget: unknown): BsbWidgetNodeSnapshot | null {
  if (!widget || typeof widget !== 'object') return null;
  const record = widget as Record<string, unknown>;

  const id = typeof record.id === 'string' ? record.id : '';
  if (!id) return null;

  const ctorName = typeof record.constructor === 'function' && 'name' in record.constructor
    ? String(record.constructor.name)
    : 'Unknown';

  const preservedOnly = !KNOWN_WIDGET_TYPES.has(ctorName);

  const properties: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(record)) {
    if (['id', 'objectName', 'x', 'y', 'width', 'height', 'parameterName', '_children', 'children', 'stringChannel', 'labelFont', 'font'].includes(key)) continue;
    if (key === 'dropdownItems' && Array.isArray(val)) {
      properties.dropdownItems = cloneBsbSnapshotValue(val);
      continue;
    }
    if (key === 'lines' && Array.isArray(val)) {
      properties.lines = val.map((line) => {
        if (!line || typeof line !== 'object') {
          return {
            varName: '',
            min: 0,
            max: 1,
            color: '#000000',
            points: [],
          };
        }

        const lineRecord = line as Record<string, unknown>;
        const points = Array.isArray(lineRecord.points)
          ? lineRecord.points.map((point) => {
              if (!point || typeof point !== 'object') {
                return { x: 0, y: 0 };
              }
              const pointRecord = point as Record<string, unknown>;
              return {
                x: typeof pointRecord.x === 'number' ? pointRecord.x : 0,
                y: typeof pointRecord.y === 'number' ? pointRecord.y : 0,
              };
            })
          : [];

        return {
          varName: typeof lineRecord.name === 'string' && lineRecord.name.trim().length > 0
            ? lineRecord.name
            : typeof lineRecord.varName === 'string'
              ? lineRecord.varName
              : '',
          min: typeof lineRecord.min === 'number' ? lineRecord.min : 0,
          max: typeof lineRecord.max === 'number' ? lineRecord.max : 1,
          color: normalizeBsbLineColor(lineRecord.color),
          resolution: typeof lineRecord.resolution === 'string' ? lineRecord.resolution : undefined,
          rightBound: typeof lineRecord.rightBound === 'boolean' ? lineRecord.rightBound : undefined,
          endPointsLinked: typeof lineRecord.endPointsLinked === 'boolean' ? lineRecord.endPointsLinked : undefined,
          points,
        };
      });
      continue;
    }
    if (key === 'sliders' && Array.isArray(val)) {
      properties.sliders = val.map((slider) => {
        if (!slider || typeof slider !== 'object') {
          return { value: 0 };
        }
        const sliderRecord = slider as Record<string, unknown>;
        return {
          value: typeof sliderRecord.value === 'number' ? sliderRecord.value : 0,
        };
      });
      continue;
    }
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' || val === null) {
      properties[key] = val as string | number | boolean | null;
    }
  }

  const fontKeys = ['labelFont', 'font'] as const;
  for (const fk of fontKeys) {
    const fv = record[fk];
    if (fv && typeof fv === 'object') {
      const f = fv as Record<string, unknown>;
      if (typeof f.name === 'string') properties[`${fk}.name`] = f.name;
      if (typeof f.size === 'number') properties[`${fk}.size`] = f.size;
      if (typeof f.style === 'number') properties[`${fk}.style`] = f.style;
    }
  }

  if (ctorName === 'BSBHSliderBank' || ctorName === 'BSBVSliderBank') {
    const sliderCount = Array.isArray(properties.sliders)
      ? properties.sliders.length
      : typeof record.numberOfSliders === 'number'
        ? record.numberOfSliders
        : 1;
    properties.numberOfSliders = Math.max(1, sliderCount);
  }

  const children = typeof record.getChildren === 'function'
    ? (record.getChildren as () => unknown[]).call(widget)
    : record.children ?? record._children;

  const childSnapshots = Array.isArray(children)
    ? children
        .map((child) => serializeBsbWidgetSnapshot(child))
        .filter((node): node is BsbWidgetNodeSnapshot => Boolean(node))
    : [];

  const baseSize = getWidgetSnapshotFallbackSize(record);
  const snapshot: BsbWidgetNodeSnapshot = {
    id,
    type: ctorName,
    objectName: typeof record.objectName === 'string' ? record.objectName : '',
    x: typeof record.x === 'number' ? record.x : 0,
    y: typeof record.y === 'number' ? record.y : 0,
    width: baseSize.width,
    height: baseSize.height,
    value: typeof record.value === 'number' ? record.value : 0,
    minimum: typeof record.minimum === 'number' ? record.minimum : 0,
    maximum: typeof record.maximum === 'number' ? record.maximum : 1,
    editable: !preservedOnly,
    preservedOnly,
    properties,
    children: childSnapshots.length > 0 ? childSnapshots : undefined,
  };

  if (
    (ctorName === 'BSBHSlider'
      || ctorName === 'BSBVSlider'
      || ctorName === 'BSBHSliderBank'
      || ctorName === 'BSBVSliderBank')
    && typeof record.getResolutionText === 'function'
  ) {
    try {
      const resolutionText = (record.getResolutionText as () => unknown).call(widget);
      if (typeof resolutionText === 'string') {
        snapshot.properties.resolutionDecimal = resolutionText;
      }
    } catch {
      // Keep the numeric projection available for legacy/malformed widgets;
      // explicit exact edits are validated by the canonical model.
    }
  }

  if (ctorName !== 'BSBGroup') {
    const displaySize = getBsbWidgetDisplaySize(snapshot);
    snapshot.width = displaySize.width;
    snapshot.height = displaySize.height;
  }

  return snapshot;
}

export function createBsbWidgetSnapshotFromWidget(widget: unknown): BsbWidgetNodeSnapshot | null {
  return serializeBsbWidgetSnapshot(widget);
}

export function createDefaultBsbWidgetSnapshot(widgetType: string): BsbWidgetNodeSnapshot | null {
  const factory = new BlueSynthBuilder().getGraphicInterface().createWidgetByType(widgetType);
  return factory ? serializeBsbWidgetSnapshot(factory) : null;
}

function buildWidgetTreeNodeFromGraphicNode(widget: unknown): BsbWidgetNodeSnapshot | null {
  return serializeBsbWidgetSnapshot(widget);
}

export function buildWidgetTreeSnapshotFromGraphicInterface(graphicInterface: {
  getRootGroup(): {
    id?: string;
    getChildren(): unknown[];
  };
}): BsbWidgetNodeSnapshot {
  const rootGroup = graphicInterface.getRootGroup();
  const children: BsbWidgetNodeSnapshot[] = [];

  for (const child of rootGroup.getChildren()) {
    const node = buildWidgetTreeNodeFromGraphicNode(child);
    if (node) {
      children.push(node);
    }
  }

  return {
    id: rootGroup.id || 'root',
    type: 'BSBRootGroup',
    objectName: '',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    value: 0,
    minimum: 0,
    maximum: 1,
    editable: true,
    properties: {},
    children,
  };
}



export function collectBsbWidgets(bsb: BlueSynthBuilder): BsbWidgetSnapshot[] {
  const widgets: BsbWidgetSnapshot[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    const objectName =
      typeof record.getObjectName === 'function'
        ? (record.getObjectName as () => unknown)()
        : record.objectName ?? record._objectName;
    if (typeof objectName === 'string' && objectName.trim()) {
      widgets.push({
        objectName: objectName.trim(),
        widgetType:
          typeof record.constructor === 'function' && 'name' in record.constructor
            ? String(record.constructor.name)
            : 'BSBObject',
        value: typeof record.value === 'number' ? record.value : 0,
        minimum: typeof record.minimum === 'number' ? record.minimum : 0,
        maximum: typeof record.maximum === 'number' ? record.maximum : 1,
      });
    }
    const children =
      typeof record.getChildren === 'function'
        ? (record.getChildren as () => unknown[]).call(node)
        : record.children ?? record._children;
    if (Array.isArray(children)) {
      children.forEach(visit);
    }
  };

  visit(bsb.getGraphicInterface().getRootGroup());
  return widgets.sort((a, b) => a.objectName.localeCompare(b.objectName));
}

export function collectBsbObjectNames(bsb: BlueSynthBuilder): string[] {
  return collectBsbReplacementKeysFromWidgetTree(bsb.getGraphicInterface().getRootGroup());
}

export function parseSoundBSB(text: string): BlueSynthBuilder {
  const trimmed = text.trim();
  if (!trimmed) {
    return new BlueSynthBuilder();
  }

  try {
    const elem = Element.parse(trimmed);
    if (elem.getName() === 'instrument') {
      return BlueSynthBuilder.loadFromXML(elem);
    }
    const nestedInstrument = elem.getElement('instrument');
    if (nestedInstrument) {
      return BlueSynthBuilder.loadFromXML(nestedInstrument);
    }
  } catch {
    // Fall through to legacy plain-text migration
  }

  const legacy = new BlueSynthBuilder();
  legacy.setInstrumentText(trimmed);
  return legacy;
}

export function buildSoundAutomationParameters(bsb: BlueSynthBuilder): SoundAutomationParameterSnapshot[] {
  const params = bsb.getParameters();
  return params.map((param) => ({
    parameterId: param.getUniqueId(),
    name: param.getName(),
    label: param.getLabel(),
    automationEnabled: param.isEnabled(),
    value: param.getFixedValue(),
    minimum: param.getMinimum(),
    maximum: param.getMaximum(),
    resolutionDecimal: param.getResolutionText(),
    resolution: param.getResolution(),
    curve: param.getCurve(),
    points: param.getPoints().map((p) => ({ x: p.time, y: p.value })),
  }));
}



const KNOWN_WIDGET_TYPES = new Set([
  'BSBKnob', 'BSBCheckBox', 'BSBHSlider', 'BSBVSlider',
  'BSBHSliderBank', 'BSBVSliderBank', 'BSBValue', 'BSBDropdown',
  'BSBXYController', 'BSBSubChannelDropdown', 'BSBFileSelector',
  'BSBTextField', 'BSBLabel', 'BSBLineObject', 'BSBGroup',
]);

function bsbColorIntToCss(color: number): string {
  const rgb = (color >>> 0) & 0x00ffffff;
  return `#${rgb.toString(16).padStart(6, '0')}`;
}

function normalizeBsbLineColor(raw: unknown): string {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return bsbColorIntToCss(raw);
  }
  if (typeof raw !== 'string') {
    return '#808080';
  }
  const trimmed = raw.trim();
  if (/^-?\d+$/.test(trimmed)) {
    return bsbColorIntToCss(parseInt(trimmed, 10));
  }
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed;
  }
  return '#808080';
}

function buildWidgetTreeNode(widget: unknown): BsbWidgetNodeSnapshot | null {
  return serializeBsbWidgetSnapshot(widget);
}

export function buildWidgetTreeSnapshot(bsb: BlueSynthBuilder): BsbWidgetNodeSnapshot {
  const rootGroup = bsb.getGraphicInterface().getRootGroup();
  const rootChildren = rootGroup.getChildren();

  const children: BsbWidgetNodeSnapshot[] = [];
  for (const child of rootChildren) {
    const node = buildWidgetTreeNode(child);
    if (node) children.push(node);
  }

  return {
    id: rootGroup.id || 'root',
    type: 'BSBRootGroup',
    objectName: '',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    value: 0,
    minimum: 0,
    maximum: 0,
    editable: true,
    properties: {},
    children,
  };
}

export function buildGridSettingsSnapshot(bsb: BlueSynthBuilder): GridSettingsSnapshot {
  const gs = bsb.getGraphicInterface().getGridSettings();
  return {
    enabled: gs.enabled,
    snapEnabled: gs.snapEnabled,
    width: gs.width,
    height: gs.height,
    gridStyle: gs.gridStyle,
  };
}

export function buildPresetGroupSnapshot(bsb: BlueSynthBuilder): PresetGroupSnapshot | undefined {
  const pg = bsb.getPresetGroup();
  if (!pg) return undefined;

  const convert = (group: PresetGroup): PresetGroupSnapshot => ({
    name: group.getPresetGroupName(),
    currentPresetUniqueId: group.getCurrentPresetUniqueId() || undefined,
    currentPresetModified: group.isCurrentPresetModified(),
    subGroups: group.getSubGroups().map(convert),
    presets: group.getPresets().map((p) => {
      const valuesMap = p.getValuesMap();
      const values: Record<string, string> = {};
      for (const [k, v] of valuesMap) {
        values[k] = v;
      }
      return {
        uniqueId: p.getUniqueId(),
        name: p.getPresetName(),
        values,
      };
    }),
  });

  return convert(pg);
}

export function buildUdoListSnapshot(bsb: BlueSynthBuilder): UdoDefinitionSnapshot[] {
  const udos = bsb.getUdoList();
  return udos.map((udo: OpcodeDefinition) => ({
    name: udo.getName(),
    style: udo.getStyle(),
    outTypes: udo.getOutTypes(),
    inTypes: udo.getInTypes(),
    inputArguments: udo.getInputArguments(),
    code: udo.getCode(),
    comments: udo.getComments(),
  }));
}



export function createPresetGroupFromSnapshot(snapshot?: PresetGroupSnapshot): PresetGroup | null {
  if (!snapshot) return null;

  const presetIdMap = new Map<string, string>();
  const createGroup = (groupSnapshot: PresetGroupSnapshot): PresetGroup => {
    const group = new PresetGroup();
    group.setPresetGroupName(groupSnapshot.name);
    group.setCurrentPresetModified(groupSnapshot.currentPresetModified);

    for (const presetSnapshot of groupSnapshot.presets) {
      const preset = new Preset();
      preset.setPresetName(presetSnapshot.name);
      preset.setValuesMap(new Map(Object.entries(presetSnapshot.values ?? {})));
      presetIdMap.set(presetSnapshot.uniqueId, preset.getUniqueId());
      group.presets.push(preset);
    }

    for (const childSnapshot of groupSnapshot.subGroups) {
      group.subGroups.push(createGroup(childSnapshot));
    }

    if (groupSnapshot.currentPresetUniqueId) {
      group.setCurrentPresetUniqueId(
        presetIdMap.get(groupSnapshot.currentPresetUniqueId) ?? '',
      );
    }
    return group;
  };

  return createGroup(snapshot);
}

export function restoreBsbAutomationParameters(
  bsb: BlueSynthBuilder,
  snapshots?: SoundAutomationParameterSnapshot[],
): void {
  if (!snapshots) return;

  const snapshotByName = new Map(snapshots.map((snapshot) => [snapshot.name, snapshot]));
  for (const parameter of bsb.getParameters()) {
    const snapshot = snapshotByName.get(parameter.getName());
    if (!snapshot) continue;

    parameter.setLabel(snapshot.label);
    parameter.setMinimum(snapshot.minimum, true);
    parameter.setMaximum(snapshot.maximum, true);
    if (snapshot.resolutionDecimal !== undefined) {
      parameter.setResolutionText(snapshot.resolutionDecimal);
    } else if (snapshot.resolution !== undefined) {
      // Legacy renderer snapshots carry only a number. Normalize it through
      // Parameter's Java-compatible legacy setter at this boundary.
      parameter.setResolution(snapshot.resolution);
    }
    parameter.setFixedValue(snapshot.value);
    parameter.setPoints(snapshot.points.map((point) => ({ time: point.x, value: point.y })));
    const curve = snapshot.curve as keyof typeof BlueDataAutomationCurve;
    if (curve in BlueDataAutomationCurve) {
      parameter.setCurve(BlueDataAutomationCurve[curve]);
    }
    parameter.setAutomationEnabled(snapshot.automationEnabled);
  }
}

export function applyEmbeddedOpcodeListPatch(opcodeList: OpcodeList, patch: EmbeddedOpcodeListPatch): boolean {
  switch (patch.type) {
    case 'addUdo': {
      const definition = patch.definition
        ? snapshotToUdo(patch.definition)
        : new OpcodeDefinition();
      const index = patch.index ?? opcodeList.size();
      opcodeList.addOpcodeAt(index, definition);
      return true;
    }
    case 'removeUdo':
      return opcodeList.removeOpcodeAt(patch.index);
    case 'updateUdo': {
      const existing = opcodeList.getOpcode(patch.index);
      if (!existing) return false;
      if (patch.patch.name !== undefined) existing.setName(patch.patch.name);
      if (patch.patch.outTypes !== undefined) existing.setOutTypes(patch.patch.outTypes);
      if (patch.patch.inTypes !== undefined) existing.setInTypes(patch.patch.inTypes);
      if (patch.patch.inputArguments !== undefined) existing.setInputArguments(patch.patch.inputArguments);
      if (patch.patch.code !== undefined) existing.setCode(patch.patch.code);
      if (patch.patch.comments !== undefined) existing.setComments(patch.patch.comments);
      if (patch.patch.style !== undefined) {
        existing.setStyle(UDOStyle[patch.patch.style as keyof typeof UDOStyle]);
      }
      return true;
    }
    case 'convertUdoStyle': {
      const udo = opcodeList.getOpcode(patch.index);
      if (!udo) return false;
      udo.setStyle(UDOStyle[patch.style as keyof typeof UDOStyle]);
      return true;
    }
    case 'reorderUdo': {
      const udo = opcodeList.getOpcode(patch.from);
      if (!udo) return false;
      opcodeList.removeOpcodeAt(patch.from);
      opcodeList.addOpcodeAt(patch.to, udo);
      return true;
    }
  }
}

function getPresetGroupAtPath(
  root: PresetGroup,
  path: readonly number[],
): PresetGroup | null {
  let current = root;
  for (const index of path) {
    if (!Number.isInteger(index) || index < 0) return null;
    const next = current.subGroups[index];
    if (!next) return null;
    current = next;
  }
  return current;
}

function findPresetParentGroup(
  root: PresetGroup,
  presetUniqueId: string,
): PresetGroup | null {
  if (root.presets.some((preset) => preset.getUniqueId() === presetUniqueId)) {
    return root;
  }
  for (const subGroup of root.subGroups) {
    const parent = findPresetParentGroup(subGroup, presetUniqueId);
    if (parent) return parent;
  }
  return null;
}

function isPathWithin(path: readonly number[], possibleParent: readonly number[]): boolean {
  return possibleParent.length < path.length
    && possibleParent.every((index, position) => path[position] === index);
}

function clearMissingCurrentPreset(presetGroup: PresetGroup): void {
  const currentPresetId = presetGroup.getCurrentPresetUniqueId();
  if (currentPresetId && !presetGroup.findPresetByUniqueId(currentPresetId)) {
    presetGroup.setCurrentPresetUniqueId('');
    presetGroup.setCurrentPresetModified(false);
  }
}

function removePresetGroupAtPath(root: PresetGroup, path: readonly number[]): boolean {
  if (path.length === 0) return false;
  const parent = getPresetGroupAtPath(root, path.slice(0, -1));
  const index = path[path.length - 1];
  if (!parent || index === undefined || !Number.isInteger(index) || index < 0) {
    return false;
  }
  const [removed] = parent.subGroups.splice(index, 1);
  if (!removed) return false;
  clearMissingCurrentPreset(root);
  return true;
}

function movePresetAtPath(
  root: PresetGroup,
  presetUniqueId: string,
  parentGroupPath: readonly number[],
  targetIndex: number,
): boolean {
  const sourceParent = findPresetParentGroup(root, presetUniqueId);
  const targetParent = getPresetGroupAtPath(root, parentGroupPath);
  if (!sourceParent || !targetParent) return false;

  const sourceIndex = sourceParent.presets.findIndex(
    (preset) => preset.getUniqueId() === presetUniqueId,
  );
  if (sourceIndex < 0) return false;

  const [preset] = sourceParent.presets.splice(sourceIndex, 1);
  if (!preset) return false;

  const rawPresetIndex = Number.isFinite(targetIndex)
    ? Math.trunc(targetIndex) - targetParent.subGroups.length
    : targetParent.presets.length;
  const adjustedPresetIndex = sourceParent === targetParent && sourceIndex < rawPresetIndex
    ? rawPresetIndex - 1
    : rawPresetIndex;
  const presetIndex = Math.max(0, Math.min(adjustedPresetIndex, targetParent.presets.length));
  targetParent.presets.splice(presetIndex, 0, preset);
  return true;
}

function movePresetGroupAtPath(
  root: PresetGroup,
  sourcePath: readonly number[],
  parentGroupPath: readonly number[],
  targetIndex: number,
): boolean {
  const samePath = sourcePath.length === parentGroupPath.length
    && sourcePath.every((index, position) => parentGroupPath[position] === index);
  if (sourcePath.length === 0 || samePath || isPathWithin(parentGroupPath, sourcePath)) {
    return false;
  }

  const sourceParent = getPresetGroupAtPath(root, sourcePath.slice(0, -1));
  const targetParent = getPresetGroupAtPath(root, parentGroupPath);
  const sourceIndex = sourcePath[sourcePath.length - 1];
  if (
    !sourceParent
    || !targetParent
    || sourceIndex === undefined
    || !Number.isInteger(sourceIndex)
    || sourceIndex < 0
  ) {
    return false;
  }

  const [group] = sourceParent.subGroups.splice(sourceIndex, 1);
  if (!group) return false;

  const rawGroupIndex = Number.isFinite(targetIndex)
    ? Math.trunc(targetIndex)
    : targetParent.subGroups.length;
  const adjustedGroupIndex = sourceParent === targetParent && sourceIndex < rawGroupIndex
    ? rawGroupIndex - 1
    : rawGroupIndex;
  const groupIndex = Math.max(0, Math.min(adjustedGroupIndex, targetParent.subGroups.length));
  targetParent.subGroups.splice(groupIndex, 0, group);
  return true;
}

function createPresetFromSnapshot(snapshot: PresetSnapshot): Preset {
  const preset = new Preset();
  preset.setPresetName(snapshot.name);
  preset.setValuesMap(new Map(Object.entries(snapshot.values ?? {})));
  preset.uniqueId = snapshot.uniqueId;
  return preset;
}

function createPresetGroupFromInsertedSnapshot(
  snapshot: PresetGroupSnapshot,
): PresetGroup {
  const group = new PresetGroup();
  group.setPresetGroupName(snapshot.name);
  group.setCurrentPresetModified(snapshot.currentPresetModified);
  group.presets = snapshot.presets.map(createPresetFromSnapshot);
  group.subGroups = snapshot.subGroups.map(createPresetGroupFromInsertedSnapshot);

  if (snapshot.currentPresetUniqueId && group.findPresetByUniqueId(snapshot.currentPresetUniqueId)) {
    group.setCurrentPresetUniqueId(snapshot.currentPresetUniqueId);
  }
  return group;
}

export function applyBsbInterfacePatch(instrument: BlueSynthBuilder, patch: BsbInterfacePatch): boolean {
  switch (patch.type) {
    case 'setEditEnabled':
      instrument.setBsbEditEnabled(patch.value);
      return true;
    case 'selectWidget':
      return false;
    case 'updateWidgetProperties':
      return instrument.updateWidgetProperties(patch.widgetId, patch.properties);
    case 'updateSliderBankValue':
      return instrument.updateSliderBankValue(patch.widgetId, patch.sliderIndex, patch.value);
    case 'moveWidget':
      return instrument.updateWidgetProperties(patch.widgetId, {
        x: patch.x,
        y: patch.y,
      });
    case 'resizeWidget':
      return instrument.updateWidgetProperties(patch.widgetId, {
        width: patch.width,
        height: patch.height,
      });
    case 'addWidget': {
      const gi = instrument.getGraphicInterface();
      const widget = gi.createWidgetByType(patch.widgetType);
      if (!widget) return false;
      widget.x = patch.x;
      widget.y = patch.y;
      if (patch.parentGroupId) {
        const parent = gi.findWidgetById(patch.parentGroupId);
        if (parent && parent instanceof BSBGroup) {
          parent.addChild(widget);
        } else {
          gi.getRootGroup().addChild(widget);
        }
      } else {
        gi.getRootGroup().addChild(widget);
      }
      instrument.invalidateGraphicInterfaceCache();
      return true;
    }
    case 'removeWidget': {
      const gi2 = instrument.getGraphicInterface();
      const removed = gi2.removeWidget(patch.widgetId);
      if (removed) instrument.invalidateGraphicInterfaceCache();
      return removed;
    }
    case 'updateGridSettings':
      instrument.setBsbGridSettings(patch.patch);
      return true;
    case 'applyPreset': {
      return instrument.applyPreset(patch.presetUniqueId);
    }
    case 'updatePreset': {
      const presetGroup = instrument.getPresetGroup();
      if (!presetGroup) return false;
      const preset = presetGroup.findPresetByUniqueId(patch.presetUniqueId);
      if (!preset) return false;
      preset.updatePresets(instrument.getGraphicInterface());
      presetGroup.setCurrentPresetModified(false);
      return true;
    }
    case 'addPreset': {
      const presetGroup = instrument.getPresetGroup();
      if (!presetGroup) return false;
      const preset = new Preset();
      preset.updatePresets(instrument.getGraphicInterface());
      preset.setPresetName(patch.presetName);
      preset['uniqueId'] = crypto.randomUUID();
      const targetGroup = getPresetGroupAtPath(presetGroup, patch.presetGroupPath ?? []);
      if (!targetGroup) return false;
      targetGroup.presets.push(preset);
      targetGroup.presets.sort((a, b) => a.getPresetName().localeCompare(b.getPresetName()));
      presetGroup.setCurrentPresetUniqueId(preset.getUniqueId());
      presetGroup.setCurrentPresetModified(false);
      return true;
    }
    case 'addPresetGroup': {
      const presetGroup = instrument.getPresetGroup();
      if (!presetGroup) return false;
      const targetGroup = getPresetGroupAtPath(presetGroup, patch.parentGroupPath ?? []);
      if (!targetGroup) return false;
      const newFolder = new PresetGroup();
      newFolder.setPresetGroupName(patch.groupName);
      targetGroup.subGroups.push(newFolder);
      targetGroup.subGroups.sort((a, b) => a.getPresetGroupName().localeCompare(b.getPresetGroupName()));
      return true;
    }
    case 'addPresetFromSnapshot': {
      const presetGroup = instrument.getPresetGroup();
      const targetGroup = presetGroup && getPresetGroupAtPath(presetGroup, patch.parentGroupPath);
      if (!targetGroup) return false;
      targetGroup.presets.push(createPresetFromSnapshot(patch.preset));
      targetGroup.setCurrentPresetModified(false);
      return true;
    }
    case 'addPresetGroupFromSnapshot': {
      const presetGroup = instrument.getPresetGroup();
      const targetGroup = presetGroup && getPresetGroupAtPath(presetGroup, patch.parentGroupPath);
      if (!targetGroup) return false;
      targetGroup.subGroups.push(createPresetGroupFromInsertedSnapshot(patch.group));
      return true;
    }
    case 'renamePreset': {
      const presetGroup = instrument.getPresetGroup();
      const preset = presetGroup?.findPresetByUniqueId(patch.presetUniqueId);
      if (!preset || preset.getPresetName() === patch.name) return false;
      preset.setPresetName(patch.name);
      return true;
    }
    case 'renamePresetGroup': {
      const presetGroup = instrument.getPresetGroup();
      const group = presetGroup && getPresetGroupAtPath(presetGroup, patch.groupPath);
      if (!group || group.getPresetGroupName() === patch.name) return false;
      group.setPresetGroupName(patch.name);
      return true;
    }
    case 'removePreset': {
      const presetGroup = instrument.getPresetGroup();
      const parent = presetGroup && findPresetParentGroup(presetGroup, patch.presetUniqueId);
      if (!parent) return false;
      const index = parent.presets.findIndex(
        (preset) => preset.getUniqueId() === patch.presetUniqueId,
      );
      if (index < 0) return false;
      parent.presets.splice(index, 1);
      if (presetGroup) clearMissingCurrentPreset(presetGroup);
      return true;
    }
    case 'removePresetGroup': {
      const presetGroup = instrument.getPresetGroup();
      return presetGroup ? removePresetGroupAtPath(presetGroup, patch.groupPath) : false;
    }
    case 'movePreset': {
      const presetGroup = instrument.getPresetGroup();
      return presetGroup
        ? movePresetAtPath(
          presetGroup,
          patch.presetUniqueId,
          patch.parentGroupPath,
          patch.targetIndex,
        )
        : false;
    }
    case 'movePresetGroup': {
      const presetGroup = instrument.getPresetGroup();
      return presetGroup
        ? movePresetGroupAtPath(
          presetGroup,
          patch.groupPath,
          patch.parentGroupPath,
          patch.targetIndex,
        )
        : false;
    }
    case 'synchronizePresets': {
      const presetGroup = instrument.getPresetGroup();
      if (!presetGroup) return false;
      presetGroup.synchronizePresets(instrument.getGraphicInterface());
      return true;
    }
    case 'updateEmbeddedOpcodeList':
      instrument.setOpcodeListText(patch.opcodeList);
      return true;
    case 'addUdo': {
      if (!patch.definition) {
        return instrument.addUdo(patch.index, undefined);
      }
      const definition = new OpcodeDefinition();
      definition.setName(patch.definition.name);
      definition.setStyle(UDOStyle[patch.definition.style as keyof typeof UDOStyle]);
      definition.setOutTypes(patch.definition.outTypes);
      definition.setInTypes(patch.definition.inTypes);
      definition.setInputArguments(patch.definition.inputArguments);
      definition.setCode(patch.definition.code);
      definition.setComments(patch.definition.comments);
      return instrument.addUdo(patch.index, definition);
    }
    case 'removeUdo':
      return instrument.removeUdo(patch.index);
    case 'updateUdo': {
      const convertedPatch: Record<string, unknown> = { ...patch.patch };
      if (patch.patch.style !== undefined) {
        convertedPatch.style = UDOStyle[patch.patch.style as keyof typeof UDOStyle];
      }
      return instrument.updateUdo(patch.index, convertedPatch as Parameters<typeof instrument.updateUdo>[1]);
    }
    case 'convertUdoStyle':
      return instrument.convertUdoStyle(
        patch.index,
        UDOStyle[patch.style as keyof typeof UDOStyle],
      );
    case 'reorderUdo':
      return instrument.reorderUdo(patch.from, patch.to);
    case 'randomize':
      instrument.getGraphicInterface().getRootGroup().randomize();
      instrument.invalidateGraphicInterfaceCache();
      return true;
    case 'makeGroup': {
      const gi = instrument.getGraphicInterface();
      const widgetsToGroup: BSBWidget[] = [];
      const collect = (parent: BSBGroup): void => {
        for (const child of parent.getChildren()) {
          if (patch.widgetIds.includes(child.id)) {
            widgetsToGroup.push(child);
            parent.removeChildById(child.id);
          } else if (child instanceof BSBGroup) {
            collect(child as BSBGroup);
          }
        }
      };
      collect(gi.getRootGroup());
      if (widgetsToGroup.length === 0) return false;

      let minX = Infinity, minY = Infinity;
      for (const w of widgetsToGroup) {
        minX = Math.min(minX, w.x);
        minY = Math.min(minY, w.y);
      }

      const group = new BSBGroup();
      group.id = crypto.randomUUID();
      group.x = minX;
      group.y = minY;
      group.groupName = 'Group';

      for (const w of widgetsToGroup) {
        w.x = w.x - minX + 10;
        w.y = w.y - minY + 10;
        group.addChild(w);
      }

      const targetParent = patch.parentGroupId
        ? gi.findWidgetById(patch.parentGroupId)
        : null;
      if (targetParent instanceof BSBGroup) {
        targetParent.addChild(group);
      } else {
        gi.getRootGroup().addChild(group);
      }
      instrument.invalidateGraphicInterfaceCache();
      return true;
    }
    case 'breakGroup': {
      const gi = instrument.getGraphicInterface();
      const group = gi.findWidgetById(patch.widgetId);
      if (!(group instanceof BSBGroup)) return false;

      const findParent = (parent: BSBGroup, targetId: string): BSBGroup | null => {
        for (const child of parent.getChildren()) {
          if (child.id === targetId) return parent;
          if (child instanceof BSBGroup) {
            const found = findParent(child, targetId);
            if (found) return found;
          }
        }
        return null;
      };

      const parentGroup = findParent(gi.getRootGroup(), patch.widgetId) ?? gi.getRootGroup();
      const gx = group.x;
      const gy = group.y;
      const children = group.getChildren();
      for (const child of children) {
        child.x += gx;
        child.y += gy;
        parentGroup.addChild(child);
      }
      group.clearChildren();
      gi.removeWidget(patch.widgetId);
      instrument.invalidateGraphicInterfaceCache();
      return true;
    }
    case 'pasteWidgets': {
      const gi = instrument.getGraphicInterface();
      let parsed: BsbWidgetNodeSnapshot[];
      try {
        parsed = JSON.parse(patch.widgetData);
      } catch { return false; }
      if (!Array.isArray(parsed) || parsed.length === 0) return false;

      const existingNames = new Set<string>();
      const collectNames = (group: BSBGroup): void => {
        for (const child of group.getChildren()) {
          if (child.objectName) {
            existingNames.add(child.objectName);
            for (const dk of getDerivedKeys(child)) existingNames.add(dk);
          }
          if (child instanceof BSBGroup) collectNames(child);
        }
      };
      collectNames(gi.getRootGroup());

      const targetParent = patch.parentGroupId
        ? gi.findWidgetById(patch.parentGroupId)
        : null;
      const parent = targetParent instanceof BSBGroup ? targetParent : gi.getRootGroup();

      for (const node of parsed) {
        ensureUniqueName(node, existingNames);
        const widget = createWidgetFromSnapshot(gi, node);
        if (widget) parent.addChild(widget);
      }
      instrument.invalidateGraphicInterfaceCache();
      return true;
    }
  }
}

export function createWidgetFromSnapshot(gi: any, node: BsbWidgetNodeSnapshot): BSBWidget | null {
  const bsbGi = gi as { createWidgetByType(t: string): BSBWidget | null };
  const widget = bsbGi.createWidgetByType(node.type);
  if (!widget) return null;

  const widgetRecord = widget as unknown as Record<string, unknown>;
  widgetRecord.objectName = node.objectName || '';
  widgetRecord.x = node.x;
  widgetRecord.y = node.y;
  widgetRecord.value = node.value;
  widgetRecord.minimum = node.minimum;
  widgetRecord.maximum = node.maximum;

  const applyFontPatch = (prefix: 'font' | 'labelFont', key: string, val: unknown): void => {
    const existing = widgetRecord[prefix];
    const nextFont: Record<string, unknown> = existing && typeof existing === 'object'
      ? cloneBsbSnapshotValue(existing as Record<string, unknown>)
      : {};
    const field = key.substring(prefix.length + 1);
    if (!field) return;
    nextFont[field] = cloneBsbSnapshotValue(val);
    widgetRecord[prefix] = nextFont;
  };

  const dropdownItems = Array.isArray(node.properties?.dropdownItems)
    ? node.properties!.dropdownItems as Array<Record<string, unknown>>
    : null;
  const lines = Array.isArray(node.properties?.lines)
    ? node.properties!.lines as Array<Record<string, unknown>>
    : null;
  const sliders = Array.isArray(node.properties?.sliders)
    ? node.properties!.sliders as Array<Record<string, unknown>>
    : null;

  for (const [key, val] of Object.entries(node.properties ?? {})) {
    if (key === 'dropdownItems' && dropdownItems) {
      widgetRecord.dropdownItems = dropdownItems.map((item) => ({
        name: typeof item.name === 'string' ? item.name : '',
        value: typeof item.value === 'string' ? item.value : '',
        uniqueId: typeof item.uniqueId === 'string' && item.uniqueId.length > 0
          ? item.uniqueId
          : crypto.randomUUID(),
      }));
      continue;
    }

    if (key === 'lines' && lines) {
      widgetRecord.lines = cloneBsbSnapshotValue(lines);
      continue;
    }

    if (key === 'sliders' && sliders) {
      continue;
    }

    if (key.startsWith('font.')) {
      applyFontPatch('font', key, val);
      continue;
    }

    if (key.startsWith('labelFont.')) {
      applyFontPatch('labelFont', key, val);
      continue;
    }

    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' || val === null) {
      widgetRecord[key] = val;
      continue;
    }

    widgetRecord[key] = cloneBsbSnapshotValue(val);
  }

  if (widget instanceof BSBGroup) {
    widget.width = node.width;
    widget.height = node.height;
    if (node.children) {
      for (const childNode of node.children) {
        const child = createWidgetFromSnapshot(gi, childNode);
        if (child) widget.addChild(child);
      }
    }
    return widget;
  }

  if (widget.constructor.name === 'BSBHSliderBank' || widget.constructor.name === 'BSBVSliderBank') {
    const widgetAny = widget as unknown as Record<string, unknown> & { numberOfSliders?: number };
    const childType = widget.constructor.name === 'BSBHSliderBank' ? 'BSBHSlider' : 'BSBVSlider';
    const nextSliders: BSBWidget[] = [];

    if (node.children && node.children.length > 0) {
      for (const childNode of node.children) {
        const child = createWidgetFromSnapshot(gi, childNode);
        if (child) nextSliders.push(child);
      }
    }

    if (nextSliders.length === 0 && sliders) {
      for (const sliderSnapshot of sliders) {
        const slider = bsbGi.createWidgetByType(childType);
        if (!slider) continue;
        if (typeof sliderSnapshot.value === 'number') {
          slider.setValue(sliderSnapshot.value);
        }
        nextSliders.push(slider);
      }
    }

    if (nextSliders.length > 0) {
      widgetAny.sliders = nextSliders;
    }

    if (typeof widgetAny.numberOfSliders === 'number' && nextSliders.length > 0) {
      widgetAny.numberOfSliders = nextSliders.length;
    }
    return widget;
  }

  if (widget.constructor.name === 'BSBLineObject') {
    widgetRecord.canvasWidth = node.properties?.canvasWidth ?? node.width;
    widgetRecord.canvasHeight = node.properties?.canvasHeight ?? Math.max(40, node.height - BSB_LINE_SELECTOR_HEIGHT);
    if (lines) {
      widgetRecord.lines = cloneBsbSnapshotValue(lines);
    }
    return widget;
  }

  if (widget.constructor.name === 'BSBXYController' || widget.constructor.name === 'BSBGroup') {
    widgetRecord.width = node.width;
    widgetRecord.height = node.height;
  }

  return widget;
}

export function ensureUniqueName(node: BsbWidgetNodeSnapshot, existingNames: Set<string>): void {
  const name = node.objectName;
  if (name && hasCollision(name, node, existingNames)) {
    const prefix = name.replace(/\d+$/, '');
    let i = 1;
    let candidate: string;
    do {
      candidate = `${prefix}${i++}`;
    } while (hasCollision(candidate, node, existingNames));
    node.objectName = candidate;
    existingNames.add(candidate);
    for (const dk of getDerivedKeysForSnapshot(node)) existingNames.add(dk);
  } else if (name) {
    existingNames.add(name);
    for (const dk of getDerivedKeysForSnapshot(node)) existingNames.add(dk);
  }
  if (node.children) {
    for (const child of node.children) ensureUniqueName(child, existingNames);
  }
}

function hasCollision(candidate: string, node: BsbWidgetNodeSnapshot, existingNames: Set<string>): boolean {
  if (existingNames.has(candidate)) return true;
  const origName = node.objectName;
  node.objectName = candidate;
  const derived = getDerivedKeysForSnapshot(node);
  node.objectName = origName;
  for (const dk of derived) {
    if (existingNames.has(dk)) return true;
  }
  return false;
}

function getDerivedKeysForSnapshot(node: BsbWidgetNodeSnapshot): string[] {
  return getDerivedKeysFromSnapshot(node);
}

export function getDerivedKeys(widget: BSBWidget): string[] {
  return getDerivedKeysFromWidget(widget);
}



export function snapshotToUdo(snapshot: UdoDefinitionSnapshot): OpcodeDefinition {
  const udo = new OpcodeDefinition();
  udo.setName(snapshot.name);
  udo.setStyle(snapshot.style as UDOStyle);
  udo.setOutTypes(snapshot.outTypes);
  udo.setInTypes(snapshot.inTypes);
  udo.setInputArguments(snapshot.inputArguments);
  udo.setCode(snapshot.code);
  udo.setComments(snapshot.comments);
  return udo;
}
