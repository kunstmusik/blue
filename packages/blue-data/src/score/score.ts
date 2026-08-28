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
import { Element } from '../serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { ScoreGenerationException } from './score-generation-exception';
import { CompileData } from '../compile-data';
import { NoteList } from '../sound-objects/note-list';
import { PolyObject } from '../sound-objects/poly-object';
import { TimeBehavior } from '../sound-objects/time-behavior';
import { TrackLayerGroup } from './track/track-layer-group';
import { PatternsLayerGroup } from './patterns/patterns-layer-group';
import type { JavaScriptSession } from '../javascript-runtime';
import type { JavaRuntimeClientContract } from '../java-runtime';
import { applyNoteProcessorChainAsync } from '../utilities/score';

export class Score extends Array<LayerGroup<Layer>> {
  private timeContext = new TimeContext();
  private timeState = new TimeState();
  private npc = new NoteProcessorChain();

  constructor(other?: Score) {
    super();
    if (other instanceof Score) {
      this.timeContext = new TimeContext(other.timeContext);
      this.timeState = new TimeState(other.timeState);
      this.npc = new NoteProcessorChain(other.npc);
      for (const layerGroup of other) {
        this.push(layerGroup.deepCopyLG() as LayerGroup<Layer>);
      }
      this.timeContext.setSmpteFrameRate(this.timeState.getSmpteFrameRate());
    } else if (!other) {
      const rootPolyObject = new PolyObject(true);
      rootPolyObject.newLayerAt(-1);
      this.push(rootPolyObject);
    }
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
   */
  generateForCSD(compileData: CompileData, startTime: number, endTime: number): NoteList {
    const noteList = new NoteList();
    const context = this.timeContext;
    const hasSolo = this.some((lg) => lg.hasSoloLayers());

    for (let i = 0; i < this.length; i++) {
      const layerGroup = this[i];

      if (!hasSolo) {
        const nl = layerGroup.generateForCSD(context, compileData, startTime, endTime, { processWithSolo: false });
        noteList.merge(nl);
      } else {
        const nl = layerGroup.generateForCSD(context, compileData, startTime, endTime, { processWithSolo: true });
        noteList.merge(nl);
      }
    }
    return this.npc.apply(noteList);
  }

  async generateForCSDAsync(
    compileData: CompileData,
    startTime: number,
    endTime: number,
  ): Promise<NoteList> {
    const noteList = new NoteList();
    const context = this.timeContext;
    const hasSolo = this.some((lg) => lg.hasSoloLayers());

    for (let i = 0; i < this.length; i++) {
      const layerGroup = this[i];

      if (layerGroup instanceof PolyObject) {
        const nl = await layerGroup.generateForCSDAsync(
          context,
          compileData,
          startTime,
          endTime,
          { processWithSolo: hasSolo },
        );
        noteList.merge(nl);
        continue;
      }

      if (layerGroup instanceof TrackLayerGroup) {
        const nl = await layerGroup.generateForCSDAsync(
          context,
          compileData,
          startTime,
          endTime,
          { processWithSolo: hasSolo },
        );
        noteList.merge(nl);
        continue;
      }

      const nl = layerGroup.generateForCSD(context, compileData, startTime, endTime, { processWithSolo: hasSolo });
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
          if (type === 'blue.soundObject.PolyObject' || type === 'PolyObject' || node.hasElement('soundLayer')) {
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
