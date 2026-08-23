import { Element } from "../serialization/xml-reader";
import { ObjRefSaveMap, ObjRefLoadMap } from "../serialization/obj-ref-map";
import { UpgradeManager } from "../migration/upgrade-manager";
import { BLUE_VERSION } from "../blue-constants";
import { Arrangement } from "../arrangement";
import { ProjectProperties } from "../project-properties";
import { SoundObjectLibrary } from "../sound-objects/sound-object-library";
import { GlobalOrcSco } from "../global-orc-sco";
import { Tables } from "../tables";
import { LiveData } from "../live-data";
import { Score } from "../score/score";
import { ScratchPadData } from "../scratch-pad-data";
import { NoteProcessorChainMap } from "../note-processors/note-processor-chain-map";
import { MarkersList } from "../markers-list";
import { MidiInputProcessor } from "../midi/midi-input-processor";
import { InstrumentLibrary } from "../instruments/instrument-library";
import { Mixer } from "../mixer/mixer";
import { OpcodeList } from "../opcodes/opcode-list";
import { parseUDOText } from "../opcodes/udo-utilities";
import { TimeContext } from "../time/time-context";
import type { BlueData } from "../blue-data";

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

export function loadFromString(xmlString: string, createBlueData: () => BlueData): BlueData {
const rootElement = Element.parse(xmlString);

if (rootElement.getName() !== "blueData") {
  throw new Error(
    `Expected root element "blueData", got "${rootElement.getName()}"`,
  );
}

// Apply migrations
UpgradeManager.getInstance().performUpgrades(rootElement);

const objRefMap = new ObjRefLoadMap();
const blueData = createBlueData();
    const state = blueData as unknown as BlueDataXmlState;

const versionAttr = rootElement.getAttribute("version");
if (versionAttr) blueData.setVersion(versionAttr);

// Java loads instrumentLibrary and arrangement nodes first (deferred),
// then processes other root elements, then wires arrangement with
// instrumentLibrary after the loop.
let instrumentLibraryNode: Element | null = null;
let arrangementNode: Element | null = null;
let mixerLoaded = false;

const nodes = rootElement.getElements();
while (nodes.hasMoreElements()) {
  const node = nodes.next();
  const nodeName = node.getName();

  switch (nodeName) {
    case "projectProperties":
      state.projectProperties = ProjectProperties.loadFromXML(node);
      break;
    case "instrumentLibrary":
      // Store for deferred processing — arrangement needs it
      instrumentLibraryNode = node;
      break;
    case "arrangement":
      // Store for deferred processing — needs instrumentLibrary
      arrangementNode = node;
      break;
    case "mixer":
      state.mixer = Mixer.loadFromXML(node);
      mixerLoaded = true;
      break;
    case "tables":
      state.tableSet = Tables.loadFromXML(node);
      break;
    case "soundObjectLibrary":
      state.sObjLib = SoundObjectLibrary.loadFromXML(node, objRefMap);
      break;
    case "globalOrcSco":
      state.globalOrcSco = GlobalOrcSco.loadFromXML(node);
      break;
    case "udo":
      // Legacy root UDO text → parse into OpcodeList
      {
        const udoText = node.getTextString();
        if (udoText) {
          state.opcodeList = parseUDOText(udoText);
        }
      }
      break;
    case "opcodeList":
      state.opcodeList = OpcodeList.loadFromXML(node);
      break;
    case "liveData":
      state.liveData = LiveData.loadFromXML(node, objRefMap);
      break;
    case "score":
      state.score = Score.loadFromXML(node, objRefMap);
      break;
    case "scratchPadData":
      state.scratchData = ScratchPadData.loadFromXML(node);
      break;
    case "noteProcessorChainMap":
      state.noteProcessorChainMap =
        NoteProcessorChainMap.loadFromXML(node);
      break;
    case "renderStartTime":
      state.renderStartTime = parseFloat(node.getTextString());
      break;
    case "renderEndTime":
      state.renderEndTime = parseFloat(node.getTextString());
      break;
    case "markersList":
      state.markersList = MarkersList.loadFromXML(node);
      break;
    case "loopRendering":
      state.loopRendering =
        node.getTextString().toLowerCase() === "true";
      break;
    case "midiInputProcessor":
      state.midiInputProcessor = MidiInputProcessor.loadFromXML(node);
      break;
    case "timeContext":
      // Legacy root timeContext → migrate into score
      state.score.setTimeContext(TimeContext.loadFromXML(node));
      break;
    case "pluginData":
      // Preserve plugin data children opaquely
      state.pluginDataXml = [];
      const pluginChildren = node.getElements();
      while (pluginChildren.hasMoreElements()) {
        state.pluginDataXml.push(pluginChildren.next());
      }
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
    state.arrangement = Arrangement.loadFromXML(arrangementNode);
  }
} else if (instrumentLibraryNode) {
  // Store instrumentLibrary even without arrangement
  state.instrumentLibrary = InstrumentLibrary.loadFromXML(instrumentLibraryNode);
}

// Post-loop: if no mixer element was present, disable mixer (Java parity)
if (!mixerLoaded) {
  state.mixer.setEnabled(false);
}

// Post-loop: wire projectProperties into score.timeContext (Java parity)
state.score.getTimeContext().setSampleRate(
  parseInt(state.projectProperties.sampleRate, 10) || 44100
);

return blueData;
}

export function saveAsXML(blueData: BlueData, objRefMap?: ObjRefSaveMap): Element {
const state = blueData as unknown as BlueDataXmlState;
state.version = BLUE_VERSION;
const root = new Element("blueData");
root.setAttribute("version", state.version);

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
root.addElement("renderStartTime").setText(state.renderStartTime.toString());
root.addElement("renderEndTime").setText(state.renderEndTime.toString());
root.addElement(state.markersList.saveAsXML());
root.addElement("loopRendering").setText(state.loopRendering.toString());
root.addElement(state.midiInputProcessor.saveAsXML());

// Preserve pluginData children
const pluginDataElem = root.addElement("pluginData");
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
