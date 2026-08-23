/**
 * BlueData — the root data class for a Blue project.
 * Mirrors the Java BlueData class.
 *
 * BlueData aggregates all project data: arrangement, mixer, project properties,
 * sound object library, score, tables, global orc/sco, opcodes, live data,
 * markers, MIDI input, scratch pad data, and plugin data.
 *
 * Loading/saving is done via XML strings compatible with the Java .blue file format.
 */
import { Element } from "./serialization/xml-reader";
import { ObjRefSaveMap, ObjRefLoadMap } from "./serialization/obj-ref-map";
import { UpgradeManager } from "./migration/upgrade-manager";
import { BLUE_VERSION } from "./blue-constants";
import { Arrangement } from "./arrangement";
import { ProjectProperties } from "./project-properties";
import { SoundObjectLibrary } from "./sound-objects/sound-object-library";
import { GlobalOrcSco } from "./global-orc-sco";
import { Tables } from "./tables";
import { LiveData } from "./live-data";
import { Score } from "./score/score";
import { ScratchPadData } from "./scratch-pad-data";
import { NoteProcessorChainMap } from "./note-processors/note-processor-chain-map";
import { MarkersList } from "./markers-list";
import { MidiInputProcessor } from "./midi/midi-input-processor";
import { InstrumentLibrary } from "./instruments/instrument-library";
import { Instrument } from "./instruments/instrument";
import { GenericInstrument } from "./instruments/generic-instrument";
import { CompileData } from "./compile-data";
import type { CompiledMidiInstrumentTarget } from "./compile-data";
import { BlueDataObject } from "./blue-data-object";
import { NoteList } from "./sound-objects/note-list";
import { Note } from "./sound-objects/note";
import { Mixer } from "./mixer/mixer";
import { OpcodeList } from "./opcodes/opcode-list";
import { OpcodeDefinition } from "./opcodes/opcode-definition";
import {
  getAllParameters,
  assignParameterNames,
} from "./automation/parameter-helper";
import { Parameter } from "./automation/parameter";
import {
  appendParameterScoreJava,
  getParameterInstrumentTextJava,
} from './automation/csd-parameter-automation';
import { BSBCompilationUnit } from "./instruments/blue-synth-builder/bsb-compilation-unit";
import { Effect } from "./mixer/effect";
import { EffectsChain } from "./mixer/effects-chain";
import { Channel } from "./mixer/channel";
import { Send } from "./mixer/send";
import { UDOStyle } from "./opcodes/udo-style";
import { formatBlueNumber, formatJavaDouble } from "./utilities/number-format";
import { disposeJavaScriptCompileState, setJavaScriptSession } from './javascript-runtime';
import type { JavaScriptSession } from './javascript-runtime';
import { setJavaRuntimeClient, type JavaRuntimeClientContract } from './java-runtime';
import {
  ClojureProjectData,
  loadClojureProjectDataFromPluginData,
  replaceClojureProjectDataInPluginData,
} from './plugins/clojure-project-data';
import { parseUDOText } from "./opcodes/udo-utilities";
import { TimeContext } from "./time/time-context";
import { TempoMap } from "./time/tempo-map";
import { ClojureObject } from './sound-objects/clojure-object';
import { Instance } from './sound-objects/instance';
import { JavaScriptObject } from './sound-objects/javascript-object';
import { ObjectBuilder } from './sound-objects/object-builder';
import { PolyObject } from './sound-objects/poly-object';
import { TrackLayerGroup } from './score/track/track-layer-group';
import { PythonObject } from './sound-objects/python-object';
import type { SoundObject } from './sound-objects/sound-object';
import { PythonInstrument } from './instruments/python-instrument';
import { PythonProcessor } from './note-processors/python-processor';
import type { NoteProcessorChain } from './note-processors/note-processor-chain';
import {
  processCommandBlocks,
  preprocessSco,
  getTempoScore,
  getTempoMapFromScoreText,
} from "./utilities/csd-render";
import { getNotes } from "./utilities/score";
import "./sound-objects/register-sound-object-types";

