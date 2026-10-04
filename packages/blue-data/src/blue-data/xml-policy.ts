import { Element } from '../serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { UpgradeManager } from '../migration/upgrade-manager';
import { BLUE_VERSION } from '../blue-constants';
import { Arrangement } from '../arrangement';
import { ProjectProperties } from '../project-properties';
import { SoundObjectLibrary } from '../sound-objects/sound-object-library';
import { GlobalOrcSco } from '../global-orc-sco';
import { Tables } from '../tables';
import { LiveData } from '../live-data';
import { Score } from '../score/score';
import { ScratchPadData } from '../scratch-pad-data';
import { NoteProcessorChainMap } from '../note-processors/note-processor-chain-map';
import { MarkersList } from '../markers-list';
import { ClojureProjectData } from '../plugins/clojure-project-data';
import { MidiInputProcessor } from '../midi/midi-input-processor';
import { InstrumentLibrary } from '../instruments/instrument-library';
import {
  Mixer,
  DEFAULT_LEGACY_METER_ENABLED,
  DEFAULT_LEGACY_METER_PROFILE_KEY,
} from '../mixer/mixer';
import { OpcodeList } from '../opcodes/opcode-list';
import { parseUDODeclaration } from '../opcodes/udo-utilities';
import { TimeContext } from '../time/time-context';
import { BlueData } from '../blue-data';
import { loadXml, requireXmlValue, XmlLoadContext } from '../serialization/xml-load';
import type { XmlSource, XmlDiagnosticSink, XmlLoadResult } from '../serialization/xml-load';
import { checkShape, readDouble, readBoolean, readText } from '../utilities/xml';

const PROJECT_CHILDREN = [
  'projectProperties',
  'arrangement',
  'mixer',
  'tables',
  'soundObjectLibrary',
  'globalOrcSco',
  'opcodeList',
  'liveData',
  'score',
  'scratchPadData',
  'noteProcessorChainMap',
  'renderStartTime',
  'renderEndTime',
  'markersList',
  'loopRendering',
  'midiInputProcessor',
  'pluginData',
  'instrumentLibrary',
  'udo',
  'soundObject',
  'tempo',
  'timeContext',
] as const;

const CANONICAL_PROJECT_CHILDREN = PROJECT_CHILDREN.filter(
  (name) => name !== 'soundObject' && name !== 'tempo' && name !== 'timeContext',
);

export function readProjectXml(
  xml: string,
  source: XmlSource = { kind: 'project', label: 'in-memory project' },
): XmlLoadResult<BlueData> {
  return loadXml(xml, source, (root, context) =>
    loadProjectRoot(root, () => new BlueData(), context),
  );
}

/**
 * Load provenance for the Spec 111 compatibility notice: only projects whose
 * ACTIVE channel mute/non-master solo flags (or master mute) came from the loaded document
 * (not from live edits afterwards) surface the legacy-mixer-state notice.
 * Disposable, process-local, never serialized.
 */
const LEGACY_MIXER_STATE_AT_LOAD = new WeakMap<object, true>();

export function markLegacyMixerStateAtLoad(data: BlueData): void {
  LEGACY_MIXER_STATE_AT_LOAD.set(data, true);
}

export function hasLegacyMixerStateAtLoad(data: BlueData): boolean {
  return LEGACY_MIXER_STATE_AT_LOAD.has(data);
}

type BlueDataXmlState = {
  projectProperties: ProjectProperties;
  instrumentLibrary: InstrumentLibrary | null;
  arrangement: Arrangement;
  mixer: Mixer;
  tableSet: Tables;
  sObjLib: SoundObjectLibrary;
  globalOrcSco: GlobalOrcSco;
  opcodeList: OpcodeList;
  liveData: LiveData;
  score: Score;
  scratchData: ScratchPadData;
  noteProcessorChainMap: NoteProcessorChainMap;
  renderStartTime: number;
  renderEndTime: number;
  markersList: MarkersList;
  loopRendering: boolean;
  midiInputProcessor: MidiInputProcessor;
  pluginDataXml: Element[];
  version: string;
};

