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
import { ObjectBuilder } from './sound-objects/object-builder';
import { PolyObject } from './sound-objects/poly-object';
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

type CsdRenderProfile = "realtime" | "disk";

type RenderCsdResult = {
  csdText: string;
  parameters?: Parameter[];
  stringChannels?: Array<{ objectName: string; value: string; channelName: string }>;
};

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

  /**
   * Load BlueData from an XML string.
   * Automatically applies migrations if the file version is old.
   */
  static loadFromString(xmlString: string): BlueData {
    const rootElement = Element.parse(xmlString);

    if (rootElement.getName() !== "blueData") {
      throw new Error(
        `Expected root element "blueData", got "${rootElement.getName()}"`,
      );
    }

    // Apply migrations
    UpgradeManager.getInstance().performUpgrades(rootElement);

    const objRefMap = new ObjRefLoadMap();
    const blueData = new BlueData();

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
          blueData.projectProperties = ProjectProperties.loadFromXML(node);
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
          blueData.mixer = Mixer.loadFromXML(node);
          mixerLoaded = true;
          break;
        case "tables":
          blueData.tableSet = Tables.loadFromXML(node);
          break;
        case "soundObjectLibrary":
          blueData.sObjLib = SoundObjectLibrary.loadFromXML(node, objRefMap);
          break;
        case "globalOrcSco":
          blueData.globalOrcSco = GlobalOrcSco.loadFromXML(node);
          break;
        case "udo":
          // Legacy root UDO text → parse into OpcodeList
          {
            const udoText = node.getTextString();
            if (udoText) {
              blueData.opcodeList = parseUDOText(udoText);
            }
          }
          break;
        case "opcodeList":
          blueData.opcodeList = OpcodeList.loadFromXML(node);
          break;
        case "liveData":
          blueData.liveData = LiveData.loadFromXML(node, objRefMap);
          break;
        case "score":
          blueData.score = Score.loadFromXML(node, objRefMap);
          break;
        case "scratchPadData":
          blueData.scratchData = ScratchPadData.loadFromXML(node);
          break;
        case "noteProcessorChainMap":
          blueData.noteProcessorChainMap =
            NoteProcessorChainMap.loadFromXML(node);
          break;
        case "renderStartTime":
          blueData.renderStartTime = parseFloat(node.getTextString());
          break;
        case "renderEndTime":
          blueData.renderEndTime = parseFloat(node.getTextString());
          break;
        case "markersList":
          blueData.markersList = MarkersList.loadFromXML(node);
          break;
        case "loopRendering":
          blueData.loopRendering =
            node.getTextString().toLowerCase() === "true";
          break;
        case "midiInputProcessor":
          blueData.midiInputProcessor = MidiInputProcessor.loadFromXML(node);
          break;
        case "timeContext":
          // Legacy root timeContext → migrate into score
          blueData.score.setTimeContext(TimeContext.loadFromXML(node));
          break;
        case "pluginData":
          // Preserve plugin data children opaquely
          blueData.pluginDataXml = [];
          const pluginChildren = node.getElements();
          while (pluginChildren.hasMoreElements()) {
            blueData.pluginDataXml.push(pluginChildren.next());
          }
          break;
      }
    }

    // Post-loop: wire arrangement with instrumentLibrary (Java parity)
    if (arrangementNode) {
      if (instrumentLibraryNode) {
        const lib = InstrumentLibrary.loadFromXML(instrumentLibraryNode);
        blueData.instrumentLibrary = lib;
        blueData.arrangement = Arrangement.loadFromXMLWithLibrary(arrangementNode, lib);
      } else {
        blueData.arrangement = Arrangement.loadFromXML(arrangementNode);
      }
    } else if (instrumentLibraryNode) {
      // Store instrumentLibrary even without arrangement
      blueData.instrumentLibrary = InstrumentLibrary.loadFromXML(instrumentLibraryNode);
    }

    // Post-loop: if no mixer element was present, disable mixer (Java parity)
    if (!mixerLoaded) {
      blueData.mixer.setEnabled(false);
    }

    // Post-loop: wire projectProperties into score.timeContext (Java parity)
    blueData.score.getTimeContext().setSampleRate(
      parseInt(blueData.projectProperties.sampleRate, 10) || 44100
    );

    return blueData;
  }

  // ─── Saving ───

  /**
   * Save to an XML Element (for internal use).
   */
  saveAsXML(objRefMap?: ObjRefSaveMap): Element {
    this.version = BLUE_VERSION;
    const root = new Element("blueData");
    root.setAttribute("version", this.version);

    // Java-compatible root section ordering
    root.addElement(this.projectProperties.saveAsXML(objRefMap));
    root.addElement(this.arrangement.saveAsXML());
    root.addElement(this.mixer.saveAsXML());
    root.addElement(this.tableSet.saveAsXML());
    root.addElement(this.sObjLib.saveAsXML(objRefMap));
    root.addElement(this.globalOrcSco.saveAsXML());
    root.addElement(this.opcodeList.saveAsXML());
    root.addElement(this.liveData.saveAsXML(objRefMap));
    root.addElement(this.score.saveAsXML(objRefMap));
    root.addElement(this.scratchData.saveAsXML());
    root.addElement(this.noteProcessorChainMap.saveAsXML());
    root.addElement("renderStartTime").setText(this.renderStartTime.toString());
    root.addElement("renderEndTime").setText(this.renderEndTime.toString());
    root.addElement(this.markersList.saveAsXML());
    root.addElement("loopRendering").setText(this.loopRendering.toString());
    root.addElement(this.midiInputProcessor.saveAsXML());

    // Preserve pluginData children
    const pluginDataElem = root.addElement("pluginData");
    for (const pd of this.pluginDataXml) {
      pluginDataElem.addElement(pd.clone());
    }

    return root;
  }

  /**
   * Save BlueData to an XML string.
   */
  saveToString(): string {
    const objRefMap = new ObjRefSaveMap();
    const root = this.saveAsXML(objRefMap);
    return root.toXml();
  }

  // ─── CSD Generation ───

  /**
   * Generate a complete CSD string from this project data.
   * Mirrors the Java CSDRender.generateCSDImpl() method.
   *
   * Output format:
   *   ; "title"
   *   ; by author
   *   ; notes
   *   ;
   *   ; Generated by blue X.X.X (http://blue.kunstmusik.com)
   *   ;
   *
   *   <CsoundSynthesizer>
   *   <CsInstruments>
   *   sr=44100
   *   ksmps=64
   *   nchnls=2
   *   0dbfs=1
   *
   *   ; Global orc from GlobalOrcSco
   *   ; Mixer init statements (ga_bluemix_X_Y init 0)
   *   ; UDO list from OpcodeList
   *
   *       instr 1    ;Instrument Name
   *   ...
   *       endin
   *
   *   </CsInstruments>
   *   <CsScore>
   *
   *   ; F-tables
   *   ; Global sco
   *   ; Score notes
   *   e
   *   </CsScore>
   *   </CsoundSynthesizer>
  */
  toCSD(session?: JavaScriptSession): string {
    return this.buildStandardCSD("realtime", session).csdText;
  }

  async toCSDAsync(
    session?: JavaScriptSession,
    runtimeClient?: JavaRuntimeClientContract | null,
  ): Promise<string> {
    return (await this.buildStandardCSDAsync("realtime", session, runtimeClient)).csdText;
  }

  toDiskCSD(session?: JavaScriptSession): string {
    return this.buildStandardCSD("disk", session).csdText;
  }

  async toDiskCSDAsync(
    session?: JavaScriptSession,
    runtimeClient?: JavaRuntimeClientContract | null,
  ): Promise<string> {
    return (await this.buildStandardCSDAsync("disk", session, runtimeClient)).csdText;
  }

  toRealtimePlaybackCSD(session?: JavaScriptSession): RenderCsdResult {
    return this.buildStandardCSD("realtime", session);
  }

  async toRealtimePlaybackCSDAsync(
    session?: JavaScriptSession,
    runtimeClient?: JavaRuntimeClientContract | null,
  ): Promise<RenderCsdResult> {
    return this.buildStandardCSDAsync("realtime", session, runtimeClient);
  }

  processOnLoad(session?: JavaScriptSession): void {
    this.score.processOnLoad(session);
  }

  async processOnLoadAsync(
    session?: JavaScriptSession,
    runtimeClient?: JavaRuntimeClientContract | null,
  ): Promise<void> {
    await this.score.processOnLoadAsync(session, runtimeClient);
  }

  usesJavaRuntime(): boolean {
    const seen = new Set<SoundObject>();

    const chainUsesJavaRuntime = (chain: NoteProcessorChain | null | undefined): boolean => {
      if (!chain) {
        return false;
      }

      return chain.getProcessors().some((processor) => processor instanceof PythonProcessor);
    };

    const visit = (soundObject: SoundObject | null | undefined): boolean => {
      if (!soundObject || seen.has(soundObject)) {
        return false;
      }

      seen.add(soundObject);

      if (chainUsesJavaRuntime(soundObject.getNoteProcessorChain())) {
        return true;
      }

      if (soundObject instanceof ClojureObject || soundObject instanceof PythonObject) {
        return true;
      }

      if (soundObject instanceof ObjectBuilder && soundObject.isPythonLanguage()) {
        return true;
      }

      if (soundObject instanceof Instance) {
        return visit(soundObject.getSoundObject());
      }

      if (soundObject instanceof PolyObject) {
        for (const layer of soundObject) {
          if (chainUsesJavaRuntime(layer.getNoteProcessorChain())) {
            return true;
          }

          for (const nested of layer) {
            if (visit(nested)) {
              return true;
            }
          }
        }
      }

      return false;
    };

    if (chainUsesJavaRuntime(this.score.getNoteProcessorChain())) {
      return true;
    }

    for (const layerGroup of this.score) {
      if (layerGroup instanceof PolyObject && visit(layerGroup)) {
        return true;
      }
    }

    for (const soundObject of this.sObjLib.getAllObjects()) {
      if (visit(soundObject)) {
        return true;
      }
    }

    for (const assignment of this.arrangement.getArrangement()) {
      if (assignment.instr instanceof PythonInstrument) {
        return true;
      }
    }

    return false;
  }

  private buildStandardCSD(profile: CsdRenderProfile, session?: JavaScriptSession): RenderCsdResult {
    const { arrangement: clonedArrangement, tables: clonedTables, mixer: clonedMixer, compileData } =
      this.createRenderSnapshot(session);
    let generationError: unknown = null;
    const logPrefix =
      profile === "disk" ? "[BlueData.toDiskCSD]" : "[BlueData.toCSD]";

    try {
      const channelIdAssignments = this.assignChannelIds(clonedMixer);
      for (const [channel, id] of channelIdAssignments) {
        compileData.getChannelIdAssignments().set(channel, id);
      }

      // Build CsInstruments header (sr/ksmps/nchnls/0dbfs go here, not in CsOptions)
      const orchestraHeader = this.buildOrchestraHeader(profile);
      const nchnls = this.getNchnls(profile);

      // Global orchestra/sco from stored data
      let globalOrc = this.globalOrcSco.getGlobalOrc() || "";
      const baseGlobalSco = this.globalOrcSco.getGlobalSco() || "";

      const appendGlobalOrc = (section: string) => {
        if (!section) {
          return;
        }
        if (globalOrc.length > 0 && !globalOrc.endsWith("\n")) {
          globalOrc += "\n";
        }
        globalOrc += section;
      };

      // Mixer init statements
      if (clonedMixer.isEnabled()) {
        const mixerInits = clonedMixer.getInitStatements(
          channelIdAssignments,
          nchnls,
        );
        if (mixerInits) {
          // Java appends an extra newline after mixer init statements before
          // adding them to GlobalOrcSco, which preserves a two-blank-line gap
          // before parameter init statements.
          appendGlobalOrc(`${mixerInits}\n\n`);
        }
      }

      const udos = new OpcodeList(this.opcodeList);
      clonedArrangement.generateUserDefinedOpcodes(udos);

      const parameters = getAllParameters(clonedArrangement, clonedMixer);
      assignParameterNames(parameters);
      const stringChannels = this.collectStringChannels(clonedArrangement);
      compileData.registerExistingAutomationState(parameters, stringChannels);

      appendFtgenTableNumbers(globalOrc, clonedTables);
      clonedArrangement.generateFTables(clonedTables);

      const ftables = clonedTables.getAllTables();

      // Score → score events
      const { startTime, endTime } = this.getRenderWindow(profile);
      const noteList = this.score.generateForCSD(compileData, startTime, endTime);
      const allParameters = compileData.getOriginalParameters();
      const allStringChannels = compileData.getStringChannels();
      compileData.setHandleParametersAndChannels(false);

      if (endTime > 0 && endTime > startTime) {
        const renderEndInstrument = this.createRenderEndInstrument();
        const renderEndInstrumentId = clonedArrangement.addInstrumentAtEnd(
          renderEndInstrument,
        );

        const renderEndNote = Note.createNoteFromText(
          `i${renderEndInstrumentId} ${endTime - startTime} 0.1`,
        );
        if (renderEndNote) {
          noteList.add(renderEndNote);
        }
      }

      const parameterMap = this.buildParameterMap(clonedArrangement);

      const scoreTempoMap = this.score.getTimeContext().getTempoMap();
      let tempoMap: TempoMap | null = null;
      let scoreGlobalPrefix = baseGlobalSco;

      if (scoreTempoMap.isEnabled()) {
        tempoMap = scoreTempoMap;
        const tempoStatement = getTempoScore(scoreTempoMap, startTime, endTime);
        scoreGlobalPrefix = [baseGlobalSco, tempoStatement]
          .filter((section) => section.length > 0)
          .join("\n");
      } else {
        tempoMap = getTempoMapFromScoreText(baseGlobalSco);
      }

      const arrangementGlobalSco = clonedArrangement.generateGlobalSco(compileData);
      const totalDur = this.getNoteListDuration(noteList);
      const processingStart = startTime;
      const globalSco = preprocessSco(
        [scoreGlobalPrefix, arrangementGlobalSco].filter(Boolean).join("\n"),
        totalDur,
        startTime,
        processingStart,
        tempoMap,
      );
      let globalDur = this.getNoteListDurationFromText(globalSco);
      if (globalDur < totalDur) {
        globalDur = totalDur;
      }
      if (clonedMixer.isEnabled()) {
        globalDur += clonedMixer.getExtraRenderTime();
      }

      const alwaysOnInstruments = this.collectAlwaysOnInstruments(
        clonedArrangement,
        clonedMixer,
        channelIdAssignments,
        parameterMap,
        compileData,
      );

      for (const instrument of alwaysOnInstruments) {
        const sourceId = compileData.getInstrSourceId(instrument);
        if (sourceId && /^\d+$/.test(sourceId)) {
          const instrId = clonedArrangement.addInstrumentAtEnd(instrument);
          this.addScoreNote(noteList, `i${instrId} 0 ${globalDur}`);
        } else {
          const alwaysOnId = `${sourceId ?? "unknown"}_alwaysOn`;
          clonedArrangement.addInstrumentWithId(instrument, alwaysOnId, false);
          this.addScoreNote(noteList, `i"${alwaysOnId}" 0 ${globalDur}`);
        }
      }

      let mixerEffectUDOs: string[] = [];
      let mixerInstruments = "";
      if (clonedMixer.isEnabled()) {
        const mixerOutput = this.generateMixerOrchestra(
          channelIdAssignments,
          nchnls,
          udos,
          clonedMixer,
        );
        mixerEffectUDOs = mixerOutput.effectUDOs;
        mixerInstruments = mixerOutput.instrumentsText;
        this.addScoreNote(noteList, `i"BlueMixer" 0 ${globalDur}`);
      }

      if (profile === "disk") {
        this.appendParameterAutomationNotes(
          allParameters,
          noteList,
          clonedArrangement,
          startTime,
          startTime + globalDur,
        );
      }

      const arrangementGlobalOrc = processCommandBlocks(
        clonedArrangement.generateGlobalOrc(compileData),
      );

      const initStatements = this.buildRuntimeInitStatements(
        allParameters,
        allStringChannels,
        profile,
        startTime,
      );
      if (initStatements.length > 0) {
        appendGlobalOrc(`${initStatements}\n`);
      }

      const compileGlobalOrc = compileData.getGlobalOrc();
      if (compileGlobalOrc.trim().length > 0) {
        appendGlobalOrc(compileGlobalOrc);
      }

      const allUDOText: string[] = [];
      const masterUDOText = udos.toString().trim();
      if (masterUDOText.length > 0) {
        allUDOText.push(masterUDOText);
      }
      if (mixerEffectUDOs.length > 0) {
        allUDOText.push(...mixerEffectUDOs);
      }
      const udoText = allUDOText.length > 0 ? `${allUDOText.join("\n")}\n` : "";

      const orc = clonedArrangement.generateOrchestra(
        compileData,
        clonedMixer,
        nchnls,
        parameterMap,
      );

      const scoreText = this.buildScoreText(
        ftables,
        globalSco,
        noteList,
      );

      // Build project info comments
      const projectInfo = this.buildProjectInfo();

      // Assemble CSD
      const csdText = (
        projectInfo +
        "<CsoundSynthesizer>\n\n" +
        "<CsInstruments>\n" +
        orchestraHeader +
        "\n\n" +
        globalOrc +
        "\n\n" +
        arrangementGlobalOrc +
        "\n\n" +
        udoText +
        "\n\n" +
        orc +
        mixerInstruments +
        "\n\n</CsInstruments>\n\n" +
        "<CsScore>\n\n" +
        scoreText +
        "</CsScore>\n\n" +
        "</CsoundSynthesizer>"
      );

      return {
        csdText,
        parameters: allParameters,
        stringChannels: allStringChannels,
      };
    } catch (error) {
      generationError = error;
      throw error;
    } finally {
      try {
        disposeJavaScriptCompileState(compileData);
      } catch (cleanupError) {
        if (generationError === null) {
          throw cleanupError;
        }
        console.warn(`${logPrefix} Failed to dispose JavaScript runtime state:`, cleanupError);
      }
    }
  }

  private async buildStandardCSDAsync(
    profile: CsdRenderProfile,
    session?: JavaScriptSession,
    runtimeClient?: JavaRuntimeClientContract | null,
  ): Promise<RenderCsdResult> {
    const { arrangement: clonedArrangement, tables: clonedTables, mixer: clonedMixer, compileData } =
      this.createRenderSnapshot(session, runtimeClient);
    let generationError: unknown = null;
    const logPrefix =
      profile === "disk" ? "[BlueData.toDiskCSDAsync]" : "[BlueData.toCSDAsync]";

    try {
      const channelIdAssignments = this.assignChannelIds(clonedMixer);
      for (const [channel, id] of channelIdAssignments) {
        compileData.getChannelIdAssignments().set(channel, id);
      }

      const orchestraHeader = this.buildOrchestraHeader(profile);
      const nchnls = this.getNchnls(profile);

      let globalOrc = this.globalOrcSco.getGlobalOrc() || "";
      const baseGlobalSco = this.globalOrcSco.getGlobalSco() || "";

      const appendGlobalOrc = (section: string) => {
        if (!section) {
          return;
        }
        if (globalOrc.length > 0 && !globalOrc.endsWith("\n")) {
          globalOrc += "\n";
        }
        globalOrc += section;
      };

      if (clonedMixer.isEnabled()) {
        const mixerInits = clonedMixer.getInitStatements(
          channelIdAssignments,
          nchnls,
        );
        if (mixerInits) {
          appendGlobalOrc(`${mixerInits}\n\n`);
        }
      }

      const udos = new OpcodeList(this.opcodeList);
      clonedArrangement.generateUserDefinedOpcodes(udos);

      const parameters = getAllParameters(clonedArrangement, clonedMixer);
      assignParameterNames(parameters);
      const stringChannels = this.collectStringChannels(clonedArrangement);
      compileData.registerExistingAutomationState(parameters, stringChannels);

      appendFtgenTableNumbers(globalOrc, clonedTables);
      clonedArrangement.generateFTables(clonedTables);

      const ftables = clonedTables.getAllTables();

      const { startTime, endTime } = this.getRenderWindow(profile);
      const noteList = await this.score.generateForCSDAsync(compileData, startTime, endTime);
      const allParameters = compileData.getOriginalParameters();
      const allStringChannels = compileData.getStringChannels();
      compileData.setHandleParametersAndChannels(false);

      if (endTime > 0 && endTime > startTime) {
        const renderEndInstrument = this.createRenderEndInstrument();
        const renderEndInstrumentId = clonedArrangement.addInstrumentAtEnd(
          renderEndInstrument,
        );

        const renderEndNote = Note.createNoteFromText(
          `i${renderEndInstrumentId} ${endTime - startTime} 0.1`,
        );
        if (renderEndNote) {
          noteList.add(renderEndNote);
        }
      }

      const parameterMap = this.buildParameterMap(clonedArrangement);

      const scoreTempoMap = this.score.getTimeContext().getTempoMap();
      let tempoMap: TempoMap | null = null;
      let scoreGlobalPrefix = baseGlobalSco;

      if (scoreTempoMap.isEnabled()) {
        tempoMap = scoreTempoMap;
        const tempoStatement = getTempoScore(scoreTempoMap, startTime, endTime);
        scoreGlobalPrefix = [baseGlobalSco, tempoStatement]
          .filter((section) => section.length > 0)
          .join("\n");
      } else {
        tempoMap = getTempoMapFromScoreText(baseGlobalSco);
      }

      const arrangementGlobalSco = clonedArrangement.generateGlobalSco(compileData);
      const totalDur = this.getNoteListDuration(noteList);
      const processingStart = startTime;
      const globalSco = preprocessSco(
        [scoreGlobalPrefix, arrangementGlobalSco].filter(Boolean).join("\n"),
        totalDur,
        startTime,
        processingStart,
        tempoMap,
      );
      let globalDur = this.getNoteListDurationFromText(globalSco);
      if (globalDur < totalDur) {
        globalDur = totalDur;
      }
      if (clonedMixer.isEnabled()) {
        globalDur += clonedMixer.getExtraRenderTime();
      }

      const alwaysOnInstruments = this.collectAlwaysOnInstruments(
        clonedArrangement,
        clonedMixer,
        channelIdAssignments,
        parameterMap,
        compileData,
      );

      for (const instrument of alwaysOnInstruments) {
        const sourceId = compileData.getInstrSourceId(instrument);
        if (sourceId && /^\d+$/.test(sourceId)) {
          const instrId = clonedArrangement.addInstrumentAtEnd(instrument);
          this.addScoreNote(noteList, `i${instrId} 0 ${globalDur}`);
        } else {
          const alwaysOnId = `${sourceId ?? "unknown"}_alwaysOn`;
          clonedArrangement.addInstrumentWithId(instrument, alwaysOnId, false);
          this.addScoreNote(noteList, `i"${alwaysOnId}" 0 ${globalDur}`);
        }
      }

      let mixerEffectUDOs: string[] = [];
      let mixerInstruments = "";
      if (clonedMixer.isEnabled()) {
        const mixerOutput = this.generateMixerOrchestra(
          channelIdAssignments,
          nchnls,
          udos,
          clonedMixer,
        );
        mixerEffectUDOs = mixerOutput.effectUDOs;
        mixerInstruments = mixerOutput.instrumentsText;
        this.addScoreNote(noteList, `i"BlueMixer" 0 ${globalDur}`);
      }

      if (profile === "disk") {
        this.appendParameterAutomationNotes(
          allParameters,
          noteList,
          clonedArrangement,
          startTime,
          startTime + globalDur,
        );
      }

      const arrangementGlobalOrc = processCommandBlocks(
        clonedArrangement.generateGlobalOrc(compileData),
      );

      const initStatements = this.buildRuntimeInitStatements(
        allParameters,
        allStringChannels,
        profile,
        startTime,
      );
      if (initStatements.length > 0) {
        appendGlobalOrc(`${initStatements}\n`);
      }

      const compileGlobalOrc = compileData.getGlobalOrc();
      if (compileGlobalOrc.trim().length > 0) {
        appendGlobalOrc(compileGlobalOrc);
      }

      const allUDOText: string[] = [];
      const masterUDOText = udos.toString().trim();
      if (masterUDOText.length > 0) {
        allUDOText.push(masterUDOText);
      }
      if (mixerEffectUDOs.length > 0) {
        allUDOText.push(...mixerEffectUDOs);
      }
      const udoText = allUDOText.length > 0 ? `${allUDOText.join("\n")}\n` : "";

      const orc = await clonedArrangement.generateOrchestraAsync(
        compileData,
        clonedMixer,
        nchnls,
        parameterMap,
      );

      const scoreText = this.buildScoreText(
        ftables,
        globalSco,
        noteList,
      );

      const projectInfo = this.buildProjectInfo();

      const csdText = (
        projectInfo +
        "<CsoundSynthesizer>\n\n" +
        "<CsInstruments>\n" +
        orchestraHeader +
        "\n\n" +
        globalOrc +
        "\n\n" +
        arrangementGlobalOrc +
        "\n\n" +
        udoText +
        "\n\n" +
        orc +
        mixerInstruments +
        "\n\n</CsInstruments>\n\n" +
        "<CsScore>\n\n" +
        scoreText +
        "</CsScore>\n\n" +
        "</CsoundSynthesizer>"
      );

      return {
        csdText,
        parameters: allParameters,
        stringChannels: allStringChannels,
      };
    } catch (error) {
      generationError = error;
      throw error;
    } finally {
      try {
        disposeJavaScriptCompileState(compileData);
      } catch (cleanupError) {
        if (generationError === null) {
          throw cleanupError;
        }
        console.warn(`${logPrefix} Failed to dispose JavaScript runtime state:`, cleanupError);
      }
    }
  }

  toBlueLiveCSD(session?: JavaScriptSession): RenderCsdResult {
    const { arrangement: clonedArrangement, tables: clonedTables, mixer: clonedMixer, compileData } =
      this.createRenderSnapshot(session);
    let generationError: unknown = null;

    try {
      const channelIdAssignments = this.assignChannelIds(clonedMixer);
      for (const [channel, id] of channelIdAssignments) {
        compileData.getChannelIdAssignments().set(channel, id);
      }

      const orchestraHeader = this.buildOrchestraHeader();
      const nchnls = this.getNchnls();

      let globalOrc = this.globalOrcSco.getGlobalOrc() || "";
      let globalSco = this.globalOrcSco.getGlobalSco() || "";

      const appendGlobalOrc = (section: string) => {
        if (!section) return;
        globalOrc += `\n${section}`;
      };

      if (clonedMixer.isEnabled()) {
        const mixerInits = clonedMixer.getInitStatements(channelIdAssignments, nchnls);
        if (mixerInits) {
          appendGlobalOrc(`${mixerInits}\n\n`);
        }
      }

      const udos = new OpcodeList(this.opcodeList);
      clonedArrangement.generateUserDefinedOpcodes(udos);

      const parameters = getAllParameters(clonedArrangement, clonedMixer);
      assignParameterNames(parameters);
      const stringChannels = this.collectStringChannels(clonedArrangement);
      compileData.registerExistingAutomationState(parameters, stringChannels);
      const stringInits = this.buildStringChannelInits(compileData.getStringChannels());
      const paramInits = this.buildParameterInits(
        compileData.getOriginalParameters(),
        "realtime",
        this.renderStartTime,
        false,
      );
      const runtimeInitStatements = [stringInits, paramInits]
        .filter((section) => section.length > 0)
        .join("\n");
      if (runtimeInitStatements) {
        appendGlobalOrc(`${runtimeInitStatements}\n`);
      }

      const ftables = clonedTables.getAllTables();
      const parameterMap = this.buildParameterMap(clonedArrangement);
      const totalDur = 36000;

      const baseArrangementItems = clonedArrangement
        .getArrangement()
        .filter((ia) => ia.enabled && ia.instr);
      const baseInstrIds = baseArrangementItems
        .map((ia) => ia.arrangementId)
        .filter((id): id is string => Boolean(id));

      const alwaysOnInstruments = this.collectAlwaysOnInstruments(
        clonedArrangement,
        clonedMixer,
        channelIdAssignments,
        parameterMap,
        compileData,
      );

      let blueLiveSco = `${globalSco}\n`;
      for (const instrument of alwaysOnInstruments) {
        const sourceId = compileData.getInstrSourceId(instrument);
        if (sourceId && /^\d+$/.test(sourceId)) {
          const instrId = clonedArrangement.addInstrumentAtEnd(instrument);
          blueLiveSco += `i${instrId} 0 ${totalDur}\n`;
        } else {
          const alwaysOnId = `${sourceId ?? "unknown"}_alwaysOn`;
          clonedArrangement.addInstrumentWithId(instrument, alwaysOnId, false);
          blueLiveSco += `i "${alwaysOnId}" 0 ${totalDur}\n`;
        }
      }

      let mixerEffectUDOs: string[] = [];
      let mixerInstruments = "";
      if (clonedMixer.isEnabled()) {
        const mixerOutput = this.generateMixerOrchestra(
          channelIdAssignments,
          nchnls,
          udos,
          clonedMixer,
        );
        mixerEffectUDOs = mixerOutput.effectUDOs;
        mixerInstruments = mixerOutput.instrumentsText;
      }

      const arrangementGlobalOrc = clonedArrangement.generateGlobalOrc(compileData);
      const allUDOText: string[] = [];
      const masterUDOText = udos.toString().trim();
      if (masterUDOText.length > 0) {
        allUDOText.push(masterUDOText);
      }
      if (mixerEffectUDOs.length > 0) {
        allUDOText.push(...mixerEffectUDOs);
      }
      const udoText = allUDOText.length > 0 ? `${allUDOText.join("\n")}\n` : "";

      const orc = clonedArrangement.generateOrchestra(
        compileData,
        clonedMixer,
        nchnls,
        parameterMap,
      );

      let blueLiveOrc = orc + mixerInstruments;
      blueLiveOrc += "\n\n" + this.createAllNotesOffInstrument(baseInstrIds);

      if (clonedMixer.isEnabled()) {
        blueLiveSco += `i "BlueMixer" 0 ${totalDur}\n`;
      }

      const projectInfo = this.buildProjectInfo();

      const csdText =
        projectInfo +
        "<CsoundSynthesizer>\n\n" +
        "<CsInstruments>\n" +
        orchestraHeader +
        "\n\n" +
        globalOrc +
        "\n\n" +
        arrangementGlobalOrc +
        "\n\n" +
        udoText +
        "\n\n" +
        blueLiveOrc +
        "\n\n</CsInstruments>\n\n" +
        "<CsScore>\n\n" +
        ftables +
        "\n\n" +
        blueLiveSco +
        "e " + totalDur + "\n\n" +
        "</CsScore>\n\n" +
        "</CsoundSynthesizer>";

      return {
        csdText,
        parameters: compileData.getOriginalParameters(),
        stringChannels: compileData.getStringChannels(),
      };
    } catch (error) {
      generationError = error;
      throw error;
    } finally {
      try {
        disposeJavaScriptCompileState(compileData);
      } catch (cleanupError) {
        if (generationError === null) {
          throw cleanupError;
        }
        console.warn('[BlueData.toBlueLiveCSD] Failed to dispose JavaScript runtime state:', cleanupError);
      }
    }
  }

  private createAllNotesOffInstrument(instrIds: string[]): string {
    const lines: string[] = [];
    lines.push('\tinstr blueAllNotesOff');
    lines.push('koff init 0');
    lines.push('if (koff == 0) then');

    for (let i = 0; i < instrIds.length; i++) {
      const id = instrIds[i] ?? '';
      const parts = id.split(',').map((part) => part.trim()).filter((part) => part.length > 0);

      for (let j = 0; j < parts.length; j++) {
        const part = parts[j] ?? '';
        const numId = parseInt(part, 10);
        if (!isNaN(numId)) {
          lines.push(`turnoff2 ${numId}, 0, 1`);
        } else {
          lines.push(`insno${i}${j} nstrnum "${part}"`);
          lines.push(`turnoff2 insno${i}${j}, 0, 1`);
        }
      }
    }

    lines.push('koff = 1');
    lines.push('else');
    lines.push('turnoff');
    lines.push('endif');
    lines.push('');
    lines.push('\tendin');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Build the orchestra header (sr/ksmps/nchnls/0dbfs).
   */
  private buildOrchestraHeader(profile: CsdRenderProfile = "realtime"): string {
    const props = this.projectProperties;
    const isDisk = profile === "disk";
    const nchnls = this.getNchnls(profile);

    const lines: string[] = [];
    if (isDisk) {
      if (props.diskSampleRate) lines.push(`sr=${props.diskSampleRate}`);
      if (props.diskKsmps) lines.push(`ksmps=${props.diskKsmps}`);
    } else {
      if (props.sampleRate) lines.push(`sr=${props.sampleRate}`);
      if (props.ksmps) lines.push(`ksmps=${props.ksmps}`);
    }
    lines.push(`nchnls=${nchnls}`);
    if (isDisk) {
      if (props.diskUseZeroDbFS) lines.push(`0dbfs=${props.diskZeroDbFS}`);
    } else if (props.useZeroDbFS) {
      lines.push(`0dbfs=${props.zeroDbFS}`);
    }

    return lines.join("\n");
  }

  /**
   * Get the number of channels for real-time playback.
   */
  private getNchnls(profile: CsdRenderProfile = "realtime"): number {
    const props = this.projectProperties;
    const channels = profile === "disk" ? props.diskChannels : props.channels;
    if (channels) {
      const n = parseInt(channels, 10);
      if (!isNaN(n)) return n;
    }
    return 2; // Default stereo
  }

  private getRenderWindow(profile: CsdRenderProfile): { startTime: number; endTime: number } {
    if (profile === "disk" && this.projectProperties.diskAlwaysRenderEntireProject) {
      return { startTime: 0, endTime: -1 };
    }

    return {
      startTime: this.renderStartTime,
      endTime: this.renderEndTime,
    };
  }

  /**
   * Assign channel IDs for mixer init statements.
   * Mirrors Java's assignChannelIds().
   */
  private assignChannelIds(mixer: Mixer = this.mixer): Map<Channel, number> {
    const assignments = new Map<Channel, number>();
    let i = 0;

    // Source channels
    for (const channel of mixer.getAllSourceChannels()) {
      assignments.set(channel, i++);
    }

    // Sub channels
    for (const subChannel of mixer.getSubChannels()) {
      assignments.set(subChannel, i++);
    }

    assignments.set(mixer.getMaster(), i);

    return assignments;
  }

  /**
   * Build the score section with F-tables, globalSco, and generated score notes.
   */
  private buildScoreText(
    ftables: string,
    globalSco: string,
    noteList: NoteList,
  ): string {
    const noteLines: string[] = [];

    // Generated notes
    if (noteList && noteList.length > 0) {
      for (let i = 0; i < noteList.length; i++) {
        noteLines.push(noteList.getNote(i).toScoreText());
      }
    }

    const scoreGlobalText = globalSco.trimEnd();

    const scoreNotesText = noteLines.length > 0 ? `${noteLines.join("\n")}\n` : "";

    return `${ftables}\n\n${scoreGlobalText}\n\n${scoreNotesText}e\n\n`;
  }

  private buildRuntimeInitStatements(
    parameters: Parameter[],
    stringChannels: Array<{ objectName: string; value: string; channelName: string }>,
    profile: CsdRenderProfile = "realtime",
    renderStartTime: number = this.renderStartTime,
  ): string {
    const stringInits = this.buildStringChannelInits(stringChannels, profile);
    const paramInits = this.buildParameterInits(parameters, profile, renderStartTime);

    return [stringInits, paramInits]
      .filter((section) => section.length > 0)
      .join("\n");
  }

  private collectAlwaysOnInstruments(
    arrangement: Arrangement,
    mixer: Mixer,
    channelIdAssignments: Map<Channel, number>,
    parameterMap: Map<Instrument, Parameter[]>,
    compileData: CompileData,
  ): GenericInstrument[] {
    const alwaysOnInstruments: GenericInstrument[] = [];

    const sourceChannels = mixer.getAllSourceChannels();

    for (const ia of arrangement.getArrangement()) {
      if (!ia.enabled || !ia.instr) {
        continue;
      }

      const instr = ia.instr as any;
      let compiled = "";

      if (typeof instr.generateAlwaysOnInstrument === "function") {
        compiled = instr.generateAlwaysOnInstrument() ?? "";
      }

      if (!compiled && typeof instr.getAlwaysOnInstrumentText === "function") {
        const alwaysOnText = instr.getAlwaysOnInstrumentText();
        if (!alwaysOnText) {
          continue;
        }

        const instrParams = parameterMap.get(ia.instr);
        const unit = new BSBCompilationUnit();
        if (typeof instr.getGraphicInterface === "function") {
          instr.getGraphicInterface().collectReplacements(unit, instrParams);
        }
        compiled = unit.replaceBSBValues(alwaysOnText);
      }

      if (!compiled || compiled.trim().length === 0) {
        continue;
      }

      const sourceChannel = sourceChannels.find(
        (channel) => channel.getName() === ia.arrangementId,
      );
      const channelId = sourceChannel
        ? channelIdAssignments.get(sourceChannel)
        : undefined;

      if (channelId !== undefined) {
        compiled = compiled.replace(
          /(\w+),\s*(\w+)\s+blueMixerIn/g,
          `$1 = ga_bluemix_${channelId}_0\n $2 = ga_bluemix_${channelId}_1`,
        );
        compiled = compiled.replace(
          /blueMixerOut(\s+\w+),(\s*\w+)/g,
          `ga_bluemix_${channelId}_0 = $1\nga_bluemix_${channelId}_1 = $2`,
        );
      }

      const alwaysOnInstrument = new GenericInstrument();
      alwaysOnInstrument.setText(compiled);
      compileData.addInstrSourceId(alwaysOnInstrument, ia.arrangementId);
      alwaysOnInstruments.push(alwaysOnInstrument);
    }

    return alwaysOnInstruments;
  }

  private appendParameterAutomationNotes(
    parameters: Parameter[],
    notes: NoteList,
    arrangement: Arrangement,
    renderStart: number,
    renderEnd: number,
  ): void {
    for (const param of parameters) {
      if (!param.isAutomationEnabled()) {
        continue;
      }

      const compilationVarName = param.getCompilationVarName();
      if (!compilationVarName) {
        continue;
      }

      const points = param.getPoints();
      if (points.length < 2) {
        continue;
      }

      const instr = new GenericInstrument();
      instr.setName(`Param: ${param.getName()}`);

      if (param.getResolution() > 0.0) {
        instr.setText(`${compilationVarName} init p4\nturnoff`);
      } else {
        instr.setText(
          `if (p4 == p5) then\n` +
            `${compilationVarName} init p4\n` +
            `turnoff\n` +
            `else\n` +
            `${compilationVarName} line p4, p3, p5\n` +
            `endif`,
        );
      }

      const instrId = arrangement.addInstrumentAtEnd(instr);
      this.appendParameterScore(
        param,
        instrId,
        notes,
        renderStart,
        renderEnd,
      );
    }
  }

  private appendParameterScore(
    param: Parameter,
    instrId: number,
    notes: NoteList,
    renderStart: number,
    renderEnd: number,
  ): void {
    const points = param.getPoints();
    if (points.length < 2) {
      return;
    }

    const resolution = param.getResolution();
    const hasRenderEnd = renderEnd > renderStart;

    if (resolution > 0.0) {
      for (let i = 1; i < points.length; i++) {
        const p1 = points[i - 1]!;
        const p2 = points[i]!;

        const startTime = p1.time;
        const endTime = p2.time;

        if (hasRenderEnd && startTime >= renderEnd) {
          return;
        }
        if (endTime <= renderStart) {
          continue;
        }
        if (startTime === endTime || p1.value === p2.value) {
          continue;
        }

        const dur = endTime - startTime;
        const numSteps = Math.abs(Math.round((p2.value - p1.value) / resolution));
        if (numSteps <= 0) {
          continue;
        }

        const step = dur / numSteps;
        const valStep = p2.value < p1.value ? -resolution : resolution;
        let currentVal = p1.value;
        let start = startTime;

        for (let j = 0; j < numSteps - 1; j++) {
          currentVal += valStep;
          start += step;

          if (start <= renderStart) {
            continue;
          }
          if (hasRenderEnd && start >= renderEnd) {
            return;
          }

          this.addScoreNote(
            notes,
            `i${instrId}\t${formatJavaDouble(start - renderStart)}\t.0001\t${formatJavaDouble(currentVal)}`,
          );
        }

        const finalStart = start + step;
        if (hasRenderEnd && finalStart >= renderEnd) {
          return;
        }

        this.addScoreNote(
          notes,
          `i${instrId}\t${formatJavaDouble(finalStart - renderStart)}\t.0001\t${formatJavaDouble(p2.value)}`,
        );
      }

      return;
    }

    let lastValue = points[0]!.value;

    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1]!;
      const p2 = points[i]!;

      let startTime = p1.time;
      let endTime = p2.time;

      if (hasRenderEnd && startTime >= renderEnd) {
        return;
      }
      if (endTime <= renderStart) {
        lastValue = p2.value;
        continue;
      }
      if (startTime === endTime) {
        if (i === points.length - 1) {
          this.addScoreNote(
            notes,
            `i${instrId}\t${formatJavaDouble(p2.time - renderStart)}\t.0001\t${formatJavaDouble(p2.value)}\t${formatJavaDouble(p2.value)}`,
          );
        }
        continue;
      }

      let startVal = p1.value;
      let endVal = p2.value;

      if (startTime < renderStart) {
        startVal = param.getValue(renderStart);
        startTime = renderStart;
      }

      if (hasRenderEnd && endTime > renderEnd) {
        endVal = param.getValue(renderEnd);
        endTime = renderEnd;
      }

      lastValue = endVal;

      const dur = startVal === endVal ? 0.0001 : endTime - startTime;
      const relativeStart = startTime - renderStart;

      this.addScoreNote(
        notes,
        `i${instrId}\t${formatJavaDouble(relativeStart)}\t${formatJavaDouble(dur)}\t${formatJavaDouble(startVal)}\t${formatJavaDouble(endVal)}`,
      );

      if (i === points.length - 1) {
        this.addScoreNote(
          notes,
          `i${instrId}\t${formatJavaDouble(relativeStart + dur)}\t.0001\t${formatJavaDouble(lastValue)}\t${formatJavaDouble(lastValue)}`,
        );
      }
    }
  }

  private addScoreNote(notes: NoteList, noteText: string): void {
    const note = Note.createNoteFromText(noteText);
    if (note) {
      notes.add(note);
    }
  }

  /**
   * Build project info comments for the top of the CSD.
   * Mirrors Java's appendProjectInfo().
   */
  private buildProjectInfo(): string {
    const props = this.projectProperties;
    const notes = (props.notes || "").replace(/\n/g, "\n; ");

    return (
      ";\n" +
      `; "${props.title || ""}"\n` +
      `; by ${props.author || ""}\n` +
      ";\n" +
      `; ${notes}\n;\n` +
      `; Generated by blue ${BLUE_VERSION} (http://blue.kunstmusik.com)\n` +
      ";\n\n"
    );
  }

  private createRenderSnapshot(
    session?: JavaScriptSession,
    runtimeClient?: JavaRuntimeClientContract | null,
  ): {
    arrangement: Arrangement;
    tables: Tables;
    mixer: Mixer;
    compileData: CompileData;
  } {
    const arrangement = new Arrangement(this.arrangement);
    arrangement.clearUnusedInstrAssignments();
    const tables = new Tables(this.tableSet);
    const mixer = this.mixer.deepCopy() as Mixer;
    const compileData = new CompileData(arrangement, tables, true);

    if (session) {
      setJavaScriptSession(compileData, session);
    }

    if (runtimeClient) {
      setJavaRuntimeClient(compileData, runtimeClient);
    }

    return {
      arrangement,
      tables,
      mixer,
      compileData,
    };
  }

  private createRenderEndInstrument(): GenericInstrument {
    const instr = new GenericInstrument();
    instr.setText('event "e", 0, 0, 0.1');
    return instr;
  }

  private getNoteListDuration(notes: NoteList): number {
    let max = 0;
    for (let i = 0; i < notes.length; i++) {
      const note = notes.getNote(i);
      const end = note.getStartTime() + note.getSubjectiveDuration();
      if (end > max) {
        max = end;
      }
    }
    return max;
  }

  private getNoteListDurationFromText(scoreText: string): number {
    return this.getNoteListDuration(getNotes(scoreText));
  }

  /**
   * Build parameter init statements for globalOrc.
   * Uses standard chnexport so blue-engine can drive native Csound channels
   * and mirror them into shared memory for external readers.
   *
   * Output:
   *   gk_blue_auto0 init 0.5
   *   gk_blue_auto0 chnexport "gk_blue_auto0", 3
   *   ...
   */
  private buildParameterInits(
    parameters: Parameter[],
    profile: CsdRenderProfile = "realtime",
    renderStartTime: number = this.renderStartTime,
    useRenderStartValue: boolean = true,
  ): string {
    const lines: string[] = [];

    for (const param of parameters) {
      const varName = param.getCompilationVarName();
      if (!varName) continue;

      const initialVal =
        param.isAutomationEnabled() && useRenderStartValue
          ? param.getValue(renderStartTime)
          : param.getFixedValue();

      // Init statement
      lines.push(`${varName} init ${formatBlueNumber(initialVal)}`);

      if (profile !== "disk") {
        // Standard Csound channel export for engine-side channel bridging
        lines.push(`${varName} chnexport "${varName}", 3`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Collect all StringChannels from BSB instruments in the arrangement.
   * Mirrors Java's getStringChannels() method.
   */
  private collectStringChannels(arrangement?: Arrangement): Array<{
    objectName: string;
    value: string;
    channelName: string;
  }> {
    const channels: Array<{
      objectName: string;
      value: string;
      channelName: string;
    }> = [];
    let idx = 0;

    const arr = arrangement ?? this.arrangement;

    for (const ia of arr.getArrangement()) {
      if (!ia.enabled || !ia.instr) continue;
      const instr = ia.instr as any;
      if (typeof instr.getStringChannels === "function") {
        for (const sc of instr.getStringChannels()) {
          const channelName = `gS_blue_str${idx++}`;
          sc.channelName = channelName;
          channels.push({
            objectName: sc.objectName,
            value: sc.value,
            channelName,
          });
        }
      }
    }

    return channels;
  }

  /**
   * Build a per-instrument parameter map for BSB compilation.
   * Each instrument gets its own Parameter[] with compilationVarName set.
   * This is used by generateInstrument() to replace widget values with gk_blue_autoN.
   */
  private buildParameterMap(arrangement?: Arrangement): Map<Instrument, Parameter[]> {
    const map = new Map<Instrument, Parameter[]>();
    const arr = arrangement ?? this.arrangement;

    for (const ia of arr.getArrangement()) {
      if (!ia.enabled || !ia.instr) continue;
      const instr = ia.instr as any;
      if (typeof instr.getParameters === "function") {
        const instrParams = instr.getParameters();
        if (
          instrParams &&
          Array.isArray(instrParams) &&
          instrParams.length > 0
        ) {
          map.set(ia.instr, instrParams);
        }
      }
    }

    return map;
  }

  /**
   * Build string channel init statements for globalOrc.
   * Mirrors Java's handleParameters() string channel handling.
   *
   * Output:
   *   gS_blue_str0 = "/path/to/file.wav"
   *   gS_blue_str0 chnexport "gS_blue_str0", 3
   *   ...
   */
  private buildStringChannelInits(
    channels: Array<{ objectName: string; value: string; channelName: string }>,
    profile: CsdRenderProfile = "realtime",
  ): string {
    const lines: string[] = [];

    for (const sc of channels) {
      lines.push(`${sc.channelName} = "${sc.value}"`);
      if (profile !== "disk") {
        lines.push(`${sc.channelName} chnexport "${sc.channelName}", 3`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Generate the mixer's orchestra code: effect UDOs and the BlueMixer
   * instrument text.
   *
   * Output structure:
   *   opcode blueEffect0,aa,aa ; EffectName
   *   ...
   *   endop
   *
   *   instr BlueMixer
   *   ...
   *   endin
   */
  private generateMixerOrchestra(
    channelIdAssignments: Map<Channel, number>,
    nchnls: number,
    udos: OpcodeList,
    mixer: Mixer = this.mixer,
  ): { effectUDOs: string[]; instrumentsText: string; effectIdMap: Map<Effect, number> } {
    const instrBuffer: string[] = [];
    const sourceChannels = mixer.getAllSourceChannels();
    const subChannels = this.sortSubChannelsForRendering(
      Array.from(mixer.getSubChannels()),
    );

    let effectId = 0;
    const effectUDOs: string[] = [];
    const effectIdMap = new Map<Effect, number>();

    const registerEffects = (chain: EffectsChain) => {
      for (const item of chain) {
        if (!(item instanceof Effect) || !item.isEnabled() || effectIdMap.has(item)) {
          continue;
        }

        const udo = item.generateUDO(
          effectId,
          item.getParameters(),
          udos,
        );
        if (!udo) {
          continue;
        }

        effectIdMap.set(item, effectId);
        effectUDOs.push(udo);
        effectId++;
      }
    };

    for (const channel of sourceChannels) {
      registerEffects(channel.getPreEffects());
      registerEffects(channel.getPostEffects());
    }

    for (const subChannel of subChannels) {
      registerEffects(subChannel.getPreEffects());
      registerEffects(subChannel.getPostEffects());
    }

    registerEffects(mixer.getMaster().getPreEffects());
    registerEffects(mixer.getMaster().getPostEffects());

    // Generate BlueMixer instrument
    const blueMixerCode = this.generateBlueMixer(
      sourceChannels,
      subChannels,
      channelIdAssignments,
      nchnls,
      effectIdMap,
      mixer,
    );
    instrBuffer.push(blueMixerCode);

    return {
      effectUDOs,
      instrumentsText: instrBuffer.join("\n"),
      effectIdMap,
    };
  }

  /**
   * Generate the BlueMixer instrument.
   * Routes audio through volumes, sends, effect UDOs, and outputs via outc.
   */
  private generateBlueMixer(
    sourceChannels: Channel[],
    subChannels: Channel[],
    channelIdAssignments: Map<Channel, number>,
    nchnls: number,
    effectIdMap: Map<Effect, number>,
    mixer: Mixer = this.mixer,
  ): string {
    const lines: string[] = [];

    lines.push("\tinstr BlueMixer\t;Blue Mixer Instrument");

    // Process each source channel
    for (const channel of sourceChannels) {
      const channelId = channelIdAssignments.get(channel);
      if (channelId === undefined) continue;
      const signalVars = this.getSourceSignalVars(channelId, nchnls);

      this.applyEffectsChain(channel.getPreEffects(), signalVars, effectIdMap, lines);
      this.applyChannelLevel(signalVars, channel.getLevelParameter(), channel.getLevel(), lines);
      this.applyEffectsChain(channel.getPostEffects(), signalVars, effectIdMap, lines);
      this.routeChannelOutput(signalVars, channel.getOutChannel(), channel.getName(), lines);
    }

    // Process sub-channels
    for (const subChannel of subChannels) {
      const signalVars = this.getSubChannelSignalVars(subChannel.getName(), nchnls);

      this.applyEffectsChain(subChannel.getPreEffects(), signalVars, effectIdMap, lines);
      this.applyChannelLevel(signalVars, subChannel.getLevelParameter(), subChannel.getLevel(), lines);
      this.applyEffectsChain(subChannel.getPostEffects(), signalVars, effectIdMap, lines);
      this.routeChannelOutput(signalVars, subChannel.getOutChannel(), subChannel.getName(), lines);
    }

    const masterChannel = mixer.getMaster();
    const masterVars = this.getSubChannelSignalVars("Master", nchnls);
    this.applyEffectsChain(masterChannel.getPreEffects(), masterVars, effectIdMap, lines);
    this.applyChannelLevel(masterVars, masterChannel.getLevelParameter(), masterChannel.getLevel(), lines);
    this.applyEffectsChain(masterChannel.getPostEffects(), masterVars, effectIdMap, lines);
    lines.push(`outc ${masterVars.join(", ")}`);

    // Clear all audio variables
    for (const channel of sourceChannels) {
      const channelId = channelIdAssignments.get(channel);
      if (channelId === undefined) continue;
      for (const signalVar of this.getSourceSignalVars(channelId, nchnls)) {
        lines.push(`${signalVar} = 0`);
      }
    }
    for (const subChannel of subChannels) {
      for (const signalVar of this.getSubChannelSignalVars(subChannel.getName(), nchnls)) {
        lines.push(`${signalVar} = 0`);
      }
    }
    for (const signalVar of masterVars) {
      lines.push(`${signalVar} = 0`);
    }

    lines.push("");
    lines.push("\tendin");
    lines.push("");

    return lines.join("\n");
  }

  private applyEffectsChain(
    chain: EffectsChain,
    signalVars: string[],
    effectIdMap: Map<Effect, number>,
    lines: string[],
  ): void {
    for (const item of chain) {
      if (item instanceof Effect) {
        if (!item.isEnabled()) {
          continue;
        }

        const effectId = effectIdMap.get(item);
        if (effectId === undefined) {
          continue;
        }

        if (item.getStyle() === UDOStyle.MODERN) {
          lines.push(`${signalVars.join(", ")} = blueEffect${effectId}(${signalVars.join(", ")})`);
        } else {
          lines.push(`${signalVars.join(", ")}\tblueEffect${effectId}\t${signalVars.join(", ")}`);
        }
        continue;
      }

      if (!item.isEnabled()) {
        continue;
      }

      const targetName = item.getSendChannel() || "Master";
      const amountExpr = this.getSendAmountExpression(item);

      for (let i = 0; i < signalVars.length; i++) {
        const targetVar = this.getSubChannelVar(targetName, i);
        lines.push(`${targetVar}\t+=\t${this.scaleSignal(signalVars[i], amountExpr)}`);
      }
    }
  }

  private applyChannelLevel(
    signalVars: string[],
    levelParam: Parameter,
    fallbackLevel: number,
    lines: string[],
  ): void {
    const compilationVarName = levelParam.getCompilationVarName();
    if (compilationVarName) {
      lines.push(`ktempdb = ampdb(${compilationVarName})`);
      for (const signalVar of signalVars) {
        lines.push(`${signalVar} *= ktempdb`);
      }
      return;
    }

    const multiplier = Math.pow(10, fallbackLevel / 20);
    if (Math.abs(multiplier - 1.0) <= 0.0001) {
      return;
    }

    for (const signalVar of signalVars) {
      lines.push(`${signalVar} *= ${multiplier}`);
    }
  }

  private routeChannelOutput(
    signalVars: string[],
    outChannel: string,
    channelName: string,
    lines: string[],
  ): void {
    const resolvedOutChannel = outChannel || "Master";
    if (resolvedOutChannel === channelName) {
      return;
    }

    for (let i = 0; i < signalVars.length; i++) {
      lines.push(`${this.getSubChannelVar(resolvedOutChannel, i)}\t+=\t${signalVars[i]}`);
    }
  }

  private getSendAmountExpression(send: Send): string {
    const levelParam = send.getLevelParameter();
    const compilationVarName = levelParam.getCompilationVarName();
    if (compilationVarName) {
      return compilationVarName;
    }

    return send.getLevel().toString();
  }

  private scaleSignal(signalVar: string, amountExpr: string): string {
    if (amountExpr === "1" || amountExpr === "1.0") {
      return signalVar;
    }

    return `(${signalVar} * ${amountExpr})`;
  }

  private getSourceSignalVars(channelId: number, nchnls: number): string[] {
    const signalVars: string[] = [];
    for (let i = 0; i < nchnls; i++) {
      signalVars.push(`ga_bluemix_${channelId}_${i}`);
    }
    return signalVars;
  }

  private getSubChannelSignalVars(channelName: string, nchnls: number): string[] {
    const signalVars: string[] = [];
    for (let i = 0; i < nchnls; i++) {
      signalVars.push(this.getSubChannelVar(channelName, i));
    }
    return signalVars;
  }

  private getSubChannelVar(channelName: string, outputIndex: number): string {
    const safeName = channelName === "Master"
      ? "Master"
      : channelName.replace(/\s+/g, "_");
    return `ga_bluesub_${safeName}_${outputIndex}`;
  }

  private sortSubChannelsForRendering(
    subChannels: Channel[],
  ): Channel[] {
    const byName = new Map(subChannels.map(channel => [channel.getName(), channel]));
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const ordered: Channel[] = [];

    const visit = (channel: Channel) => {
      const name = channel.getName();
      if (visited.has(name) || visiting.has(name)) {
        return;
      }

      visiting.add(name);

      const targets = new Set<string>();
      const outChannel = channel.getOutChannel();
      if (outChannel && outChannel !== "Master" && outChannel !== name && byName.has(outChannel)) {
        targets.add(outChannel);
      }

      for (const send of channel.getSends()) {
        const target = send.getSendChannel();
        if (target && target !== "Master" && target !== name && byName.has(target)) {
          targets.add(target);
        }
      }

      for (const target of targets) {
        visit(byName.get(target)!);
      }

      visiting.delete(name);
      visited.add(name);
      ordered.push(channel);
    };

    for (const channel of subChannels) {
      visit(channel);
    }

    return ordered.reverse();
  }

  private registerNestedEffectOpcodes(
    effect: Effect,
    nestedOpcodes: OpcodeList,
    effectUDOs: string[],
  ): Map<string, string> {
    const replacements = new Map<string, string>();
    const pending = effect.getOpcodeList()
      .getOpcodes()
      .map(opcode => opcode.deepCopy() as OpcodeDefinition);

    for (const opcode of pending) {
      const originalName = opcode.getName();
      const existingEquivalent = nestedOpcodes.getNameOfEquivalentCopy(opcode);
      if (existingEquivalent) {
        replacements.set(originalName, existingEquivalent);
        continue;
      }

      if (!nestedOpcodes.isNameUnique(originalName)) {
        const uniqueName = nestedOpcodes.getUniqueName();
        replacements.set(originalName, uniqueName);
        opcode.setName(uniqueName);
      }
    }

    for (const opcode of pending) {
      const originalName = [...replacements.entries()]
        .find(([, replacement]) => replacement === opcode.getName())?.[0]
        ?? opcode.getName();

      if (replacements.has(originalName) && replacements.get(originalName) !== opcode.getName()) {
        // Already renamed above.
      }

      opcode.setCode(
        this.applyOpcodeNameReplacements(opcode.getCode(), replacements),
      );

      const existingEquivalent = nestedOpcodes.getNameOfEquivalentCopy(opcode);
      if (existingEquivalent) {
        replacements.set(originalName, existingEquivalent);
        continue;
      }

      if (!nestedOpcodes.isNameUnique(opcode.getName())) {
        continue;
      }

      nestedOpcodes.addOpcode(opcode);
      effectUDOs.push(opcode.generateCode());
    }

    return replacements;
  }

  private applyOpcodeNameReplacements(
    source: string,
    replacements: Map<string, string>,
  ): string {
    let output = source;
    for (const [from, to] of replacements) {
      if (!from || from === to) {
        continue;
      }

      const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      output = output.replace(new RegExp(`\\b${escaped}\\b`, "g"), to);
    }
    return output;
  }

  // ─── DeepCopy ───

  deepCopy(): BlueDataObject {
    const copy = new BlueData();
    copy.version = this.version;
    copy.arrangement = new Arrangement(this.arrangement);
    copy.projectProperties = new ProjectProperties(this.projectProperties);
    copy.sObjLib = this.sObjLib;
    copy.instrumentLibrary = this.instrumentLibrary;
    copy.globalOrcSco = new GlobalOrcSco(this.globalOrcSco);
    copy.tableSet = new Tables(this.tableSet);
    copy.score = new Score(this.score);
    copy.liveData = this.liveData;
    copy.scratchData = new ScratchPadData(this.scratchData);
    copy.noteProcessorChainMap = new NoteProcessorChainMap(this.noteProcessorChainMap);
    copy.markersList = new MarkersList(this.markersList);
    copy.midiInputProcessor = new MidiInputProcessor(this.midiInputProcessor);
    copy.mixer = this.mixer.deepCopy() as Mixer;
    copy.opcodeList = this.opcodeList;
    copy.renderStartTime = this.renderStartTime;
    copy.renderEndTime = this.renderEndTime;
    copy.loopRendering = this.loopRendering;
    copy.pluginDataXml = this.pluginDataXml.map(e => e.clone());

    // Wire projectProperties into score.timeContext (Java parity)
    copy.score.getTimeContext().setSampleRate(
      parseInt(copy.projectProperties.sampleRate, 10) || 44100
    );

    return copy;
  }
}

function appendFtgenTableNumbers(globalOrc: string, tables: Tables): void {
  const pattern = /ftgen\s+-?(\d+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(globalOrc)) !== null) {
    const ftgenNum = parseInt(match[1] ?? '0', 10);
    if (ftgenNum !== 0) {
      tables.addFtgenNumber(ftgenNum);
    }
  }
}

function getBlueLiveAlwaysOnInstrumentId(
  arrangementId: string | null | undefined,
  arrangementItemCount: number,
  arrangementIndex: number,
): string {
  const trimmedId = arrangementId?.trim() ?? '';
  if (/^\d+$/.test(trimmedId)) {
    return String(arrangementItemCount + arrangementIndex + 1);
  }

  return `${trimmedId || 'unknown'}_alwaysOn`;
}
