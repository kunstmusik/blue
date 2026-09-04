/**
 * PatternsLayerGroup — a group of PatternLayers.
 * Mirrors the Java PatternsLayerGroup class.
 *
 * PatternsLayerGroup holds multiple PatternLayers and a patternBeatsLength
 * that determines the duration of each pattern step. During CSD generation,
 * each PatternLayer repeats its SoundObject at active pattern positions.
 */
import { PatternLayer } from './pattern-layer';
import { LayerGroup } from '../../score/layers/layer-group';
import { NoteProcessorChain } from '../../note-processors/note-processor-chain';
import { NoteList } from '../../sound-objects/note-list';
import { TimeContext } from '../../time/time-context';
import { CompileData } from '../../compile-data';
import { ScoreGenerationException } from '../../score/score-generation-exception';
import { Element } from '../../serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from '../../serialization/obj-ref-map';
import {
  normalizeScoreGenerationOptions,
  type ScoreGenerationOptionsOrSolo,
} from '../score-generation-options';

export class PatternsLayerGroup extends Array<PatternLayer> implements LayerGroup<PatternLayer> {
  static get [Symbol.species](): ArrayConstructor {
    return Array;
  }

  private _name = 'Patterns Layer Group';
  private _patternBeatsLength = 4;
  private _npc = new NoteProcessorChain();

  constructor(other?: PatternsLayerGroup) {
    super();
    if (other) {
      this._name = other._name;
      this._patternBeatsLength = other._patternBeatsLength;
      this._npc = new NoteProcessorChain(other._npc);
      for (const pl of other) {
        this.push(pl.deepCopy());
      }
    }
  }

  // ─── LayerGroup ───

  getName(): string {
    return this._name;
  }
  setName(name: string): void {
    this._name = name;
  }

  getPatternBeatsLength(): number {
    return this._patternBeatsLength;
  }
  setPatternBeatsLength(length: number): void {
    this._patternBeatsLength = length;
  }

  getNoteProcessorChain(): NoteProcessorChain {
    return this._npc;
  }
  setNoteProcessorChain(npc: NoteProcessorChain): void {
    this._npc = npc;
  }

  hasSoloLayers(): boolean {
    return this.some((layer) => layer.isSolo());
  }

  generateForCSD(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
    options?: ScoreGenerationOptionsOrSolo,
  ): NoteList {
    const noteList = new NoteList();
    const processWithSolo = normalizeScoreGenerationOptions(options).processWithSolo ?? false;

    if (processWithSolo) {
      for (const patternLayer of this) {
        if (patternLayer.isSolo() && !patternLayer.isMuted()) {
          const nl = patternLayer.generateForCSD(
            context,
            compileData,
            startTime,
            endTime,
            this._patternBeatsLength,
          );
          noteList.merge(nl);
        }
      }
    } else {
      for (const patternLayer of this) {
        if (!patternLayer.isMuted()) {
          const nl = patternLayer.generateForCSD(
            context,
            compileData,
            startTime,
            endTime,
            this._patternBeatsLength,
          );
          noteList.merge(nl);
        }
      }
    }

    // Apply note processor chain
    return this._npc.apply(noteList);
  }

  saveAsXML(objRefMap?: ObjRefSaveMap): Element {
    const root = new Element('patternsLayerGroup');
    root.setAttribute('name', this._name);
    root.addElement('patternBeatsLength').setText(this._patternBeatsLength.toString());

    const patternsNode = root.addElement('patternLayers');
    for (const layer of this) {
      patternsNode.addElement(layer.saveAsXML(objRefMap));
    }

    root.addElement(this._npc.saveAsXML().setName('noteProcessorChain'));

    return root;
  }

  static loadFromXML(data: Element, objRefMap?: ObjRefLoadMap): PatternsLayerGroup {
    const group = new PatternsLayerGroup();

    const name = data.getAttribute('name');
    if (name) group._name = name;

    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      if (node.getName() === 'patternBeatsLength') {
        group._patternBeatsLength = parseInt(node.getTextString(), 10);
      } else if (node.getName() === 'patternLayers') {
        const patternNodes = node.getElements();
        while (patternNodes.hasMoreElements()) {
          const patternNode = patternNodes.next();
          if (patternNode.getName() === 'patternLayer') {
            group.push(PatternLayer.loadFromXML(patternNode, objRefMap));
          }
        }
      } else if (node.getName() === 'noteProcessorChain') {
        group._npc = NoteProcessorChain.loadFromXML(node);
      }
    }

    return group;
  }

  // ─── LayerGroup operations ───

  newLayerAt(index: number): PatternLayer {
    const patternLayer = new PatternLayer();

    const insertIndex = Math.min(Math.max(index, 0), this.length);
    this.splice(insertIndex, 0, patternLayer);

    return patternLayer;
  }

  removeLayers(startIdx: number, endIdx: number): void {
    for (let i = endIdx; i >= startIdx; i--) {
      this.splice(i, 1);
    }
  }

  pushUpLayers(startIdx: number, endIdx: number): void {
    if (startIdx <= 0) return;
    const item = this.splice(startIdx - 1, 1)[0];
    this.splice(endIdx, 0, item);
  }

  pushDownLayers(startIdx: number, endIdx: number): void {
    if (endIdx >= this.length - 1) return;
    const item = this.splice(endIdx + 1, 1)[0];
    this.splice(startIdx, 0, item);
  }

  onLoadComplete(_context: TimeContext): void {
    // No-op for pattern layers
  }

  deepCopy(): PatternsLayerGroup {
    return new PatternsLayerGroup(this);
  }

  /** Get the maximum pattern index across all layers. */
  getMaxPattern(): number {
    let max = 0;
    for (const layer of this) {
      const ms = layer.getPatternData().getMaxSelected();
      if (ms > max) max = ms;
    }
    return max;
  }
}