export function loadFromString(
  xmlString: string,
  createBlueData: () => BlueData,
  sink?: XmlDiagnosticSink,
): BlueData {
  return requireXmlValue(
    loadXml(xmlString, { kind: 'project', label: 'in-memory project' }, (root, context) =>
      loadProjectRoot(root, createBlueData, context),
    ),
    sink,
  );
}

function loadProjectRoot(
  rootElement: Element,
  createBlueData: () => BlueData,
  context: XmlLoadContext,
): BlueData {
  if (rootElement.getName() !== 'blueData') {
    throw context.error({
      code: 'root',
      member: rootElement.getName(),
      message: `Expected root element "blueData", got "${rootElement.getName()}".`,
      recovery: 'Open this XML through its matching resource loader.',
    });
  }

  checkShape(rootElement, ['version'], PROJECT_CHILDREN, context);
  const version = rootElement.getAttribute('version');
  if (version !== null && !/^\d+(?:\.\d+){0,2}(?:_beta\d*)?$/.test(version))
    throw context.error({
      code: 'value',
      member: '@version',
      value: version,
      message: 'Invalid project version syntax.',
      recovery: 'Supply a supported numeric project version, optionally with a beta suffix.',
    });

  // Apply migrations
  UpgradeManager.getInstance().performUpgrades(rootElement, context);
  checkShape(rootElement, ['version'], CANONICAL_PROJECT_CHILDREN, context);

  const objRefMap = new ObjRefLoadMap();
  const blueData = createBlueData();
  const state = blueData as unknown as BlueDataXmlState;
  const objectLibrary = rootElement.getElement('soundObjectLibrary');
  if (objectLibrary)
    state.sObjLib = SoundObjectLibrary.loadFromXML(objectLibrary, objRefMap, context);

  const opcodeNode = rootElement.getElement('opcodeList');
  const currentOpcodes = opcodeNode ? OpcodeList.loadFromXML(opcodeNode, context) : null;

  const versionAttr = rootElement.getAttribute('version');
  if (versionAttr) blueData.setVersion(versionAttr);

  // Java loads instrumentLibrary and arrangement nodes first (deferred),
  // then processes other root elements, then wires arrangement with
  // instrumentLibrary after the loop.
  let instrumentLibraryNode: Element | null = null;
  let arrangementNode: Element | null = null;
  let mixerLoaded = false;
  let scoreLoaded = false;
  let scoreModePresentAtLoad = false;

  const nodes = rootElement.getElements();
  while (nodes.hasMoreElements()) {
    const node = nodes.next();
    const nodeName = node.getName();

    switch (nodeName) {
      case 'projectProperties':
        state.projectProperties = ProjectProperties.loadFromXML(node, context);
        break;
      case 'instrumentLibrary':
        // Store for deferred processing — arrangement needs it
        instrumentLibraryNode = node;
        break;
      case 'arrangement':
        // Store for deferred processing — needs instrumentLibrary
        arrangementNode = node;
        break;
      case 'mixer':
        state.mixer = Mixer.loadFromXML(node, context);
        mixerLoaded = true;

        break;
      case 'tables':
        state.tableSet = Tables.loadFromXML(node, context);
        break;
      case 'soundObjectLibrary':
        // Preloaded before the remaining graph, independent of root sibling order.
        break;
      case 'globalOrcSco':
        state.globalOrcSco = GlobalOrcSco.loadFromXML(node, context);
        break;
      case 'udo':
        // Legacy root UDO text → parse into OpcodeList
        {
          const udoText = readText(node, context);
          {
            const legacy = readLegacyProjectOpcodes(udoText, node, context);
            if (currentOpcodes) {
              if (legacy.saveAsXML().toXml() !== currentOpcodes.saveAsXML().toXml())
                throw context.at(node).error({
                  code: 'conflict',
                  member: 'udo',
                  message: 'Legacy UDO text conflicts with opcodeList.',
                  recovery: 'Keep one equivalent UDO representation.',
                });
            }
            state.opcodeList = legacy;
          }
        }
        break;
      case 'opcodeList':
        state.opcodeList = currentOpcodes!;
        break;
      case 'liveData':
        state.liveData = LiveData.loadFromXML(node, objRefMap, context);
        break;
      case 'score':
        scoreModePresentAtLoad = node.getAttribute('trackLayerMuteSoloMode') !== null;
        state.score = Score.loadFromXML(node, objRefMap, context);
        scoreLoaded = true;
        break;
      case 'scratchPadData':
        state.scratchData = ScratchPadData.loadFromXML(node, context);
        break;
      case 'noteProcessorChainMap':
        state.noteProcessorChainMap = NoteProcessorChainMap.loadFromXML(node, context);
        break;
      case 'renderStartTime':
        state.renderStartTime = readDouble(node, context);
        if (state.renderStartTime < 0)
          throw context.at(node).error({
            code: 'value',
            value: node.getTextString(),
            message: 'Render start must be nonnegative.',
            recovery: 'Supply a nonnegative render start.',
          });
        break;
      case 'renderEndTime':
        state.renderEndTime = readDouble(node, context);
        if (state.renderEndTime < 0 && state.renderEndTime !== -1)
          throw context.at(node).error({
            code: 'value',
            value: node.getTextString(),
            message: 'Render end must be nonnegative or -1.',
            recovery: 'Supply a valid render end.',
          });
        break;
      case 'markersList':
        state.markersList = MarkersList.loadFromXML(node, context);
        break;
      case 'loopRendering':
        state.loopRendering = readBoolean(node, context);
        break;
      case 'midiInputProcessor':
        state.midiInputProcessor = MidiInputProcessor.loadFromXML(node, context);
        break;
      case 'timeContext':
        // Legacy root timeContext → migrate into score
        state.score.setTimeContext(TimeContext.loadFromXML(node));
        break;
      case 'pluginData':
        checkShape(node, [], ['blueDataObject'], context);
        state.pluginDataXml = [...node.getElements('blueDataObject')].map((child) =>
          ClojureProjectData.loadFromXML(child, context).saveAsXML(),
        );
        break;
    }
  }

  // Post-loop: wire arrangement with instrumentLibrary (Java parity)
  if (arrangementNode) {
    if (instrumentLibraryNode) {
      const lib = InstrumentLibrary.loadFromXML(instrumentLibraryNode);
      state.instrumentLibrary = lib;
      state.arrangement = Arrangement.loadFromXMLWithLibrary(arrangementNode, lib);
    } else {
      state.arrangement = Arrangement.loadFromXML(arrangementNode, context);
    }
  } else if (instrumentLibraryNode) {
    // Store instrumentLibrary even without arrangement
    state.instrumentLibrary = InstrumentLibrary.loadFromXML(instrumentLibraryNode);
  }

  // Post-loop: if no mixer element was present, disable mixer and apply legacy meter defaults
  if (!mixerLoaded) {
    state.mixer.setEnabled(false);
    state.mixer.setPanningEnabled(false);
    state.mixer.setEnableMeters(DEFAULT_LEGACY_METER_ENABLED);
    state.mixer.setMeterProfileKey(DEFAULT_LEGACY_METER_PROFILE_KEY);
  }

  // A legacy document without a Score retains Event header behavior and disabled panning.
  if (!scoreLoaded) {
    state.score.trackLayerMuteSoloMode = 'event';
  }

  // Post-loop (Spec 111 FR-015): record whether the loaded document carries
  // active channel mute/non-master solo flags so the compatibility notice
  // reflects load provenance rather than later live edits. Only a document
  // from before the feature (mode property omitted) is "legacy": one that
  // explicitly persists the mode already knew its flags were audible.
  const mixerChannels = [...state.mixer.getAllSourceChannels(), ...state.mixer.getSubChannels()];
  if (
    !scoreModePresentAtLoad &&
    (mixerChannels.some((channel) => channel.isMuted() || channel.isSolo()) ||
      state.mixer.getMaster().isMuted())
  ) {
    markLegacyMixerStateAtLoad(blueData);
  }

  // Post-loop: wire projectProperties into score.timeContext (Java parity)
  state.score
    .getTimeContext()
    .setSampleRate(parseInt(state.projectProperties.sampleRate, 10) || 44100);

  if (state.renderEndTime !== -1 && state.renderEndTime < state.renderStartTime)
    throw context.at(rootElement.getElement('renderEndTime') ?? rootElement).error({
      code: 'conflict',
      message: 'Render end precedes render start.',
      recovery: 'Choose an ordered render range.',
    });
  return blueData;
}

