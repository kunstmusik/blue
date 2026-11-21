import {
  withSoundOccurrences,
  withSoundOccurrencesAsync,
} from '../sound-objects/sound-occurrences';
/**
 * Score — the main score container holding layer groups.
 * Mirrors the Java Score class.
 *
 * A Score contains a list of LayerGroups (which can be PolyObject groups,
 * Track layer groups, or Pattern layer groups). It also holds the TimeContext,
 * TimeState, and NoteProcessorChain.
 */
import { TimeContext } from '../time/time-context';
import { TimeState } from '../time/time-state';
import { NoteProcessorChain } from '../note-processors/note-processor-chain';
import { LayerGroup } from './layers/layer-group';
import { Layer } from './layers/layer';
import type { CopyMode } from '../deep-copyable';
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext, requireXmlValue, type XmlDiagnosticSink } from '../serialization/xml-load';
import { checkRoot, checkShape } from '../utilities/xml';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { CompileData } from '../compile-data';
import {
  normalizeScoreGenerationOptions,
  type ScoreGenerationOptionsOrSolo,
} from './score-generation-options';
import { NoteList } from '../sound-objects/note-list';
import { PolyObject } from '../sound-objects/poly-object';
import { TimeBehavior } from '../sound-objects/time-behavior';
import { TrackLayerGroup } from './track/track-layer-group';
import { PatternsLayerGroup } from './patterns/patterns-layer-group';
import type { JavaScriptSession } from '../javascript-runtime';
import type { JavaRuntimeClientContract } from '../java-runtime';
import { applyNoteProcessorChainAsync } from '../utilities/score';

/** Controls whether track mute and solo gate mixer audio or filter note generation. */
export type TrackLayerMuteSoloMode = 'audio' | 'event';

/** Checks whether a value is one of the supported track mute and solo modes. */
export function isTrackLayerMuteSoloMode(value: unknown): value is TrackLayerMuteSoloMode {
  return value === 'audio' || value === 'event';
}

/** Ordered timeline layer groups with shared timing settings and a score-level note processor chain. */
export class Score extends Array<LayerGroup<Layer>> {
  private timeContext = new TimeContext();
  private timeState = new TimeState();
  private npc = new NoteProcessorChain();
  private _trackLayerMuteSoloMode: TrackLayerMuteSoloMode = 'audio';

  /** Creates a score with a root layer or copies another score. When copying, `copyLayerGroups` controls whether the existing layer groups are copied. */
  constructor(other?: Score, mode: CopyMode = 'duplication', copyLayerGroups = true) {
    super();
    if (other instanceof Score) {
      this.timeContext = new TimeContext(other.timeContext);
      this.timeState = new TimeState(other.timeState);
      this.npc = new NoteProcessorChain(other.npc);
      this._trackLayerMuteSoloMode = other._trackLayerMuteSoloMode;
      if (copyLayerGroups) {
        for (const layerGroup of other) {
          this.push(layerGroup.deepCopy(mode) as LayerGroup<Layer>);
        }
      } else {
        this.push(new PolyObject(true));
      }
    } else if (!other) {
      this.timeContext.setSmpteFrameRate(this.timeState.getSmpteFrameRate());
      const rootPolyObject = new PolyObject(true);
      rootPolyObject.newLayerAt(-1);
      this.push(rootPolyObject);
    }
  }

  /** Copies the timing settings, processors, and all layer groups with the requested identity policy. */
  deepCopy(mode: CopyMode = 'duplication'): Score {
    return new Score(this, mode);
  }

  /** Returns the current track mute and solo mode. New scores use audio gating. */
  get trackLayerMuteSoloMode(): TrackLayerMuteSoloMode {
    return this._trackLayerMuteSoloMode;
  }

  /** Sets the track mute and solo mode. Unrecognized values are ignored. */
  set trackLayerMuteSoloMode(value: TrackLayerMuteSoloMode) {
    if (!isTrackLayerMuteSoloMode(value)) return;
    this._trackLayerMuteSoloMode = value;
  }

