import { Element } from '../serialization/xml-reader';
import { XmlLoadContext, requireXmlValue } from '../serialization/xml-load';
import type { XmlDiagnosticSink } from '../serialization/xml-load';
import { checkRoot, checkShape, readText } from '../utilities/xml';
import { BlueDataObject } from '../blue-data-object';
import { LiveObject } from './live-object';
import { LiveObjectBins } from './live-object-bins';

export class LiveObjectSet implements BlueDataObject {
  private _name = '';
  private _liveObjectIds: string[] = [];

  /** Creates an empty named selection of Live cells. */
  constructor() {}

  /** Returns the name stored on the Live object set. */
  getName(): string {
    return this._name;
  }

  /** Sets the name stored on the Live object set. */
  setName(name: string): void {
    this._name = name;
  }

  /** Returns the Live object IDs stored on the Live object set. */
  getLiveObjectIds(): string[] {
    return this._liveObjectIds;
  }

  /** Sets the Live object IDs stored on the Live object set. */
  setLiveObjectIds(ids: string[]): void {
    this._liveObjectIds = ids;
  }

  saveAsXML(): Element {
    const elem = new Element('liveObjectSet');
    elem.setAttribute('name', this._name);
    for (const id of this._liveObjectIds) {
      elem.addElement('liveObjectRef').setText(id);
    }
    return elem;
  }

  /** Reconstructs the Live object set from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(
    data: Element,
    bins: LiveObjectBins,
    context?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): LiveObjectSet {
    const ctx = context ?? new XmlLoadContext(data);
    checkRoot(data, 'liveObjectSet', ctx);
    checkShape(data, ['name'], ['liveObjectRef'], ctx, ['liveObjectRef']);
    const set = new LiveObjectSet();
    set._name = data.getAttribute('name') ?? '';
    for (const node of data.getElements('liveObjectRef')) {
      const id = readText(node, ctx);
      if (id.trim() === '')
        throw ctx.at(node).error({
          code: 'value',
          value: id,
          message: 'Live set reference must be nonempty.',
          recovery: 'Supply a saved Live object ID.',
        });
      set._liveObjectIds.push(id);
      if (!bins.getLiveObjectByUniqueId(id))
        ctx.at(node).diagnostic({
          code: 'P-LIVE-UNRESOLVED-REF',
          severity: 'warning',
          value: id,
          message: 'Saved Live set references a missing object.',
          recovery:
            'The ID is retained on save; applying this set has no effect for this missing target.',
        });
    }
    return context ? set : requireXmlValue(ctx.result(set), sink);
  }

  deepCopy(): BlueDataObject {
    const copy = new LiveObjectSet();
    copy._name = this._name;
    copy._liveObjectIds = [...this._liveObjectIds];
    return copy;
  }

  /** Resolves the stored cell IDs against the current Blue Live grid. */
  resolveLiveObjects(bins: LiveObjectBins): LiveObject[] {
    const result: LiveObject[] = [];
    for (const id of this._liveObjectIds) {
      const obj = bins.getLiveObjectByUniqueId(id);
      if (obj) result.push(obj);
    }
    return result;
  }
}