import { loadFromString, saveAsXML, saveToString } from "./blue-data/xml-policy";
import {
  buildStandardCSD,
  buildStandardCSDAsync,
  buildScoreText,
  toBlueLiveCSD,
} from "./blue-data/csd-policy";
import type { RenderCsdResult } from "./blue-data/csd-policy";
import {
  processOnLoad,
  processOnLoadAsync,
  usesJavaRuntime,
} from "./blue-data/runtime-policy";


export class BlueData implements BlueDataObject {
  // Version
  private version = BLUE_VERSION;

  // Core data
  private arrangement = new Arrangement();
  private projectProperties = new ProjectProperties();
  private sObjLib = new SoundObjectLibrary();
  private instrumentLibrary: InstrumentLibrary | null = null;
  private globalOrcSco = new GlobalOrcSco();
  private tableSet = new Tables();
  private score = new Score();
  private liveData = new LiveData();
  private scratchData = new ScratchPadData();
  private noteProcessorChainMap = new NoteProcessorChainMap();
  private markersList = new MarkersList();
  private midiInputProcessor = new MidiInputProcessor();
  private mixer = new Mixer();
  private opcodeList = new OpcodeList();

  // Render settings
  private renderStartTime = 0;
  private renderEndTime = -1;
  private loopRendering = false;

  // Plugin data (preserved opaquely for round-trip)
  private pluginDataXml: Element[] = [];

  constructor() {
    // Wire projectProperties into score.timeContext (Java parity)
    this.score.getTimeContext().setSampleRate(
      parseInt(this.projectProperties.sampleRate, 10) || 44100
    );
  }

  // ─── Accessors ───

  getVersion(): string {
    return this.version;
  }
  setVersion(v: string): void {
    this.version = v;
  }

  getArrangement(): Arrangement {
    return this.arrangement;
  }
  setArrangement(a: Arrangement): void {
    this.arrangement = a;
  }

  getProjectProperties(): ProjectProperties {
    return this.projectProperties;
  }
  setProjectProperties(p: ProjectProperties): void {
    this.projectProperties = p;
  }

  getSoundObjectLibrary(): SoundObjectLibrary {
    return this.sObjLib;
  }
  setSoundObjectLibrary(s: SoundObjectLibrary): void {
    this.sObjLib = s;
  }

  getGlobalOrcSco(): GlobalOrcSco {
    return this.globalOrcSco;
  }
  setGlobalOrcSco(g: GlobalOrcSco): void {
    this.globalOrcSco = g;
  }

  getTableSet(): Tables {
    return this.tableSet;
  }
  setTableSet(t: Tables): void {
    this.tableSet = t;
  }

  getScore(): Score {
    return this.score;
  }
  setScore(s: Score): void {
    this.score = s;
  }

  getLiveData(): LiveData {
    return this.liveData;
  }
  setLiveData(l: LiveData): void {
    this.liveData = l;
  }

  getScratchPadData(): ScratchPadData {
    return this.scratchData;
  }
  setScratchPadData(s: ScratchPadData): void {
    this.scratchData = s;
  }

  getNoteProcessorChainMap(): NoteProcessorChainMap {
    return this.noteProcessorChainMap;
  }
  setNoteProcessorChainMap(n: NoteProcessorChainMap): void {
    this.noteProcessorChainMap = n;
  }

  getMarkersList(): MarkersList {
    return this.markersList;
  }
  setMarkersList(m: MarkersList): void {
    this.markersList = m;
  }

  getMidiInputProcessor(): MidiInputProcessor {
    return this.midiInputProcessor;
  }
  setMidiInputProcessor(m: MidiInputProcessor): void {
    this.midiInputProcessor = m;
  }

  getMixer(): Mixer {
    return this.mixer;
  }
  setMixer(m: Mixer): void {
    this.mixer = m;
  }

  getOpcodeList(): OpcodeList {
    return this.opcodeList;
  }
  setOpcodeList(o: OpcodeList): void {
    this.opcodeList = o;
  }

  getRenderStartTime(): number {
    return this.renderStartTime;
  }
  setRenderStartTime(t: number): void {
    this.renderStartTime = t;
    if (this.renderStartTime >= this.renderEndTime) {
      this.renderEndTime = -1;
    }
  }

