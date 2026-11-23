import { Instrument } from './instruments/instrument';
import { Arrangement } from './arrangement';
import { Tables } from './tables';
import { Channel } from './mixer/channel';
import { Parameter } from './automation/parameter';
import type { AudioLayoutManifest } from './score/audio/audio-layout';
import {
  DEFAULT_PAN_LAW_DB,
  DEFAULT_PAN_OFF_CENTER_BOOST,
  type PanLawDb,
} from './mixer/channel-pan';

/** Allocated string channel and initial value for a single compile. */
export interface StringChannelEntry {
  /** Widget object name associated with this channel. */
  objectName: string;
  /** Initial string value sent to Csound. */
  value: string;
  /** Generated Csound channel name for the string. */
  channelName: string;
}

/**
 * Disposable compiled MIDI target (Spec 067). Describes exactly the enabled base
 * instruments generated into one Blue Live CSD snapshot, keyed by stable project
 * identity rather than row position or MIDI channel. This is derived render output
 * only; it is never serialized into `.blue` XML.
 */
export type CompiledMidiInstrumentTarget =
  | {
      /** Discriminant identifying the `track` variant. */
      kind: 'track';
      /** Persistent identifier of the owning score track. */
      trackId: string;
      /** Csound instrument ID assigned for this render. */
      runtimeInstrumentId: number | string;
    }
  | {
      /** Discriminant identifying the `orchestra` variant. */
      kind: 'orchestra';
      /** Project identifier of the orchestra assignment. */
      assignmentId: string;
      /** Csound instrument ID assigned for this render. */
      runtimeInstrumentId: number | string;
    };

/**
 * Compiled BlueX7 binding — disposable per-render routing for one arrangement
 * or Track BlueX7 owner (Spec 092). All names/ids derive from compilation
 * allocation, never instrument display names. Channels are keyed by the
 * stable semantic catalog name, not the snapshot's uniqueId: render snapshot
 * deep copies regenerate Parameter identities, so the semantic name is the
 * deterministic cross-copy equivalent the runtime resolves through.
 * Bindings live in the render-scoped compilation-variable registry: a new
 * CompileData (fresh render/engine rebuild) or reset() invalidates every
 * binding. Bindings are never serialized into `.blue` XML.
 */
export interface CompiledBlueX7Binding {
  /** Stable location identity (never a display name). */
  ownerIdentity: string;
  /** Csound instrument ID allocated to this compiled BlueX7 instance. */
  runtimeInstrumentId: string | number;
  /** Semantic parameter key -> compiled automation channel (gk_blue_autoN). */
  parameterChannels: ReadonlyMap<string, string>;
  /** Direct `chnexport` globals consumed by the generated target. */
  directGlobalChannels: ReadonlyMap<string, string>;
  /** Per-instance epoch incremented by the generated change coordinator. */
  domainEpoch: string;
}

/**
 * Disposable compiled mixer meter binding (Spec 104).
 * Connects compile-time CSD channel key to Channel object, UI strip ID, and category.
 * Derived render output only; never serialized into `.blue` XML.
 */
export interface CompiledMeterChannelBinding {
  /** Mixer category of the metered channel. */
  readonly kind: 'source' | 'sub' | 'master';
  /** Key included in the generated Csound meter channel names. */
  readonly csdKey: string;
  /** Identifier used to associate meter readings with a mixer strip. */
  readonly stripId: string;
  /** Channel name captured for this render's meter display. */
  readonly displayName: string;
  /** Mixer channel from the render snapshot. */
  readonly channel: Channel;
  /** Zero-based ordinal within the source or sub channel list. Omitted for the master. */
  readonly channelIndex?: number;
}

/** Meter bindings and output channel count associated with one compiled CSD. */
export interface MeterBindingMap {
  /** Ordered meter bindings for this render. */
  readonly entries: readonly CompiledMeterChannelBinding[];
  /** Number of output audio channels in the compiled CSD. */
  readonly nchnls: number;
}

