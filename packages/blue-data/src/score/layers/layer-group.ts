/**
 * LayerGroup — interface for a group of layers.
 * Mirrors the Java LayerGroup<T> interface.
 *
 * LayerGroups are the top-level containers in a Score. Each Score holds
 * a list of LayerGroups, which can be of different types (audio, patterns, poly).
 */
import { Layer } from './layer';
import { DeepCopyable } from '../../deep-copyable';
import { NoteProcessorChain } from '../../note-processors/note-processor-chain';
import { NoteList } from '../../sound-objects/note-list';
import { TimeContext } from '../../time/time-context';
import { CompileData } from '../../compile-data';
import { ScoreGenerationException } from '../score-generation-exception';
import { Element } from '../../serialization/xml-reader';
import { ObjRefSaveMap } from '../../serialization/obj-ref-map';
import type { ScoreGenerationOptionsOrSolo } from '../score-generation-options';

export interface LayerGroup<T extends Layer> extends Array<T>, DeepCopyable<LayerGroup<T>> {
  /** Get the name of this layer group. */
  getName(): string;
  /** Set the name of this layer group. */
  setName(name: string): void;

  /** Get the note processor chain for this layer group. */
  getNoteProcessorChain(): NoteProcessorChain;

  /** Check if any layers in this group have solo enabled. */
  hasSoloLayers(): boolean;

  /**
   * Generate notes for CSD output from all layers in this group.
   * @param context Time context for temporal calculations
   * @param compileData Compilation context for accumulating CSD parts
   * @param startTime Start of render window in beats
   * @param endTime End of render window in beats (-1 for no end)
   * @param processWithSolo If true, only process solo-enabled layers
   */
  generateForCSD(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
    options?: ScoreGenerationOptionsOrSolo,
  ): NoteList;

  /** Serialize to XML. */
  saveAsXML(objRefMap?: ObjRefSaveMap): Element;

  /** Create a new layer at the specified index. */
  newLayerAt(index: number): T;

  /** Remove layers from startIndex to endIndex (inclusive). */
  removeLayers(startIndex: number, endIndex: number): void;

  /** Push layers up (move range earlier in the list). */
  pushUpLayers(startIndex: number, endIndex: number): void;

  /** Push layers down (move range later in the list). */
  pushDownLayers(startIndex: number, endIndex: number): void;

  /** Called when a project has been loaded and allows initialization. */
  onLoadComplete(context: TimeContext): void;

  /** Produce a deep copy of this layer group. */
  deepCopy(): LayerGroup<T>;
}
