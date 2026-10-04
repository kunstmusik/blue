import { Element } from '../serialization/xml-reader';
import { XmlLoadContext, requireXmlValue } from '../serialization/xml-load';
import type { XmlDiagnosticSink } from '../serialization/xml-load';
import { checkRoot, checkShape } from '../utilities/xml';
import { BlueDataObject } from '../blue-data-object';
import { LiveObjectSet } from './live-object-set';
import { LiveObjectBins } from './live-object-bins';

export class LiveObjectSetList implements BlueDataObject {
  private _sets: LiveObjectSet[] = [];

  constructor() {}

  getSets(): LiveObjectSet[] {
    return this._sets;
  }

  add(set: LiveObjectSet): void {
    this._sets.push(set);
  }

  removeAt(index: number): boolean {
    if (index < 0 || index >= this._sets.length) return false;
    this._sets.splice(index, 1);
    return true;
  }

  rename(index: number, name: string): boolean {
    if (index < 0 || index >= this._sets.length) return false;
    if (this._sets[index].getName() === name) return false;
    this._sets[index].setName(name);
    return true;
  }

  move(from: number, to: number): boolean {
    if (from < 0 || from >= this._sets.length) return false;
    if (to < 0 || to >= this._sets.length || from === to) return false;
    const [item] = this._sets.splice(from, 1);
    this._sets.splice(to, 0, item);
    return true;
  }

  captureEnabledSet(bins: LiveObjectBins, name: string): LiveObjectSet {
    const set = new LiveObjectSet();
    set.setName(name);
    const enabled = bins.getEnabledLiveObjectSet();
    set.setLiveObjectIds(enabled.map((o) => o.getUniqueId()));
    this._sets.push(set);
    return set;
  }

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
