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
import { Element } from './serialization/xml-reader';
import { ObjRefSaveMap } from './serialization/obj-ref-map';
import { BLUE_VERSION } from './blue-constants';
import { Arrangement } from './arrangement';
import { ProjectProperties } from './project-properties';
import { SoundObjectLibrary } from './sound-objects/sound-object-library';
import { GlobalOrcSco } from './global-orc-sco';
import { Tables } from './tables';
import { LiveData } from './live-data';
import { Score } from './score/score';
import { ScratchPadData } from './scratch-pad-data';
import { NoteProcessorChainMap } from './note-processors/note-processor-chain-map';
import { MarkersList } from './markers-list';
import { MidiInputProcessor } from './midi/midi-input-processor';
import { InstrumentLibrary } from './instruments/instrument-library';
import { BlueDataObject } from './blue-data-object';
import type { CopyMode, DeepCopyable, HistoryCopyable } from './deep-copyable';
import { NoteList } from './sound-objects/note-list';
import { Mixer } from './mixer/mixer';
import { OpcodeList } from './opcodes/opcode-list';
import type { JavaScriptSession } from './javascript-runtime';
import { type JavaRuntimeClientContract } from './java-runtime';
import {
  ClojureProjectData,
  loadClojureProjectDataFromPluginData,
  replaceClojureProjectDataInPluginData,
} from './plugins/clojure-project-data';
import { Instance } from './sound-objects/instance';
import { PolyObject } from './sound-objects/poly-object';
import { TrackLayerGroup } from './score/track/track-layer-group';
import { PatternsLayerGroup } from './score/patterns/patterns-layer-group';
import { AudioClip } from './score/audio/audio-clip';
import { FrozenSoundObject } from './sound-objects/frozen-sound-object';
import type { SoundObject } from './sound-objects/sound-object';
import './sound-objects/register-sound-object-types';

import { loadFromString, saveAsXML, saveToString } from './blue-data/xml-policy';
import type { XmlDiagnosticSink } from './serialization/xml-load';
export {
  buildStandardCSD,
  buildStandardCSDAsync,
  toBlueLiveCSD,
  toBlueLiveCSDAsync,
} from './blue-data/csd-policy';
import {
  buildStandardCSD,
  buildStandardCSDAsync,
  buildScoreText,
  toBlueLiveCSD,
  toBlueLiveCSDAsync,
} from './blue-data/csd-policy';
import type { RenderCsdResult } from './blue-data/csd-policy';
export type { RenderCsdResult };
export type {
  CompiledMeterChannelBinding,
  CompiledMixerGateBinding,
  CompiledMixerGateBindings,
  CompiledMixerGateLocator,
  MeterBindingMap,
} from './compile-data';
export type { TrackLayerMuteSoloMode } from './score/score';
export { isTrackLayerMuteSoloMode } from './score/score';
export { hasLegacyMixerStateAtLoad, markLegacyMixerStateAtLoad } from './blue-data/xml-policy';
import { processOnLoad, processOnLoadAsync, usesJavaRuntime } from './blue-data/runtime-policy';
import type { AudioLayoutManifest } from './score/audio/audio-layout';

