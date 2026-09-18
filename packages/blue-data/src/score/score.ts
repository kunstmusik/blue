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
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { ScoreGenerationException } from './score-generation-exception';
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
import {
  type PanLawDb,
  isValidPanLawDb,
  DEFAULT_PAN_LAW_DB,
  DEFAULT_PAN_OFF_CENTER_BOOST,
} from '../mixer/channel-pan';

export type TrackLayerMuteSoloMode = 'audio' | 'event';

export function isTrackLayerMuteSoloMode(value: unknown): value is TrackLayerMuteSoloMode {
  return value === 'audio' || value === 'event';
}

export class Score extends Array<LayerGroup<Layer>> {
  private timeContext = new TimeContext();
  private timeState = new TimeState();
  private npc = new NoteProcessorChain();
  private _trackLayerMuteSoloMode: TrackLayerMuteSoloMode = 'audio';
  private _panningEnabled = true;
  private _panLawDb: PanLawDb = DEFAULT_PAN_LAW_DB;
  private _panOffCenterBoost = DEFAULT_PAN_OFF_CENTER_BOOST;

  constructor(other?: Score, mode: CopyMode = 'duplication') {
    super();
    if (other instanceof Score) {
      this.timeContext = new TimeContext(other.timeContext);
      this.timeState = new TimeState(other.timeState);
      this.npc = new NoteProcessorChain(other.npc);
      this._trackLayerMuteSoloMode = other._trackLayerMuteSoloMode;
      this._panningEnabled = other._panningEnabled;
      this._panLawDb = other._panLawDb;
      this._panOffCenterBoost = other._panOffCenterBoost;
      for (const layerGroup of other) {
        this.push(layerGroup.deepCopy(mode) as LayerGroup<Layer>);
      }
    } else if (!other) {
      const rootPolyObject = new PolyObject(true);
      rootPolyObject.newLayerAt(-1);
      this.push(rootPolyObject);
    }
  }

  deepCopy(mode: CopyMode = 'duplication'): Score {
    return new Score(this, mode);
  }

  get trackLayerMuteSoloMode(): TrackLayerMuteSoloMode {
    return this._trackLayerMuteSoloMode;
  }

  set trackLayerMuteSoloMode(value: TrackLayerMuteSoloMode) {
    if (!isTrackLayerMuteSoloMode(value)) return;
    this._trackLayerMuteSoloMode = value;
  }

  get panningEnabled(): boolean {
    return this._panningEnabled;
  }

  set panningEnabled(value: boolean) {
    if (typeof value !== 'boolean') return;
    this._panningEnabled = value;
  }

  get panLawDb(): PanLawDb {
    return this._panLawDb;
  }

  set panLawDb(value: PanLawDb) {
    if (!isValidPanLawDb(value)) return;
    this._panLawDb = value;
  }

  get panOffCenterBoost(): boolean {
    return this._panOffCenterBoost;
  }

  set panOffCenterBoost(value: boolean) {
    if (typeof value !== 'boolean') return;
    this._panOffCenterBoost = value;
  }

  getTimeContext(): TimeContext {
    return this.timeContext;
  }

  setTimeContext(context: TimeContext): void {
    this.timeContext = context;
  }

  getTimeState(): TimeState {
    return this.timeState;
  }

  setTimeState(state: TimeState): void {
    this.timeState = state;
  }

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

  setNoteProcessorChain(npc: NoteProcessorChain): void {
    this.npc = npc;
  }

  /**
   * Generate the complete score output for CSD.
   * Iterates all LayerGroups and collects their NoteLists.
   * `generationOptions.trackLayerMuteSoloMode === 'audio'` removes Track
   * groups from event-flag filtering and global event-solo discovery.
   */
  generateForCSD(
    compileData: CompileData,
    startTime: number,
    endTime: number,
    generationOptions?: ScoreGenerationOptionsOrSolo,
  ): NoteList {
    const options = normalizeScoreGenerationOptions(generationOptions);
    const audioModeTracks = options.trackLayerMuteSoloMode === 'audio';
    const noteList = new NoteList();
    const context = this.timeContext;
    const hasSolo = this.some((lg) => {
      if (audioModeTracks && lg instanceof TrackLayerGroup) return false;
      return lg.hasSoloLayers();
    });

    for (let i = 0; i < this.length; i++) {
      const layerGroup = this[i];

      const processWithSolo =
        hasSolo && !(audioModeTracks && layerGroup instanceof TrackLayerGroup);
      const nl = layerGroup.generateForCSD(context, compileData, startTime, endTime, {
        ...options,
        processWithSolo,
      });
      noteList.merge(nl);
    }
    return this.npc.apply(noteList);
  }