/**
 * Disposable compiled mixer gate binding (Spec 111). Describes one mute/solo
 * audio gate compiled into a realtime CSD: its deterministic ordinal, the two
 * bank channels the engine stages values into, the initial 0/1 target, and a
 * locator tying the gate back to the mixer route it gates. Derived render
 * output only; never serialized into `.blue` XML.
 */
export interface CompiledMixerGateBinding {
  /** Deterministic index assigned to this gate for its compiled CSD. */
  readonly ordinal: number;
  /** Csound channel names for the two banks of staged gate targets. */
  readonly bankSymbols: readonly [string, string];
  /** Initial gain target, where zero mutes and one passes audio. */
  readonly initial: 0 | 1;
  /** Mixer output or send associated with this gate. */
  readonly locator: CompiledMixerGateLocator;
}

/** Identifies an output or a send in the mixer graph captured for a render. */
export type CompiledMixerGateLocator =
  | {
      /** Discriminant identifying the `output` variant. */
      readonly route: 'output';
      /** Assigned ordinal of the channel in the compiled mixer. */
      readonly channelOrdinal: number;
      /** Role of the channel in the mixer graph. */
      readonly channelKind: 'source' | 'sub' | 'master';
      /** Stable channel identity captured from canonical mixer data. */
      readonly channelIdentity: string;
      /** Stable route-entry identity within that channel. */
      readonly entryIdentity: string;
      /** Track/instrument association of the gated channel, '' when unset. */
      readonly association: string;
    }
  | {
      /** Discriminant identifying the `send` variant. */
      readonly route: 'send';
      /** Assigned ordinal of the channel in the compiled mixer. */
      readonly channelOrdinal: number;
      /** Role of the channel in the mixer graph. */
      readonly channelKind: 'source' | 'sub' | 'master';
      /** Stable channel identity captured from canonical mixer data. */
      readonly channelIdentity: string;
      /** Stable route-entry identity within that channel. */
      readonly entryIdentity: string;
      /** Whether this send is in the pre- or post-fader chain. */
      readonly chainKind: 'pre' | 'post';
      /** Zero-based send position in its effects chain. */
      readonly chainIndex: number;
      /** Name of the destination mixer channel. */
      readonly targetName: string;
      /** Persistent association with a project source. */
      readonly association: string;
    };

/**
 * Generation-scoped catalog of every mixer gate in one compiled CSD plus the
 * commit/applied token channels used for staged two-bank publication.
 */
export interface CompiledMixerGateBindings {
  /** Deterministic topology signature; live edits with a different topology are stale. */
  readonly signature: string;
  /** Channel used to signal that the staged gate updates are ready. */
  readonly commitChannel: string;
  /** Channel on which the engine reports the applied gate commit. */
  readonly appliedChannel: string;
  /** All output and send gates allocated for this compiled CSD. */
  readonly gates: readonly CompiledMixerGateBinding[];
}

/**
 * Disposable compiled mixer channel panner binding (Spec 113).
 * Describes runtime panner bindings for one channel in a compiled CSD snapshot:
 * mode channel name, Width, Dual Left, and Dual Right compilation variable names.
 * Derived render output only; never serialized into `.blue` XML.
 */
export interface CompiledChannelPannerBinding {
  /** Channel runtime identity preserved by the render copy; never a display name. */
  readonly channelIdentity: string;
  /** Deterministic index assigned to this channel for its compiled CSD. */
  readonly channelOrdinal: number;
  /** Mixer category for the channel owning this panner. */
  readonly channelKind: 'source' | 'sub' | 'master';
  /** Csound channel that selects the channel's panner mode. */
  readonly modeChannel: string;
  /** Generated automation variable for stereo width, when assigned. */
  readonly widthVar?: string;
  /** Generated automation variable for the left dual-pan position, when assigned. */
  readonly dualLeftVar?: string;
  /** Generated automation variable for the right dual-pan position, when assigned. */
  readonly dualRightVar?: string;
}

/**
 * Disposable compiled panner bindings catalog (Spec 113).
 * Connects compile-time CSD score law, boost, and channel mode channels
 * to generation-scoped engine channel writes.
 * Derived render output only; never serialized into `.blue` XML.
 */