  /** Returns the score-owned tempo, meter, and unit conversion context. */
  getTimeContext(): TimeContext {
    return this.timeContext;
  }

  /** Installs the supplied conversion context by reference. */
  setTimeContext(context: TimeContext): void {
    this.timeContext = context;
  }

  /** Returns the score-owned display and grid settings. */
  getTimeState(): TimeState {
    return this.timeState;
  }

  /** Installs the supplied display and grid settings by reference. */
  setTimeState(state: TimeState): void {
    this.timeState = state;
  }

  /** Returns the editable chain applied to collected notes after generating the layer groups. */
  getNoteProcessorChain(): NoteProcessorChain {
    return this.npc;
  }

  /**
   * Register Track-owned instruments in the disposable render Arrangement.
   * This must run before Arrangement UDO, parameter, string, ftable, and
   * global dependency collection so Track instruments participate exactly
   * like project Arrangement instruments without mutating the project.
   */
  prepareTrackInstruments(compileData: CompileData): void {
    for (const layerGroup of this) {
      if (!(layerGroup instanceof TrackLayerGroup)) continue;
      for (const track of layerGroup) {
        const instrument = track.getInstrument();
        if (!instrument || !instrument.isEnabled()) continue;
        if (compileData.getTrackInstrumentId(track.getUniqueId()) !== undefined) continue;

        const renderInstrument = instrument.deepCopy();
        const runtimeId = compileData.addInstrument(renderInstrument);
        compileData.addInstrSourceId(renderInstrument, track.getUniqueId());
        compileData.setTrackInstrumentId(track.getUniqueId(), runtimeId);
        compileData.setTrackRootGroupId(track.getUniqueId(), layerGroup.getUniqueId());
      }
    }
  }

  /** Replaces the score-level processor chain with the supplied instance. */
  setNoteProcessorChain(npc: NoteProcessorChain): void {
    this.npc = npc;
  }

  /**
   * Generate the complete score output for CSD.
   * Iterates all LayerGroups and collects their NoteLists.
   * `generationOptions.trackLayerMuteSoloMode === 'audio'` removes Track
   * groups from event-flag filtering and global event-solo discovery.
   */
  private prepareCSDGeneration(generationOptions?: ScoreGenerationOptionsOrSolo) {
    const options = normalizeScoreGenerationOptions(generationOptions);
    const audioModeTracks = options.trackLayerMuteSoloMode === 'audio';
    const noteList = new NoteList();
    const context = this.timeContext;
    const hasSolo = this.some((lg) => {
      if (audioModeTracks && lg instanceof TrackLayerGroup) return false;
      return lg.hasSoloLayers();
    });
    return { options, audioModeTracks, noteList, context, hasSolo };
  }

  private getLayerGroupOptions(
    options: ReturnType<typeof normalizeScoreGenerationOptions>,
    audioModeTracks: boolean,
    hasSolo: boolean,
    layerGroup: LayerGroup<Layer>,
  ) {
    const processWithSolo = hasSolo && !(audioModeTracks && layerGroup instanceof TrackLayerGroup);
    return { ...options, processWithSolo };
  }

  /**
   * Collects notes from layer groups and applies the score-level processor chain.
   *
   * @param compileData - Mutable render context shared with the layer groups.
   * @param startTime - Start of the render window in Csound beats.
   * @param endTime - End of the render window in Csound beats. Use a negative value for an open-ended window.
   * @param generationOptions - Score-generation options or a legacy boolean for solo filtering.
   * @returns The collected notes after score-level processing.
   */
  generateForCSD(
    compileData: CompileData,
    startTime: number,
    endTime: number,
    generationOptions?: ScoreGenerationOptionsOrSolo,
  ): NoteList {
    return withSoundOccurrences(compileData, startTime, startTime, endTime, () => {
      const { options, audioModeTracks, noteList, context, hasSolo } =
        this.prepareCSDGeneration(generationOptions);

      for (let i = 0; i < this.length; i++) {
        const layerGroup = this[i];
        const nl = layerGroup.generateForCSD(
          context,
          compileData,
          startTime,
          endTime,
          this.getLayerGroupOptions(options, audioModeTracks, hasSolo, layerGroup),
        );
        noteList.merge(nl);
      }
      return this.npc.apply(noteList);
    });
  }