  getRenderEndTime(): number {
    return this.renderEndTime;
  }
  setRenderEndTime(t: number): void {
    this.renderEndTime = t <= this.renderStartTime ? -1 : t;
  }

  isLoopRendering(): boolean {
    return this.loopRendering;
  }
  setLoopRendering(l: boolean): void {
    this.loopRendering = l;
  }

  getInstrumentLibrary(): InstrumentLibrary | null {
    return this.instrumentLibrary;
  }
  setInstrumentLibrary(l: InstrumentLibrary | null): void {
    this.instrumentLibrary = l;
  }

  getPluginDataXml(): Element[] {
    return this.pluginDataXml;
  }

  getClojureProjectData(): ClojureProjectData | null {
    return loadClojureProjectDataFromPluginData(this.pluginDataXml);
  }

  setClojureProjectData(projectData: ClojureProjectData | null): void {
    this.pluginDataXml = replaceClojureProjectDataInPluginData(
      this.pluginDataXml,
      projectData,
    );
  }

  // ─── Loading ───


  static loadFromString(xmlString: string): BlueData {
    return loadFromString(xmlString, () => new BlueData());
  }

  // ─── Saving ───

  saveAsXML(objRefMap?: ObjRefSaveMap): Element {
    return saveAsXML(this, objRefMap);
  }

  saveToString(): string {
    return saveToString(this);
  }

  // ─── CSD Generation ───

  toCSD(session?: JavaScriptSession): string {
    return buildStandardCSD(this, "realtime", session).csdText;
  }

  async toCSDAsync(
    session?: JavaScriptSession,
    runtimeClient?: JavaRuntimeClientContract | null,
  ): Promise<string> {
    return (await buildStandardCSDAsync(this, "realtime", session, runtimeClient)).csdText;
  }

  toDiskCSD(session?: JavaScriptSession): string {
    return buildStandardCSD(this, "disk", session).csdText;
  }

  async toDiskCSDAsync(
    session?: JavaScriptSession,
    runtimeClient?: JavaRuntimeClientContract | null,
  ): Promise<string> {
    return (await buildStandardCSDAsync(this, "disk", session, runtimeClient)).csdText;
  }

  toRealtimePlaybackCSD(session?: JavaScriptSession): RenderCsdResult {
    return buildStandardCSD(this, "realtime", session);
  }

  async toRealtimePlaybackCSDAsync(
    session?: JavaScriptSession,
    runtimeClient?: JavaRuntimeClientContract | null,
  ): Promise<RenderCsdResult> {
    return buildStandardCSDAsync(this, "realtime", session, runtimeClient);
  }

  toBlueLiveCSD(session?: JavaScriptSession): RenderCsdResult {
    return toBlueLiveCSD(this, session);
  }

  processOnLoad(session?: JavaScriptSession): void {
    processOnLoad(this, session);
  }

  async processOnLoadAsync(
    session?: JavaScriptSession,
    runtimeClient?: JavaRuntimeClientContract | null,
  ): Promise<void> {
    await processOnLoadAsync(this, session, runtimeClient);
  }

  usesJavaRuntime(): boolean {
    return usesJavaRuntime(this);
  }

  private buildScoreText(
    ftables: string,
    globalSco: string,
    notes: NoteList,
  ): string {
    return buildScoreText(this, ftables, globalSco, notes);
  }

  // ─── DeepCopy ───

