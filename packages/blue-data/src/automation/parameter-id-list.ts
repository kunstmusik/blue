import { XmlLoadContext } from '../serialization/xml-load';
import { checkRoot, checkShape, readText, parseXmlInteger } from '../utilities/xml';
import { Element } from '../serialization/xml-reader';

const CASE_INSENSITIVE_COLLATOR = new Intl.Collator(undefined, { sensitivity: 'base' });

/** Ordered collection of automation parameter identifiers with a single selection. */
export class ParameterIdList {
  private _ids: string[] = [];
  private _selectedIndex = -1;
  private _isSorted = true;

  /** Adds a parameter ID if it is absent and updates the selection index as needed. */
  addParameterId(id: string): void {
    if (this._ids.includes(id)) {
      return;
    }

    const selectedIdx = this.getSelectedIndex();
    const currentSelected = selectedIdx > 0 ? this._ids[selectedIdx] : null;

    if (!this._isSorted) {
      this._ids.push(id);
      this._ids.sort((a, b) => CASE_INSENSITIVE_COLLATOR.compare(a, b));
      this._isSorted = true;
    } else {
      let lo = 0;
      let hi = this._ids.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (CASE_INSENSITIVE_COLLATOR.compare(this._ids[mid], id) <= 0) {
          lo = mid + 1;
        } else {
          hi = mid;
        }
      }
      this._ids.splice(lo, 0, id);
    }

    if (this._ids.length > 0 && this._selectedIndex < 0) {
      this._selectedIndex = 0;
    } else if (this._selectedIndex >= this._ids.length) {
      this._selectedIndex = this._ids.length - 1;
    } else if (currentSelected !== null) {
      this._selectedIndex = this._ids.indexOf(currentSelected);
    }
  }

  /** Batch-insert parameter IDs with a single case-insensitive sort instead of per-item splices. */
  addParameterIds(ids: Iterable<string>): void {
    const existing = new Set(this._ids);
    let added = false;
    const selectedIdx = this.getSelectedIndex();
    const currentSelected = selectedIdx > 0 ? this._ids[selectedIdx] : null;

    for (const id of ids) {
      if (existing.has(id)) continue;
      existing.add(id);
      this._ids.push(id);
      added = true;
    }
    if (!added) return;

    this._ids.sort((a, b) => CASE_INSENSITIVE_COLLATOR.compare(a, b));
    this._isSorted = true;

    if (this._ids.length > 0 && this._selectedIndex < 0) {
      this._selectedIndex = 0;
    } else if (this._selectedIndex >= this._ids.length) {
      this._selectedIndex = this._ids.length - 1;
    } else if (currentSelected !== null) {
      this._selectedIndex = this._ids.indexOf(currentSelected);
    }
  }

  /** Removes the given ID if present and keeps the selection index within the list. */
  removeParameterId(id: string): void {
    const idx = this._ids.indexOf(id);
    if (idx === -1) return;
    this._ids.splice(idx, 1);

    if (this._ids.length === 0) {
      this._selectedIndex = -1;
    } else if (this._selectedIndex >= this._ids.length) {
      this._selectedIndex = this._ids.length - 1;
    } else if (idx < this._selectedIndex) {
      this._selectedIndex--;
    }
  }

  /** Checks whether the given ID appears in the list. */
  contains(id: string): boolean {
    return this._ids.includes(id);
  }

  /** Removes all IDs and resets the selection. */
  clear(): void {
    this._ids = [];
    this._selectedIndex = -1;
  }

  /** Returns the number of entries stored in the parameter ID list. */
  size(): number {
    return this._ids.length;
  }

  /** Returns the entry at the supplied index in the parameter ID list’s IDs. */
  getParameterId(index: number): string {
    return this._ids[index];
  }

  /** Returns a snapshot of the IDs in their stored order. */
  getIds(): string[] {
    return [...this._ids];
  }

  /** Returns the zero-based index of the selected item. */
  getSelectedIndex(): number {
    if (this._ids.length === 0) return -1;
    if (this._selectedIndex >= this._ids.length) return this._ids.length - 1;
    return this._selectedIndex;
  }

  /** Sets the zero-based index of the selected item. */
  setSelectedIndex(index: number): void {
    this._selectedIndex = index;
  }

  /** Returns the selected ID, or undefined if there is no selection. */
  getSelectedId(): string | undefined {
    const idx = this.getSelectedIndex();
    return idx >= 0 ? this._ids[idx] : undefined;
  }

  /** Selects a stored ID. An unknown ID leaves the selection unchanged. */
  setSelectedParameter(id: string): void {
    const idx = this._ids.indexOf(id);
    if (idx !== -1) {
      this._selectedIndex = idx;
    }
  }

  /** Serializes the parameter ID list and its persisted settings to a new Blue XML element. */
  saveAsXML(): Element {
    const elem = new Element('parameterIdList');
    elem.setAttribute('selectedIndex', this._selectedIndex.toString());
    for (const id of this._ids) {
      elem.addElement('parameterId').setText(id);
    }
    return elem;
  }

  /** Reconstructs the parameter ID list from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(data: Element, context = new XmlLoadContext(data)): ParameterIdList {
    checkRoot(data, 'parameterIdList', context);
    checkShape(data, ['selectedIndex'], ['parameterId'], context, ['parameterId']);
    const list = new ParameterIdList();
    for (const node of data.getElements('parameterId')) {
      const id = readText(node, context);
      if (!id.trim() || list._ids.includes(id))
        throw context.at(node).error({
          code: 'conflict',
          value: id,
          message: 'Empty or duplicate parameter reference.',
          recovery: 'Supply distinct nonempty identities.',
        });
      list._ids.push(id);
    }
    list._isSorted = false;
    const selected = data.getAttribute('selectedIndex');
    list._selectedIndex =
      selected === null
        ? list._ids.length
          ? 0
          : -1
        : parseXmlInteger(selected, context.at(data), -1, list._ids.length - 1, '@selectedIndex');
    return list;
  }

  /** Copies the parameter ID list and its editable state. */
  deepCopy(): ParameterIdList {
    const copy = new ParameterIdList();
    copy._ids = [...this._ids];
    copy._selectedIndex = this._selectedIndex;
    copy._isSorted = this._isSorted;
    return copy;
  }
}
