import { Element } from '../serialization/xml-reader';
import { XmlLoadContext, requireXmlValue } from '../serialization/xml-load';
import type { XmlDiagnosticSink } from '../serialization/xml-load';
import { checkRoot, checkShape } from '../utilities/xml';
import { BlueDataObject } from '../blue-data-object';
import { LiveObjectSet } from './live-object-set';
import { LiveObjectBins } from './live-object-bins';

export class LiveObjectSetList implements BlueDataObject {
  private _sets: LiveObjectSet[] = [];

  /** Creates an empty list of saved Blue Live selections. */
  constructor() {}

  /** Returns the sets stored on the Live object set list. */
  getSets(): LiveObjectSet[] {
    return this._sets;
  }

  /** Appends a saved set of Live cells to the list. */
  add(set: LiveObjectSet): void {
    this._sets.push(set);
  }

  /** Removes the saved set at the supplied index. */
  removeAt(index: number): boolean {
    if (index < 0 || index >= this._sets.length) return false;
    this._sets.splice(index, 1);
    return true;
  }

  /** Changes the display name of the set at the supplied index. */
  rename(index: number, name: string): boolean {
    if (index < 0 || index >= this._sets.length) return false;
    if (this._sets[index].getName() === name) return false;
    this._sets[index].setName(name);
    return true;
  }

  /** Moves a saved set to a new position. */
  move(from: number, to: number): boolean {
    if (from < 0 || from >= this._sets.length) return false;
    if (to < 0 || to >= this._sets.length || from === to) return false;
    const [item] = this._sets.splice(from, 1);
    this._sets.splice(to, 0, item);
    return true;
  }

  /** Saves the grid's current selection of enabled Live cells. */
  captureEnabledSet(bins: LiveObjectBins, name: string): LiveObjectSet {
    const set = new LiveObjectSet();
    set.setName(name);
    const enabled = bins.getEnabledLiveObjectSet();
    set.setLiveObjectIds(enabled.map((o) => o.getUniqueId()));
    this._sets.push(set);
    return set;
  }

  /** Makes the saved set the grid's current enabled selection. */
  applySet(index: number, bins: LiveObjectBins): boolean {
    if (index < 0 || index >= this._sets.length) return false;
    const objects = this._sets[index].resolveLiveObjects(bins);
    return bins.setEnabledFromLiveObjectSet(objects);
  }

  saveAsXML(): Element {
    const elem = new Element('liveObjectSetList');
    for (const set of this._sets) {
      elem.addElement(set.saveAsXML());
    }
    return elem;
  }

  /** Reconstructs the Live object set list from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(
    data: Element,
    bins: LiveObjectBins,
    context?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): LiveObjectSetList {
    const ctx = context ?? new XmlLoadContext(data);
    checkRoot(data, 'liveObjectSetList', ctx);
    checkShape(data, [], ['liveObjectSet'], ctx, ['liveObjectSet']);
    const list = new LiveObjectSetList();
    for (const node of data.getElements('liveObjectSet'))
      list._sets.push(LiveObjectSet.loadFromXML(node, bins, ctx));
    return context ? list : requireXmlValue(ctx.result(list), sink);
  }

  deepCopy(): BlueDataObject {
    const copy = new LiveObjectSetList();
    for (const set of this._sets) {
      copy._sets.push(set.deepCopy() as LiveObjectSet);
    }
    return copy;
  }
}