export interface CompiledPannerBindings {
  /** Deterministic topology signature; live edits with a different topology are stale. */
  readonly signature: string;
  /** Csound channel that selects the score mix's pan law. */
  readonly scoreLawChannel: string;
  /** Csound channel that controls the score mix's off-center boost. */
  readonly scoreBoostChannel: string;
  /** Panner bindings for the channels compiled into this render. */
  readonly channels: readonly CompiledChannelPannerBinding[];
}

/** Render-scoped registry key for compiled BlueX7 bindings. */
export const BLUE_X7_BINDINGS_KEY = Symbol('blueX7.bindings');

/** Mutable render-scoped state for generated instruments, tables, output routing, and runtime channel allocation. */
export class CompileData {
  private arrangement: Arrangement;
  private tables: Tables;
  private channelIdAssignments = new Map<Channel, number>();
  private instrSourceId = new Map<Instrument, string>();
  private compileMap = new Map<unknown, unknown>();
  private globalOrc = '';
  private stringChannels: StringChannelEntry[] = [];
  private originalParameters: Parameter[] = [];
  private handleParametersAndChannels = false;
  // A standalone CompileData has no mixer orchestra until a render builder
  // supplies the project setting, so direct output is the safe default.
  private mixerEnabled = false;
  private panningEnabled = false;
  private panLawDb: PanLawDb = DEFAULT_PAN_LAW_DB;
  private panOffCenterBoost = DEFAULT_PAN_OFF_CENTER_BOOST;
  private audioLayoutManifest: AudioLayoutManifest | null = null;
  private nchnls = 2;
  private nextParameterIndex = 0;
  private nextStringChannelIndex = 0;
  private nextInstrumentNumber = 0;

  /** Creates an empty compilation with automation and string channel collection disabled. */
  constructor();
  /** Starts with the supplied arrangement and tables by reference. Enable `handleParameters` to assign runtime names to added parameters and string channels. */
  constructor(arrangement: Arrangement, tables: Tables, handleParameters?: boolean);
  constructor(arrangement?: Arrangement, tables?: Tables, handleParameters?: boolean) {
    this.arrangement = arrangement ?? new Arrangement();
    this.tables = tables ?? new Tables();
    this.handleParametersAndChannels = handleParameters ?? false;
  }

  /** Creates a compilation with its own empty arrangement and table set. */
  static createEmptyCompileData(): CompileData {
    return new CompileData(new Arrangement(), new Tables(), false);
  }

  /** Returns the mutable arrangement being assembled for this compilation. */
  getArrangement(): Arrangement {
    return this.arrangement;
  }

  /** Returns the mutable Csound table set being assembled for this compilation. */
  getTables(): Tables {
    return this.tables;
  }

  /** Returns the live map assigning mixer channel objects to numeric compilation IDs. */
  getChannelIdAssignments(): Map<Channel, number> {
    return this.channelIdAssignments;
  }

  /**
   * Whether the project mixer participates in this render. Channel routing in
   * generated instruments must fall back to direct output when the mixer is
   * disabled, because no BlueMixer instrument will read channel variables.
   */
  isMixerEnabled(): boolean {
    return this.mixerEnabled;
  }

  /** Sets whether generators should route output through the compiled mixer. */
  setMixerEnabled(enabled: boolean): void {
    this.mixerEnabled = enabled;
  }

  /** Reports whether the compilation uses channel panning. */
  isPanningEnabled(): boolean {
    return this.panningEnabled;
  }

  /** Sets whether the compilation uses channel panning. */
  setPanningEnabled(enabled: boolean): void {
    this.panningEnabled = enabled;
  }

  /** Returns the center attenuation in dB used when compiling panners. */
  getPanLawDb(): PanLawDb {
    return this.panLawDb;
  }

  /** Sets the center attenuation in dB used when compiling panners. */
  setPanLawDb(lawDb: PanLawDb): void {
    this.panLawDb = lawDb;
  }

  /** Reports whether the compiled panners boost levels off center. */
  isPanOffCenterBoost(): boolean {
    return this.panOffCenterBoost;
  }

  /** Selects off-center boost for the compiled panners. */
  setPanOffCenterBoost(boost: boolean): void {
    this.panOffCenterBoost = boost;
  }