/**
 * Canonical in-memory model for a Blue composition project, matching Java Blue's `BlueData`.
 *
 * Aggregates project properties, arrangement, mixer, sound object library, optional instrument library,
 * global orchestra/score, F-tables, opcodes, score, Blue Live data, scratch pad data, note processor
 * chains, markers, MIDI input settings, render window/loop state, and opaque/Clojure `pluginData`.
 *
 * - **XML loading & saving**: `BlueData.loadFromString()`, `readProjectXml()`, `saveAsXML()`, and
 *   `saveToString()` operate purely in memory without touching disk and never execute project scripts.
 *   Use `readProjectXml()` when you want a non-throwing `XmlLoadResult<BlueData>` with source attribution
 *   and full diagnostics; `BlueData.loadFromString()` throws `XmlLoadError` on errors or on accepted
 *   warnings when no `XmlDiagnosticSink` is provided.
 * - **JavaScript runtime (QuickJS)**: Before compiling projects that contain `JavaScriptObject` or
 *   JavaScript `ObjectBuilder` scripts (`toCSD*`, `toDiskCSD*`, `toRealtimePlaybackCSD*`, `toBlueLiveCSD*`),
 *   await `initializeJavaScriptRuntime()` once (or provide a `JavaScriptSession` created after it).
 * - **Java-backed runtime (Clojure / Jython)**: `@blue/data` stays browser-safe and never spawns Java
 *   directly. When `usesJavaRuntime()` returns `true`, pass a host-injected `JavaRuntimeClientContract`
 *   to `processOnLoadAsync()`, `toCSDAsync()`, `toDiskCSDAsync()`, `toRealtimePlaybackCSDAsync()`, or
 *   `toBlueLiveCSDAsync()`.
 */