  async generateForCSDAsync(
    compileData: CompileData,
    startTime: number,
    endTime: number,
    generationOptions?: ScoreGenerationOptionsOrSolo,
  ): Promise<NoteList> {
    const options = normalizeScoreGenerationOptions(generationOptions);
    const audioModeTracks = options.trackLayerMuteSoloMode === 'audio';
    const noteList = new NoteList();
    const context = this.timeContext;
    const hasSolo = this.some((lg) => {
      if (audioModeTracks && lg instanceof TrackLayerGroup) return false;
      return lg.hasSoloLayers();
    });

    for (let i = 0; i < this.length; i++) {
      const layerGroup = this[i];
      const processWithSolo =
        hasSolo && !(audioModeTracks && layerGroup instanceof TrackLayerGroup);

      if (layerGroup instanceof PolyObject) {
        const nl = await layerGroup.generateForCSDAsync(context, compileData, startTime, endTime, {
          ...options,
          processWithSolo,
        });
        noteList.merge(nl);
        continue;
      }

      if (layerGroup instanceof TrackLayerGroup) {
        const nl = await layerGroup.generateForCSDAsync(context, compileData, startTime, endTime, {
          ...options,
          processWithSolo,
        });
        noteList.merge(nl);
        continue;
      }

      const nl = layerGroup.generateForCSD(context, compileData, startTime, endTime, {
        ...options,
        processWithSolo,
      });
      noteList.merge(nl);
    }

    return applyNoteProcessorChainAsync(noteList, this.npc, compileData);
  }

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

  saveAsXML(objRefMap?: ObjRefSaveMap): Element {
    const elem = new Element('score');
    elem.addElement(this.timeContext.saveAsXML().setName('timeContext'));
    elem.addElement(this.timeState.saveAsXML().setName('timeState'));
    elem.addElement(this.npc.saveAsXML().setName('noteProcessorChain'));
    elem.setAttribute('trackLayerMuteSoloMode', this._trackLayerMuteSoloMode);
    elem.setAttribute('panningEnabled', this._panningEnabled ? 'true' : 'false');
    elem.setAttribute('panLawDb', String(this._panLawDb));
    elem.setAttribute('panOffCenterBoost', this._panOffCenterBoost ? 'true' : 'false');

    // Serialize layer groups — they self-identify by their XML element name
    for (const lg of this) {
      const lgXml = lg.saveAsXML(objRefMap);
      elem.addElement(lgXml);
    }

    return elem;
  }

  static loadFromXML(data: Element, objRefMap?: ObjRefLoadMap): Score {
    const score = new Score();
    score.length = 0;
    const parsed = data.getAttribute('trackLayerMuteSoloMode')?.trim().toLowerCase();
    score._trackLayerMuteSoloMode = isTrackLayerMuteSoloMode(parsed) ? parsed : 'event';
    const panningParsed = data.getAttribute('panningEnabled')?.trim().toLowerCase();
    score._panningEnabled = panningParsed === 'true';

    const panLawParsed = data.getAttribute('panLawDb');
    if (panLawParsed !== null && panLawParsed !== undefined) {
      const num = parseFloat(panLawParsed);
      score._panLawDb = isValidPanLawDb(num) ? num : DEFAULT_PAN_LAW_DB;
    } else {
      score._panLawDb = DEFAULT_PAN_LAW_DB;
    }

    const panBoostParsed = data.getAttribute('panOffCenterBoost')?.trim().toLowerCase();
    score._panOffCenterBoost = panBoostParsed === 'true';

    const nodes = data.getElements();

    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      const nodeName = node.getName();

      switch (nodeName) {
        case 'timeContext':
          score.timeContext = TimeContext.loadFromXML(node);
          break;
        case 'timeState':
          score.timeState = TimeState.loadFromXML(node);
          break;
        case 'noteProcessorChain':
          score.npc = NoteProcessorChain.loadFromXML(node);
          break;
        case 'soundObject': {
          const type = node.getAttribute('type');
          if (
            type === 'blue.soundObject.PolyObject' ||
            type === 'PolyObject' ||
            node.hasElement('soundLayer')
          ) {
            const polyObject = PolyObject.loadFromXML(node, objRefMap);
            polyObject.setTimeBehavior(TimeBehavior.NONE);
            score.push(polyObject);
          }
          break;
        }
        case 'polyObject':
          {
            const polyObject = PolyObject.loadFromXML(node, objRefMap);
            polyObject.setTimeBehavior(TimeBehavior.NONE);
            score.push(polyObject);
          }
          break;
        case 'trackLayerGroup':
          score.push(TrackLayerGroup.loadFromXML(node, objRefMap));
          break;
        case 'patternsLayerGroup':
          score.push(PatternsLayerGroup.loadFromXML(node, objRefMap));
          break;
        case 'scoreObjectLayerGroup':
          break;
      }
    }

    return score;
  }
}