  /** Returns host-supplied audio metadata, or `null` if no manifest was supplied. */
  getAudioLayoutManifest(): AudioLayoutManifest | null {
    return this.audioLayoutManifest;
  }

  /** Attaches host-supplied audio metadata for layout resolution during compilation. */
  setAudioLayoutManifest(manifest: AudioLayoutManifest | null): void {
    this.audioLayoutManifest = manifest;
  }

  /** Returns the output audio channel count used during compilation. */
  getNchnls(): number {
    return this.nchnls;
  }

  /** Sets the output audio channel count used during compilation. */
  setNchnls(nchnls: number): void {
    this.nchnls = nchnls;
  }

  /** Allocates the next numeric ID after existing and previously reserved instrument numbers. */
  reserveInstrumentNumber(): number {
    for (const assignment of this.arrangement.getArrangement()) {
      if (!/^-?\d+$/.test(assignment.arrangementId)) continue;
      const id = Number(assignment.arrangementId);
      if (Number.isInteger(id) && id > this.nextInstrumentNumber) this.nextInstrumentNumber = id;
    }
    return ++this.nextInstrumentNumber;
  }

  /** Appends a generated instrument under the supplied or allocated numeric ID and returns that ID. When collection is enabled, assigns runtime parameter and string channel names. */
  addInstrument(instr: Instrument, instrId = this.reserveInstrumentNumber()): number {
    this.arrangement.addInstrumentWithId(instr, String(instrId), false);
    if (this.handleParametersAndChannels) {
      this.collectStringChannels(instr);
      this.collectParameters(instr);
    }
    return instrId;
  }

  private collectStringChannels(instr: Instrument): void {
    const anyInstr = instr as any;
    if (typeof anyInstr.getStringChannels === 'function') {
      const channels = anyInstr.getStringChannels() as StringChannelEntry[];
      if (channels) {
        for (const sc of channels) {
          const name = `gS_blue_str${this.nextStringChannelIndex++}`;
          sc.channelName = name;
          this.stringChannels.push({
            objectName: sc.objectName,
            value: sc.value,
            channelName: name,
          });
        }
      }
    }
  }

  private collectParameters(instr: Instrument): void {
    const anyInstr = instr as any;
    if (typeof anyInstr.getParameters === 'function') {
      const params = anyInstr.getParameters() as Parameter[];
      if (params) {
        for (const p of params) {
          p.setCompilationVarName(`gk_blue_auto${this.nextParameterIndex++}`);
          this.originalParameters.push(p);
        }
      }
    }
  }

  /** Adds already allocated automation and string channels and advances the allocation counters to match. */
  registerExistingAutomationState(
    parameters: Parameter[],
    stringChannels: StringChannelEntry[],
  ): void {
    this.originalParameters.push(...parameters);
    this.stringChannels.push(...stringChannels);
    this.nextParameterIndex = this.originalParameters.length;
    this.nextStringChannelIndex = this.stringChannels.length;
  }

  /** Returns the live list of compiled string channel allocations. */
  getStringChannels(): StringChannelEntry[] {
    return this.stringChannels;
  }

  /** Returns the live list of parameters collected for compilation, including their assigned channel names. */
  getOriginalParameters(): Parameter[] {
    return this.originalParameters;
  }

  /** Reports whether adding an instrument allocates parameter and string channels. */
  isHandleParametersAndChannels(): boolean {
    return this.handleParametersAndChannels;
  }

  /** Controls allocation of parameter and string channels for subsequently added instruments. */
  setHandleParametersAndChannels(handleParametersAndChannels: boolean): void {
    this.handleParametersAndChannels = handleParametersAndChannels;
  }

  /** Retrieves an extension value scoped to the compilation, or `undefined` when absent. */
  getCompilationVariable(key: unknown): unknown {
    return this.compileMap.get(key);
  }

  /** Associates an extension value with a key for the lifetime of the compilation. */
  setCompilationVariable(key: unknown, value: unknown): void {
    this.compileMap.set(key, value);
  }