  /**
   * Collects and processes notes, awaiting asynchronous generators and note processors.
   *
   * @param compileData - Mutable render context, including any attached script runtimes.
   * @param startTime - Start of the render window in Csound beats.
   * @param endTime - End of the render window in Csound beats. Use a negative value for an open-ended window.
   * @param generationOptions - Score-generation options or a legacy boolean for solo filtering.
   * @returns The collected notes after asynchronous score-level processing.
   */
  async generateForCSDAsync(
    compileData: CompileData,
    startTime: number,
    endTime: number,
    generationOptions?: ScoreGenerationOptionsOrSolo,
  ): Promise<NoteList> {
    return withSoundOccurrencesAsync(compileData, startTime, startTime, endTime, async () => {
      const { options, audioModeTracks, noteList, context, hasSolo } =
        this.prepareCSDGeneration(generationOptions);

      for (let i = 0; i < this.length; i++) {
        const layerGroup = this[i];
        const layerOptions = this.getLayerGroupOptions(
          options,
          audioModeTracks,
          hasSolo,
          layerGroup,
        );

        if (layerGroup instanceof PolyObject) {
          noteList.merge(
            await layerGroup.generateForCSDAsync(
              context,
              compileData,
              startTime,
              endTime,
              layerOptions,
            ),
          );
          continue;
        }

        if (layerGroup instanceof TrackLayerGroup) {
          noteList.merge(
            await layerGroup.generateForCSDAsync(
              context,
              compileData,
              startTime,
              endTime,
              layerOptions,
            ),
          );
          continue;
        }

        noteList.merge(
          layerGroup.generateForCSD(context, compileData, startTime, endTime, layerOptions),
        );
      }

      return applyNoteProcessorChainAsync(noteList, this.npc, compileData);
    });
  }

  /** Runs supported synchronous on-load hooks in polyphonic groups and track groups. */
  processOnLoad(session?: JavaScriptSession): void {
    const context = this.timeContext;
    for (const lg of this) {
      if (lg instanceof PolyObject) {
        lg.processOnLoad(context, session);
      } else if (lg instanceof TrackLayerGroup) {
        lg.processOnLoad(context, session);
      }
    }
  }

  /** Runs on-load hooks in score order, using the supplied host runtime for Java-backed hooks. */
  async processOnLoadAsync(
    session?: JavaScriptSession,
    runtimeClient?: JavaRuntimeClientContract | null,
  ): Promise<void> {
    const context = this.timeContext;
    for (const lg of this) {
      if (lg instanceof PolyObject) {
        await lg.processOnLoadAsync(context, session, runtimeClient);
      } else if (lg instanceof TrackLayerGroup) {
        await lg.processOnLoadAsync(context, session, runtimeClient);
      }
    }
  }

  // ─── XML Serialization ───

  /** Writes the score, settings, processor chain, and layer groups into a new XML element. */
  saveAsXML(objRefMap?: ObjRefSaveMap): Element {
    const elem = new Element('score');
    const timing = this.timeContext.saveAsXML().setName('timeContext');
    timing.getElement('smpteFrameRate')!.setText(String(this.timeState.getSmpteFrameRate()));
    elem.addElement(timing);
    elem.addElement(this.timeState.saveAsXML().setName('timeState'));
    elem.addElement(this.npc.saveAsXML().setName('noteProcessorChain'));
    elem.setAttribute('trackLayerMuteSoloMode', this._trackLayerMuteSoloMode);

    // Serialize layer groups — they self-identify by their XML element name
    for (const lg of this) {
      const lgXml = lg.saveAsXML(objRefMap);
      elem.addElement(lgXml);
    }

    return elem;
  }

