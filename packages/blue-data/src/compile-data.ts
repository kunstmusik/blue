import { Instrument } from './instruments/instrument';
import { Arrangement } from './arrangement';
import { Tables } from './tables';
import { Channel } from './mixer/channel';
import { Parameter } from './automation/parameter';

interface StringChannelEntry {
  objectName: string;
  value: string;
  channelName: string;
}

/**
 * Disposable compiled MIDI target (Spec 067). Describes exactly the enabled base
 * instruments generated into one Blue Live CSD snapshot, keyed by stable project
 * identity rather than row position or MIDI channel. This is derived render output
 * only; it is never serialized into `.blue` XML.
 */
export type CompiledMidiInstrumentTarget =
	| { kind: 'track'; trackId: string; runtimeInstrumentId: number | string }
	| {
		kind: 'orchestra';
		assignmentId: string;
		runtimeInstrumentId: number | string;
	};

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
  private nextParameterIndex = 0;
  private nextStringChannelIndex = 0;

  constructor();
  constructor(arrangement: Arrangement, tables: Tables, handleParameters?: boolean);
  constructor(arrangement?: Arrangement, tables?: Tables, handleParameters?: boolean) {
    this.arrangement = arrangement ?? new Arrangement();
    this.tables = tables ?? new Tables();
    this.handleParametersAndChannels = handleParameters ?? false;
  }

  static createEmptyCompileData(): CompileData {
    return new CompileData(new Arrangement(), new Tables(), false);
  }

  getArrangement(): Arrangement {
    return this.arrangement;
  }

  getTables(): Tables {
    return this.tables;
  }

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

  setMixerEnabled(enabled: boolean): void {
    this.mixerEnabled = enabled;
  }

  addInstrument(instr: Instrument): number {
    const instrId = this.arrangement.addInstrumentAtEnd(instr);
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

  registerExistingAutomationState(
    parameters: Parameter[],
    stringChannels: StringChannelEntry[],
  ): void {
    this.originalParameters.push(...parameters);
    this.stringChannels.push(...stringChannels);
    this.nextParameterIndex = this.originalParameters.length;
    this.nextStringChannelIndex = this.stringChannels.length;
  }

  getStringChannels(): StringChannelEntry[] {
    return this.stringChannels;
  }

  getOriginalParameters(): Parameter[] {
    return this.originalParameters;
  }

  isHandleParametersAndChannels(): boolean {
    return this.handleParametersAndChannels;
  }

  setHandleParametersAndChannels(handleParametersAndChannels: boolean): void {
    this.handleParametersAndChannels = handleParametersAndChannels;
  }

  getCompilationVariable(key: unknown): unknown {
    return this.compileMap.get(key);
  }

  setCompilationVariable(key: unknown, value: unknown): void {
    this.compileMap.set(key, value);
  }

  clearCompilationVariable(key: unknown): void {
    this.compileMap.delete(key);
  }

  getOpenFTableNumber(): number {
    return this.tables.getOpenFTableNumber();
  }

  appendTables(text: string): void {
    const current = this.tables.getTables();
    this.tables.setTables(current ? current + '\n' + text : text);
  }

  addInstrSourceId(generated: Instrument, sourceId: string): void {
    this.instrSourceId.set(generated, sourceId);
  }

  getInstrSourceId(instr: Instrument): string | undefined {
    return this.instrSourceId.get(instr);
  }

  setTrackInstrumentId(trackId: string, instrumentId: number | string): void {
    this.compileMap.set(`track-instrument:${trackId}`, instrumentId);
  }

  getTrackInstrumentId(trackId: string): number | string | undefined {
    const value = this.compileMap.get(`track-instrument:${trackId}`);
    return typeof value === 'number' || typeof value === 'string' ? value : undefined;
  }

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

  appendGlobalOrc(code: string): void {
    if (!code) {
      return;
    }
    this.globalOrc += code;
    if (!code.endsWith('\n')) {
      this.globalOrc += '\n';
    }
  }

  getGlobalOrc(): string {
    return this.globalOrc;
  }

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
  }
}
