import { XmlLoadContext } from '../serialization/xml-load';
import { checkRoot, checkShape, readText, parseXmlInteger } from '../utilities/xml';
import { Element } from '../serialization/xml-reader';

export class ParameterIdList {
  private _ids: string[] = [];
  private _selectedIndex = -1;

  addParameterId(id: string): void {
    if (this._ids.includes(id)) {
      return;
    }

    const currentSelected =
      this.getSelectedIndex() > 0 ? this.getParameterId(this.getSelectedIndex()) : null;

    this._ids.push(id);
    this._ids.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    if (this._ids.length > 0 && this._selectedIndex < 0) {
      this._selectedIndex = 0;
    } else if (this._selectedIndex >= this._ids.length) {
      this._selectedIndex = this._ids.length - 1;
    } else if (currentSelected !== null) {
      this._selectedIndex = this._ids.indexOf(currentSelected);
    }
  }

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

  contains(id: string): boolean {
    return this._ids.includes(id);
  }

  clear(): void {
    this._ids = [];
    this._selectedIndex = -1;
  }

  size(): number {
    return this._ids.length;
  }

  getParameterId(index: number): string {
    return this._ids[index];
  }

  getIds(): string[] {
    return [...this._ids];
  }

  getSelectedIndex(): number {
    if (this._ids.length === 0) return -1;
    if (this._selectedIndex >= this._ids.length) return this._ids.length - 1;
    return this._selectedIndex;
  }

  setSelectedIndex(index: number): void {
    this._selectedIndex = index;
  }

  getSelectedId(): string | undefined {
    const idx = this.getSelectedIndex();
    return idx >= 0 ? this._ids[idx] : undefined;
  }

  setSelectedParameter(id: string): void {
    const idx = this._ids.indexOf(id);
    if (idx !== -1) {
      this._selectedIndex = idx;
    }
  }

  saveAsXML(): Element {
    const elem = new Element('parameterIdList');
    elem.setAttribute('selectedIndex', this._selectedIndex.toString());
    for (const id of this._ids) {
      elem.addElement('parameterId').setText(id);
    }
    return elem;
  }

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
    const selected = data.getAttribute('selectedIndex');
    list._selectedIndex =
      selected === null
        ? list._ids.length
          ? 0
          : -1
        : parseXmlInteger(selected, context.at(data), -1, list._ids.length - 1, '@selectedIndex');
    return list;
  }

  deepCopy(): ParameterIdList {
    const copy = new ParameterIdList();
    copy._ids = [...this._ids];
    copy._selectedIndex = this._selectedIndex;
    return copy;
  }
}