  deepCopy(): BlueDataObject {
    const copy = new BlueData();
    copy.version = this.version;
    copy.arrangement = new Arrangement(this.arrangement);
    copy.projectProperties = new ProjectProperties(this.projectProperties);

    // Deep-copy the SoundObject library and seed an original→copy map so that
    // copied Instance references can be remapped to copied library objects.
    const originalLibraryObjects = this.sObjLib.getAllObjects();
    copy.sObjLib = new SoundObjectLibrary(this.sObjLib);
    const copiedLibraryObjects = copy.sObjLib.getAllObjects();
    const libraryRemap = new Map<SoundObject, SoundObject>();
    for (let i = 0; i < originalLibraryObjects.length; i++) {
      libraryRemap.set(originalLibraryObjects[i]!, copiedLibraryObjects[i]!);
    }

    // Deep-copy instrument library (was previously aliased by reference).
    copy.instrumentLibrary = this.instrumentLibrary
      ? this.instrumentLibrary.deepCopy()
      : null;

    copy.globalOrcSco = new GlobalOrcSco(this.globalOrcSco);
    copy.tableSet = new Tables(this.tableSet);
    copy.score = new Score(this.score);

    // Deep-copy Live Data (was previously aliased by reference).
    copy.liveData = this.liveData.deepCopy() as LiveData;

    copy.scratchData = new ScratchPadData(this.scratchData);
    copy.noteProcessorChainMap = new NoteProcessorChainMap(this.noteProcessorChainMap);
    copy.markersList = new MarkersList(this.markersList);
    copy.midiInputProcessor = new MidiInputProcessor(this.midiInputProcessor);
    copy.mixer = this.mixer.deepCopy() as Mixer;

    // Deep-copy opcode definitions (was previously aliased by reference).
    copy.opcodeList = new OpcodeList(this.opcodeList);

    copy.renderStartTime = this.renderStartTime;
    copy.renderEndTime = this.renderEndTime;
    copy.loopRendering = this.loopRendering;
    copy.pluginDataXml = this.pluginDataXml.map(e => e.clone());

    // Remap any copied Instance that still references an original library
    // object to point at the corresponding copied library object. This keeps
    // whole-project copies internally coherent without retaining references
    // into the canonical graph.
    if (libraryRemap.size > 0) {
      const seen = new Set<SoundObject>();
      for (const soundObject of copy.sObjLib.getAllObjects()) {
        remapInstanceReferencesInSoundObject(soundObject, libraryRemap, seen);
      }
      remapInstanceReferences(copy.score, libraryRemap, seen);
      remapInstanceReferencesInLiveData(copy.liveData, libraryRemap, seen);
    }

    // Wire projectProperties into score.timeContext (Java parity)
    copy.score.getTimeContext().setSampleRate(
      parseInt(copy.projectProperties.sampleRate, 10) || 44100
    );

    return copy;
  }
}

/**
 * Remap Instance references across the Score graph. Traverses each PolyObject
 * layer and replaces any Instance whose referenced SoundObject is an original
 * library object with the corresponding copied library object.
 */
function remapInstanceReferences(
  score: Score,
  libraryRemap: Map<SoundObject, SoundObject>,
  seen: Set<SoundObject>,
): void {
  for (const layerGroup of score) {
    if (layerGroup instanceof PolyObject) {
      remapInstanceReferencesInSoundObject(layerGroup, libraryRemap, seen);
    }
  }
}

function remapInstanceReferencesInSoundObject(
  soundObject: SoundObject,
  libraryRemap: Map<SoundObject, SoundObject>,
  seen: Set<SoundObject>,
): void {
  if (seen.has(soundObject)) {
    return;
  }
  seen.add(soundObject);

  if (soundObject instanceof Instance) {
    const referenced = soundObject.getSoundObject();
    if (referenced && libraryRemap.has(referenced)) {
      soundObject.setSoundObject(libraryRemap.get(referenced)!);
    }
    const copiedReference = soundObject.getSoundObject();
    if (copiedReference) {
      remapInstanceReferencesInSoundObject(copiedReference, libraryRemap, seen);
    }
    return;
  }

  if (soundObject instanceof PolyObject) {
    for (const layer of soundObject) {
      for (const child of layer) {
        remapInstanceReferencesInSoundObject(child, libraryRemap, seen);
      }
    }
  }
}

/**
 * Remap Instance references found inside Live Data bins (LiveObjects whose
 * SoundObject is an Instance pointing at an original library object).
 */
function remapInstanceReferencesInLiveData(
  liveData: LiveData,
  libraryRemap: Map<SoundObject, SoundObject>,
  seen: Set<SoundObject>,
): void {
  const bins = liveData.getLiveObjectBins();
  for (let c = 0; c < bins.getColumnCount(); c++) {
    for (let r = 0; r < bins.getRowCount(); r++) {
      const liveObject = bins.getLiveObject(c, r);
      if (!liveObject) continue;
      const soundObject = liveObject.getSoundObject();
      if (soundObject) {
        remapInstanceReferencesInSoundObject(soundObject, libraryRemap, seen);
      }
    }
  }
}