  /** Removes the extension value for the given key. */
  clearCompilationVariable(key: unknown): void {
    this.compileMap.delete(key);
  }

  /** Returns an available Csound function table number from the compilation table set. */
  getOpenFTableNumber(): number {
    return this.tables.getOpenFTableNumber();
  }

  /** Appends Csound function table definitions to the current table text. */
  appendTables(text: string): void {
    const current = this.tables.getTables();
    this.tables.setTables(current ? current + '\n' + text : text);
  }

  /** Records the project source ID of a generated instrument instance. */
  addInstrSourceId(generated: Instrument, sourceId: string): void {
    this.instrSourceId.set(generated, sourceId);
  }

  /** Resolves the project source ID recorded for this instance, or `undefined` when absent. */
  getInstrSourceId(instr: Instrument): string | undefined {
    return this.instrSourceId.get(instr);
  }

  /** Records the compiled instrument ID for a track's stable project ID. */
  setTrackInstrumentId(trackId: string, instrumentId: number | string): void {
    this.compileMap.set(`track-instrument:${trackId}`, instrumentId);
  }

  /** Record the TrackLayerGroup that owns a Track render instrument. */
  setTrackRootGroupId(trackId: string, rootGroupId: string): void {
    this.compileMap.set(`track-root-group:${trackId}`, rootGroupId);
  }

  /** Returns the recorded parent group ID for the track, or `undefined` when absent. */
  getTrackRootGroupId(trackId: string): string | undefined {
    const value = this.compileMap.get(`track-root-group:${trackId}`);
    return typeof value === 'string' ? value : undefined;
  }
  /** Returns the track's compiled instrument ID, or `undefined` when absent. */
  getTrackInstrumentId(trackId: string): number | string | undefined {
    const value = this.compileMap.get(`track-instrument:${trackId}`);
    return typeof value === 'number' || typeof value === 'string' ? value : undefined;
  }

  /** Returns a new map of registered track IDs to compiled instrument IDs. */
  getTrackInstrumentIds(): Map<string, number | string> {
    const result = new Map<string, number | string>();
    for (const [key, value] of this.compileMap) {
      if (typeof key !== 'string') continue;
      if (!key.startsWith('track-instrument:')) continue;
      if (typeof value === 'number' || typeof value === 'string') {
        result.set(key.slice('track-instrument:'.length), value);
      }
    }
    return result;
  }

  /**
   * Register (or replace) the compiled BlueX7 binding for one owner identity.
   * Rebuilding the same owner replaces its previous binding; other owners are
   * untouched.
   */
  registerBlueX7Binding(binding: CompiledBlueX7Binding): void {
    const registry = this.blueX7BindingRegistry();
    registry.set(binding.ownerIdentity, binding);
  }

  /** Looks up the compiled BlueX7 binding for an owner ID, or returns `undefined`. */
  getBlueX7Binding(ownerIdentity: string): CompiledBlueX7Binding | undefined {
    return this.blueX7BindingRegistry().get(ownerIdentity);
  }

  /** All registered bindings in registration order (diagnostics only). */
  getBlueX7Bindings(): CompiledBlueX7Binding[] {
    return [...this.blueX7BindingRegistry().values()];
  }

  private blueX7BindingRegistry(): Map<string, CompiledBlueX7Binding> {
    const existing = this.compileMap.get(BLUE_X7_BINDINGS_KEY);
    if (existing instanceof Map) {
      return existing;
    }
    const registry = new Map<string, CompiledBlueX7Binding>();
    this.compileMap.set(BLUE_X7_BINDINGS_KEY, registry);
    return registry;
  }