export function saveAsXML(blueData: BlueData, objRefMap?: ObjRefSaveMap): Element {
  const state = blueData as unknown as BlueDataXmlState;
  const root = new Element('blueData');
  root.setAttribute('version', BLUE_VERSION);

  // Java-compatible root section ordering
  root.addElement(state.projectProperties.saveAsXML(objRefMap));
  root.addElement(state.arrangement.saveAsXML());
  root.addElement(state.mixer.saveAsXML());
  root.addElement(state.tableSet.saveAsXML());
  root.addElement(state.sObjLib.saveAsXML(objRefMap));
  root.addElement(state.globalOrcSco.saveAsXML());
  root.addElement(state.opcodeList.saveAsXML());
  root.addElement(state.liveData.saveAsXML(objRefMap));
  root.addElement(state.score.saveAsXML(objRefMap));
  root.addElement(state.scratchData.saveAsXML());
  root.addElement(state.noteProcessorChainMap.saveAsXML());
  root.addElement('renderStartTime').setText(state.renderStartTime.toString());
  root.addElement('renderEndTime').setText(state.renderEndTime.toString());
  root.addElement(state.markersList.saveAsXML());
  root.addElement('loopRendering').setText(state.loopRendering.toString());
  root.addElement(state.midiInputProcessor.saveAsXML());

  // Preserve pluginData children
  const pluginDataElem = root.addElement('pluginData');
  for (const pd of state.pluginDataXml) {
    pluginDataElem.addElement(pd.clone());
  }

  return root;
}

