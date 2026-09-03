/**
 * Layer — interface for a layer within a LayerGroup.
 * Mirrors the Java Layer interface.
 *
 * Layers are containers for ScoreObjects (or other domain objects) within
 * a LayerGroup. Each layer has a name, height, and can accept/remove ScoreObjects.
 */
import { ScoreObject } from '../score-object';
import { DeepCopyable } from '../../deep-copyable';

export const LAYER_HEIGHT = 22; // Default layer height in pixels

export interface Layer extends DeepCopyable<Layer> {
  /** Get the name of this layer. */
  getName(): string;
  /** Set the name of this layer. */
  setName(name: string): void;

  /** Get the display height of this layer in pixels. */
  getLayerHeight(): number;

  /** Get the concrete background color for this layer (signed 32-bit ARGB). */
  getBackgroundColor(): number;
  /** Set the concrete background color for this layer (signed 32-bit ARGB). */
  setBackgroundColor(color: number): void;

  /** Check if this layer can accept the given ScoreObject. */
  accepts(object: ScoreObject): boolean;
  /** Check if this layer contains the given ScoreObject. */
  contains(object: ScoreObject): boolean;
  /** Remove the given ScoreObject from this layer. */
  remove(object: ScoreObject): boolean;
  /** Remove all ScoreObjects from this layer. */
  clearScoreObjects(): void;
}