export class BlueData implements BlueDataObject, DeepCopyable<BlueData>, HistoryCopyable<BlueData> {
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
    this.score
      .getTimeContext()
      .setSampleRate(parseInt(this.projectProperties.sampleRate, 10) || 44100);
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
    return this.pluginDataXml.map((element) => element.clone());
  }

  getClojureProjectData(): ClojureProjectData | null {
    return loadClojureProjectDataFromPluginData(this.pluginDataXml);
  }

  setClojureProjectData(projectData: ClojureProjectData | null): void {
    this.pluginDataXml = replaceClojureProjectDataInPluginData(this.pluginDataXml, projectData);
  }

  // ─── Loading ───

  /**
   * Strict convenience loader that parses, validates, and migrates a `.blue` project XML string
   * using the `'in-memory project'` source.
   *
   * Never executes project scripts (`processOnLoad` / `processOnLoadAsync` must be called separately).
   * Throws `XmlLoadError` on XML/validation errors **or** when accepted XML emits `'warning'`
   * diagnostics and no `sink` callback is supplied.
   *
   * Prefer `readProjectXml()` when callers want a non-throwing `XmlLoadResult<BlueData>` with custom
   * `XmlSource` attribution and direct inspection of warnings/errors.
   *
   * @param xmlString Raw `.blue` project XML text.
   * @param sink Optional diagnostic callback invoked when accepted XML produces warnings.
   * @returns Loaded and migrated `BlueData` instance.
   */
  static loadFromString(xmlString: string, sink?: XmlDiagnosticSink): BlueData {
    return loadFromString(xmlString, () => new BlueData(), sink);
  }

  // ─── Saving ───

  /**
   * Serializes this project to a detached `<blueData>` XML {@link Element} tree without touching disk.
   *
   * Normalizes the root `version` attribute to {@link BLUE_VERSION}, writes sections in Java-compatible
   * root ordering, resolves cross-references via `objRefMap` when provided, and clones preserved
   * `pluginData` children so external tree mutations do not mutate this project.
   *
   * @param objRefMap Optional object-reference map shared across serialized project elements.
   * @returns Root `<blueData>` XML element tree.
   */
  saveAsXML(objRefMap?: ObjRefSaveMap): Element {
    return saveAsXML(this, objRefMap);
  }

  /**
   * Serializes this project to a canonical `.blue` XML string in memory without touching disk.
   *
   * Delegates to {@link saveAsXML} with a fresh {@link ObjRefSaveMap}, normalizing the root `version`
   * attribute to {@link BLUE_VERSION}, using Java-compatible root section ordering, and cloning
   * preserved `pluginData` children.
   *
   * @returns Canonical `.blue` XML text.
   */
  saveToString(): string {
    return saveToString(this);
  }

  // ─── CSD Generation ───

  /**
   * Synchronously compiles a render snapshot of this project into a Csound `.csd` string using the
   * `'realtime'` profile (`emitMetering = false`), without mutating this `BlueData` instance.
   *
   * If the project uses `JavaScriptObject` (or JavaScript `ObjectBuilder`) scripts, callers must first
   * await `initializeJavaScriptRuntime()` (or pass a `JavaScriptSession` created after initialization).
   * Synchronous compilation cannot execute Java-backed Clojure or Jython code; use {@link toCSDAsync}
   * with a host-injected {@link JavaRuntimeClientContract} when {@link usesJavaRuntime} is `true`.
   *
   * @param session Optional QuickJS session shared across script evaluations.
   * @param layoutManifest Optional host-observed audio file channel layout manifest for track panning.
   * @returns Generated Csound `.csd` document text.
   */
  toCSD(session?: JavaScriptSession, layoutManifest?: AudioLayoutManifest | null): string {
    return buildStandardCSD(this, 'realtime', session, false, layoutManifest).csdText;
  }

  /**
   * Asynchronously compiles a render snapshot of this project into a Csound `.csd` string using the
   * `'realtime'` profile (`emitMetering = false`).
   *
   * Uses QuickJS (initialized via `initializeJavaScriptRuntime()` / optional `session`) for JavaScript
   * score generation and a host-injected `runtimeClient` ({@link JavaRuntimeClientContract}) for
   * Java-backed `ClojureObject`, `PythonObject`, Python `ObjectBuilder`, `PythonInstrument`, and
   * `PythonProcessor` execution.
   *
   * @param session Optional QuickJS session shared across script evaluations.
   * @param runtimeClient Host-provided Java runtime client for Clojure/Jython evaluation.
   * @param layoutManifest Optional host-observed audio file channel layout manifest for track panning.
   * @returns Promise resolving to the generated Csound `.csd` document text.
   */
  async toCSDAsync(
    session?: JavaScriptSession,
    runtimeClient?: JavaRuntimeClientContract | null,
    layoutManifest?: AudioLayoutManifest | null,
  ): Promise<string> {
    return (
      await buildStandardCSDAsync(this, 'realtime', session, runtimeClient, false, layoutManifest)
    ).csdText;
  }

  /**
   * Synchronously compiles a render snapshot of this project into a Csound `.csd` string using the
   * `'disk'` render profile (disk sample rate/ksmps/channels/0dbfs, disk render window, parameter
   * automation score notes, fixed mixer pruning of inaudible tracks, and no realtime metering).
   *
   * Requires prior `initializeJavaScriptRuntime()` (or an initialized `session`) for `JavaScriptObject`
   * scripts. Use {@link toDiskCSDAsync} with a host-injected {@link JavaRuntimeClientContract} when
   * {@link usesJavaRuntime} is `true`.
   *
   * @param session Optional QuickJS session shared across script evaluations.
   * @param layoutManifest Optional host-observed audio file channel layout manifest for track panning.
   * @returns Generated disk-render Csound `.csd` document text.
   */
  toDiskCSD(session?: JavaScriptSession, layoutManifest?: AudioLayoutManifest | null): string {
    return buildStandardCSD(this, 'disk', session, false, layoutManifest).csdText;
  }

  /**
   * Asynchronously compiles a render snapshot of this project into a Csound `.csd` string using the
   * `'disk'` render profile.
   *
   * Asynchronous counterpart to {@link toDiskCSD}, accepting a host-injected `runtimeClient`
   * ({@link JavaRuntimeClientContract}) for Java-backed Clojure and Jython instruments, sound objects,
   * and note processors alongside QuickJS (`initializeJavaScriptRuntime()` / optional `session`).
   *
   * @param session Optional QuickJS session shared across script evaluations.
   * @param runtimeClient Host-provided Java runtime client for Clojure/Jython evaluation.
   * @param layoutManifest Optional host-observed audio file channel layout manifest for track panning.
   * @returns Promise resolving to the generated disk-render Csound `.csd` document text.
   */
  async toDiskCSDAsync(
    session?: JavaScriptSession,
    runtimeClient?: JavaRuntimeClientContract | null,
    layoutManifest?: AudioLayoutManifest | null,
  ): Promise<string> {
    return (
      await buildStandardCSDAsync(this, 'disk', session, runtimeClient, false, layoutManifest)
    ).csdText;
  }

  /**
   * Synchronously compiles a `'realtime'` render snapshot into a full {@link RenderCsdResult}
   * containing `csdText`, automation `parameters`, `stringChannels`, `blueX7Bindings`, optional
   * `meterBindingMap` (when `emitMetering` is `true` and the mixer is enabled), `mixerGateBindings`,
   * and `pannerBindings`.
   *
   * Requires prior `initializeJavaScriptRuntime()` (or an initialized `session`) for `JavaScriptObject`
   * scripts. Use {@link toRealtimePlaybackCSDAsync} with a host-injected {@link JavaRuntimeClientContract}
   * when {@link usesJavaRuntime} is `true`.
   *
   * @param session Optional QuickJS session shared across script evaluations.
   * @param emitMetering Whether to emit mixer RMS/peak meter channels and `meterBindingMap`.
   * @param layoutManifest Optional host-observed audio file channel layout manifest for track panning.
   * @returns Compiled CSD text and disposable engine runtime bindings.
   */
  toRealtimePlaybackCSD(
    session?: JavaScriptSession,
    emitMetering = false,
    layoutManifest?: AudioLayoutManifest | null,
  ): RenderCsdResult {
    return buildStandardCSD(this, 'realtime', session, emitMetering, layoutManifest);
  }

  /**
   * Asynchronously compiles a `'realtime'` render snapshot into a full {@link RenderCsdResult}.
   *
   * Asynchronous counterpart to {@link toRealtimePlaybackCSD}, accepting a host-injected `runtimeClient`
   * ({@link JavaRuntimeClientContract}) for Java-backed Clojure and Jython evaluation alongside QuickJS
   * (`initializeJavaScriptRuntime()` / optional `session`).
   *
   * @param session Optional QuickJS session shared across script evaluations.
   * @param runtimeClient Host-provided Java runtime client for Clojure/Jython evaluation.
   * @param emitMetering Whether to emit mixer RMS/peak meter channels and `meterBindingMap`.
   * @param layoutManifest Optional host-observed audio file channel layout manifest for track panning.
   * @returns Promise resolving to compiled CSD text and disposable engine runtime bindings.
   */
  async toRealtimePlaybackCSDAsync(
    session?: JavaScriptSession,
    runtimeClient?: JavaRuntimeClientContract | null,
    emitMetering = false,
    layoutManifest?: AudioLayoutManifest | null,
  ): Promise<RenderCsdResult> {
    return buildStandardCSDAsync(
      this,
      'realtime',
      session,
      runtimeClient,
      emitMetering,
      layoutManifest,
    );
  }

  /**
   * Synchronously compiles a Blue Live performance {@link RenderCsdResult} with always-on instruments,
   * `blueAllNotesOff`, live mixer gate/panner bindings, MIDI instrument target mappings, and optional
   * metering.
   *
   * Requires prior `initializeJavaScriptRuntime()` (or an initialized `session`) for `JavaScriptObject`
   * scripts. Use {@link toBlueLiveCSDAsync} with a host-injected {@link JavaRuntimeClientContract} when
   * Java-backed orchestra generation (such as `PythonInstrument`) is required.
   *
   * @param session Optional QuickJS session shared across script evaluations.
   * @param emitMetering Whether to emit mixer RMS/peak meter channels and `meterBindingMap`.
   * @param layoutManifest Optional host-observed audio file channel layout manifest for track panning.
   * @returns Compiled Blue Live CSD text and disposable engine runtime bindings.
   */
  toBlueLiveCSD(
    session?: JavaScriptSession,
    emitMetering = false,
    layoutManifest?: AudioLayoutManifest | null,
  ): RenderCsdResult {
    return toBlueLiveCSD(this, session, emitMetering, layoutManifest);
  }

  /**
   * Asynchronously compiles a Blue Live performance {@link RenderCsdResult}.
   *
   * Asynchronous counterpart to {@link toBlueLiveCSD}, passing `runtimeClient`
   * ({@link JavaRuntimeClientContract}) for asynchronous orchestra generation (such as `PythonInstrument`).
   *
   * @param session Optional QuickJS session shared across script evaluations.
   * @param runtimeClient Host-provided Java runtime client for Java-backed orchestra generation.
   * @param emitMetering Whether to emit mixer RMS/peak meter channels and `meterBindingMap`.
   * @param layoutManifest Optional host-observed audio file channel layout manifest for track panning.
   * @returns Promise resolving to compiled Blue Live CSD text and disposable engine runtime bindings.
   */
  async toBlueLiveCSDAsync(
    session?: JavaScriptSession,
    runtimeClient?: JavaRuntimeClientContract | null,
    emitMetering = false,
    layoutManifest?: AudioLayoutManifest | null,
  ): Promise<RenderCsdResult> {
    return toBlueLiveCSDAsync(this, session, runtimeClient, emitMetering, layoutManifest);
  }

  /**
   * Synchronously executes `onLoadProcessable` scripts across the score (`PolyObject`, `TrackLayerGroup`)
   * and `LiveData` bins.
   *
   * Executes `JavaScriptObject` on-load scripts only when a {@link JavaScriptSession} (created after
   * `initializeJavaScriptRuntime()`) is supplied. Clojure and Python on-load scripts are skipped with a
   * console warning in synchronous mode; use {@link processOnLoadAsync} with a host-injected
   * {@link JavaRuntimeClientContract} to execute them.
   *
   * @param session Optional QuickJS session used to retain on-load JavaScript definitions.
   */
  processOnLoad(session?: JavaScriptSession): void {
    processOnLoad(this, session);
  }

  /**
   * Asynchronously executes `onLoadProcessable` scripts across the score (`PolyObject`, `TrackLayerGroup`)
   * and `LiveData` bins.
   *
   * Asynchronous counterpart to {@link processOnLoad}: runs `JavaScriptObject` on-load scripts in `session`
   * (created after `initializeJavaScriptRuntime()`) and delegates `ClojureObject` and `PythonObject`
   * on-load scripts to the host-injected `runtimeClient` ({@link JavaRuntimeClientContract}).
   *
   * @param session Optional QuickJS session used to retain on-load JavaScript definitions.
   * @param runtimeClient Host-provided Java runtime client for Clojure/Jython on-load evaluation.
   */
  async processOnLoadAsync(
    session?: JavaScriptSession,
    runtimeClient?: JavaRuntimeClientContract | null,
  ): Promise<void> {
    await processOnLoadAsync(this, session, runtimeClient);
  }

  /**
   * Reports whether this project contains any entities whose execution requires a host-injected
   * {@link JavaRuntimeClientContract} (`ClojureObject`, `PythonObject`, Python/Clojure `ObjectBuilder`,
   * `PythonInstrument`, or `PythonProcessor`) across the score, `SoundObjectLibrary`, `Arrangement`,
   * note processor chains, or `LiveData` bins.
   *
   * @returns `true` if async compilation/on-load flows require a Java runtime client; otherwise `false`.
   */
  usesJavaRuntime(): boolean {
    return usesJavaRuntime(this);
  }

  private buildScoreText(ftables: string, globalSco: string, notes: NoteList): string {
    return buildScoreText(this, ftables, globalSco, notes);
  }

  // ─── DeepCopy ───

  deepCopy(mode: CopyMode = 'duplication'): BlueData {
    return this.cloneProject(mode, true);
  }

  /** @internal Copy project state with an empty root PolyObject for isolated single-object freeze rendering. */
  deepCopyWithoutScoreLayers(mode: CopyMode = 'duplication'): BlueData {
    return this.cloneProject(mode, false);
  }

  private cloneProject(mode: CopyMode, copyScoreLayers: boolean): BlueData {
    const copy = new BlueData();
    copy.version = this.version;
    copy.arrangement = new Arrangement(this.arrangement, mode);
    copy.projectProperties = new ProjectProperties(this.projectProperties);

    // Deep-copy the SoundObject library and seed an original→copy map so that
    // copied Instance references can be remapped to copied library objects.
    const originalLibraryObjects = this.sObjLib.getAllObjects();
    copy.sObjLib = new SoundObjectLibrary(this.sObjLib, mode);
    const copiedLibraryObjects = copy.sObjLib.getAllObjects();
    const libraryRemap = new Map<SoundObject, SoundObject>();
    for (let i = 0; i < originalLibraryObjects.length; i++) {
      libraryRemap.set(originalLibraryObjects[i]!, copiedLibraryObjects[i]!);
    }

    // Deep-copy instrument library (was previously aliased by reference).
    copy.instrumentLibrary = this.instrumentLibrary ? this.instrumentLibrary.deepCopy(mode) : null;

    copy.globalOrcSco = new GlobalOrcSco(this.globalOrcSco);
    copy.tableSet = new Tables(this.tableSet);
    copy.score = new Score(this.score, mode, copyScoreLayers);

    // Deep-copy Live Data (was previously aliased by reference).
    copy.liveData = this.liveData.deepCopy(mode) as LiveData;

    copy.scratchData = new ScratchPadData(this.scratchData);
    copy.noteProcessorChainMap = new NoteProcessorChainMap(this.noteProcessorChainMap);
    copy.markersList = new MarkersList(this.markersList);
    copy.midiInputProcessor = new MidiInputProcessor(this.midiInputProcessor);
    copy.mixer = this.mixer.deepCopy(mode) as Mixer;

    // Deep-copy opcode definitions (was previously aliased by reference).
    copy.opcodeList = new OpcodeList(this.opcodeList);

    copy.renderStartTime = this.renderStartTime;
    copy.renderEndTime = this.renderEndTime;
    copy.loopRendering = this.loopRendering;
    copy.pluginDataXml = this.pluginDataXml.map((e) => e.clone());

    // Remap any copied Instance that still references an original library
    // object to point at the corresponding copied library object. This keeps
    // whole-project copies internally coherent without retaining references
    // into the canonical graph.
    if (libraryRemap.size > 0) {
      const seen = new Set<SoundObject>();
      for (const soundObject of copy.sObjLib.getAllObjects()) {
        remapInstanceReferencesInSoundObject(soundObject, libraryRemap, seen);
      }
      if (copyScoreLayers) {
        remapInstanceReferences(copy.score, libraryRemap, seen);
      }
      remapInstanceReferencesInLiveData(copy.liveData, libraryRemap, seen);
    }

    // Wire projectProperties into score.timeContext (Java parity)
    copy.score
      .getTimeContext()
      .setSampleRate(parseInt(copy.projectProperties.sampleRate, 10) || 44100);

    return copy;
  }

  historyCopy(): BlueData {
    return this.deepCopy('history') as BlueData;
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
    } else if (layerGroup instanceof TrackLayerGroup) {
      for (const track of layerGroup) {
        for (const item of track) {
          if (!(item instanceof AudioClip))
            remapInstanceReferencesInSoundObject(item, libraryRemap, seen);
        }
      }
    } else if (layerGroup instanceof PatternsLayerGroup) {
      for (const layer of layerGroup) {
        remapInstanceReferencesInSoundObject(layer.getSoundObject(), libraryRemap, seen);
      }
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
      // Instance presentation fields belong to the placement; only rebind its target.
      soundObject.setSoundObject(libraryRemap.get(referenced)!);
    }
    const copiedReference = soundObject.getSoundObject();
    if (copiedReference) {
      remapInstanceReferencesInSoundObject(copiedReference, libraryRemap, seen);
    }
    return;
  }

  if (soundObject instanceof FrozenSoundObject) {
    const nested = soundObject.getFrozenSoundObject();
    if (nested) remapInstanceReferencesInSoundObject(nested, libraryRemap, seen);
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