export function saveToString(blueData: BlueData): string {
  const objRefMap = new ObjRefSaveMap();
  const root = saveAsXML(blueData, objRefMap);
  return root.toXml();
}

/** Legacy text must form complete definitions; conversion cannot erase orphan code. */
function readLegacyProjectOpcodes(
  text: string,
  source: Element,
  context: XmlLoadContext,
): OpcodeList {
  const result = new OpcodeList();
  const lines = text.match(/[^\n]*(?:\n|$)/g)?.filter((line) => line.length > 0) ?? [];
  const reject = () =>
    context.at(source).error({
      code: 'value',
      member: 'udo',
      message: 'Legacy UDO text must contain complete opcode definitions without orphan text.',
      recovery:
        'Repair the definitions or move unrelated code to GlobalOrcSco; the source remains unchanged.',
    });
  let index = 0;
  while (index < lines.length) {
    if (!lines[index].trim()) {
      index++;
      continue;
    }
    let declaration = lines[index++];
    if (!declaration.trimStart().startsWith('opcode ')) throw reject();
    let opcode = parseUDODeclaration(declaration);
    while (!opcode && index < lines.length && !lines[index].trimStart().startsWith('endop')) {
      declaration += lines[index++];
      opcode = parseUDODeclaration(declaration);
    }
    if (!opcode) throw reject();
    let body = '';
    while (index < lines.length && lines[index].trim() !== 'endop') {
      if (/^\s*(?:opcode|endop)\b/.test(lines[index])) throw reject();
      body += lines[index++];
    }
    if (index === lines.length) throw reject();
    index++;
    opcode.setCode(body);
    result.addOpcode(opcode);
  }
  return result;
}
