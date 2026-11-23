/**
 * BlueDataObject interface — base interface for all serializable data objects.
 * Mirrors the Java BlueDataObject interface.
 *
 * Every object that can be saved/loaded as part of a .blue file implements this.
 */
import { Element } from './serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from './serialization/obj-ref-map';
import { DeepCopyable } from './deep-copyable';

export interface BlueDataObject extends DeepCopyable<BlueDataObject> {
  /**
   * Serialize this object to an XML Element.
   * @param objRefMap Object reference map for shared object tracking.
   */
  saveAsXML(objRefMap?: ObjRefSaveMap): Element;
}

/**
 * Static load interface for BlueDataObject types.
 * Implemented as a separate interface since TypeScript can't have static
 * methods on interfaces, and constructors can't be in interfaces.
 */
export interface BlueDataObjectStatic<T extends BlueDataObject> {
  /** Reconstructs an object from an XML element, optionally resolving references in the containing document. */
  loadFromXML(data: Element, objRefMap?: ObjRefLoadMap): T;
}