  /** Reads score settings and layer groups using the supplied object references and optional XML diagnostic context. */
  static loadFromXML(
    data: Element,
    objRefMap?: ObjRefLoadMap,
    providedContext?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): Score {
    const context = providedContext ?? new XmlLoadContext(data);
    checkRoot(data, 'score', context);
    checkShape(
      data,
      ['trackLayerMuteSoloMode'],
      [
        'timeContext',
        'timeState',
        'noteProcessorChain',
        'soundObject',
        'polyObject',
        'trackLayerGroup',
        'patternsLayerGroup',
      ],
      context,
      ['soundObject', 'polyObject', 'trackLayerGroup', 'patternsLayerGroup'],
    );
    const score = new Score();
    score.length = 0;
    const parsed = data.getAttribute('trackLayerMuteSoloMode');
    if (parsed !== null && !isTrackLayerMuteSoloMode(parsed))
      throw context.at(data).error({
        code: 'value',
        member: '@trackLayerMuteSoloMode',
        value: parsed,
        message: 'Unsupported track mute/solo mode.',
        recovery: 'Use event or audio.',
      });
    score._trackLayerMuteSoloMode = isTrackLayerMuteSoloMode(parsed) ? parsed : 'event';

    const nodes = data.getElements();

    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      const nodeName = node.getName();

      switch (nodeName) {
        case 'timeContext':
          score.timeContext = TimeContext.loadFromXML(node, context);
          break;
        case 'timeState':
          score.timeState = TimeState.loadFromXML(node, context);
          break;
        case 'noteProcessorChain':
          score.npc = NoteProcessorChain.loadFromXML(node, context);
          break;
        case 'soundObject': {
          const type = node.getAttribute('type');
          if (type === 'blue.soundObject.PolyObject' || type === 'PolyObject') {
            const polyObject = PolyObject.loadFromXML(node, objRefMap, context);
            polyObject.setTimeBehavior(TimeBehavior.NONE);
            score.push(polyObject);
          } else
            throw context.at(node).error({
              code: 'type',
              member: '@type',
              value: type ?? '',
              message: 'Score soundObject must be a PolyObject.',
              recovery: 'Use a supported layer group type.',
            });
          break;
        }
        case 'polyObject':
          {
            const polyObject = PolyObject.loadFromXML(node, objRefMap, context);
            polyObject.setTimeBehavior(TimeBehavior.NONE);
            score.push(polyObject);
          }
          break;
        case 'trackLayerGroup':
          score.push(TrackLayerGroup.loadFromXML(node, objRefMap, context));
          break;
        case 'patternsLayerGroup':
          score.push(PatternsLayerGroup.loadFromXML(node, objRefMap, context));
          break;
      }
    }

    const persistedContextRate = data.getElement('timeContext')?.getElement('smpteFrameRate');
    const persistedStateRate = data.getElement('timeState')?.getElement('smpteFrameRate');
    if (
      persistedContextRate &&
      persistedStateRate &&
      score.timeContext.getSmpteFrameRate() !== score.timeState.getSmpteFrameRate()
    )
      throw context.at(persistedContextRate).error({
        code: 'conflict',
        message: 'Persisted TimeContext and TimeState frame rates disagree.',
        recovery: 'Choose one consistent SMPTE frame rate.',
      });
    if (persistedContextRate && !persistedStateRate)
      score.timeState.setSmpteFrameRate(score.timeContext.getSmpteFrameRate());
    score.timeContext.setSmpteFrameRate(score.timeState.getSmpteFrameRate());
    return providedContext ? score : requireXmlValue(context.result(score), sink);
  }
}