  /**
   * Register compiled BlueX7 bindings for every BlueX7 render instrument
   * after table allocation and Parameter naming. Owner identities follow the
   * project parameter catalog (`arrangement:<id>` / `track:<rootGroup>:<track>`),
   * never display names. Safe to call once per generated performance.
   */
  registerBlueX7CompiledBindings(): void {
    for (const ia of this.arrangement.getArrangement()) {
      if (!ia.enabled || !ia.instr) continue;
      const anyInstr = ia.instr as {
        getBlueX7EpochSymbol?: () => string;
        getParameters?: () => Parameter[];
      };
      if (
        typeof anyInstr.getBlueX7EpochSymbol !== 'function' ||
        typeof anyInstr.getParameters !== 'function'
      )
        continue;

      const sourceId = this.instrSourceId.get(ia.instr);
      let ownerIdentity: string;
      let runtimeInstrumentId: string | number;
      if (sourceId !== undefined) {
        const rootGroupId = this.getTrackRootGroupId(sourceId) ?? '';
        ownerIdentity = `track:${rootGroupId}:${sourceId}`;
        runtimeInstrumentId = this.getTrackInstrumentId(sourceId) ?? ia.arrangementId;
      } else {
        ownerIdentity = `arrangement:${ia.arrangementId}`;
        runtimeInstrumentId = ia.arrangementId;
      }

      const parameterChannels = new Map<string, string>();
      if (typeof anyInstr.getParameters === 'function') {
        for (const parameter of anyInstr.getParameters() ?? []) {
          const channel = parameter.getCompilationVarName();
          const semanticKey = parameter.getName();
          if (channel && semanticKey) {
            parameterChannels.set(semanticKey, channel);
          }
        }
      }

      this.registerBlueX7Binding({
        ownerIdentity,
        runtimeInstrumentId,
        parameterChannels,
        directGlobalChannels: parameterChannels,
        domainEpoch: anyInstr.getBlueX7EpochSymbol(),
      });
    }
  }

  /**
   * Build the deterministic disposable compiled MIDI target catalog for one render
   * snapshot (Spec 067). Track entries come from the `track-instrument:<id>` registry
   * populated by `Score.prepareTrackInstruments`. Orchestra entries come from the
   * enabled base arrangement assignments that are NOT Track-owned render instruments
   * (a Track-owned render instrument has an `instrSourceId` equal to its Track
   * uniqueId, while a project Orchestra assignment does not). The runtime instrument
   * id for an Orchestra target is its project `arrangementId`.
   *
   * Ordering is deterministic: Orchestra entries follow arrangement order, Track
   * entries follow registry insertion order. Consumers resolve by identity rather
   * than position.
   */
  getCompiledMidiInstrumentTargets(): CompiledMidiInstrumentTarget[] {
    const targets: CompiledMidiInstrumentTarget[] = [];

    for (const ia of this.arrangement.getArrangement()) {
      if (!ia.enabled || !ia.instr) continue;
      const sourceId = this.instrSourceId.get(ia.instr);
      // A Track-owned render instrument is tagged with its Track uniqueId. The
      // project Orchestra assignments have no source-id entry, so they are the
      // base Orchestra targets.
      if (sourceId !== undefined) continue;
      const arrangementId = ia.arrangementId;
      if (!arrangementId) continue;
      targets.push({
        kind: 'orchestra',
        assignmentId: arrangementId,
        runtimeInstrumentId: arrangementId,
      });
    }

    for (const [trackId, runtimeId] of this.getTrackInstrumentIds()) {
      targets.push({ kind: 'track', trackId, runtimeInstrumentId: runtimeId });
    }

    return targets;
  }

  /** Appends generated global orchestra code and ensures it ends with a newline. */
  appendGlobalOrc(code: string): void {
    if (!code) {
      return;
    }
    this.globalOrc += code;
    if (!code.endsWith('\n')) {
      this.globalOrc += '\n';
    }
  }

  /** Returns the accumulated generated global orchestra text. */
  getGlobalOrc(): string {
    return this.globalOrc;
  }

  /** Resets allocations, collected channels, and generated code, replacing the arrangement and tables. Audio layout and panner settings are retained. */
  reset(): void {
    this.arrangement = new Arrangement();
    this.tables = new Tables();
    this.channelIdAssignments.clear();
    this.instrSourceId.clear();
    this.compileMap.clear();
    this.globalOrc = '';
    this.stringChannels = [];
    this.originalParameters = [];
    this.mixerEnabled = false;
    this.nextParameterIndex = 0;
    this.nextStringChannelIndex = 0;
    this.nextInstrumentNumber = 0;
  }
}
