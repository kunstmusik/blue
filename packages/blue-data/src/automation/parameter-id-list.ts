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

  static loadFromXML(data: Element): ParameterIdList {
    const list = new ParameterIdList();
    const ids = data.getElements('parameterId');
    while (ids.hasMoreElements()) {
      list._ids.push(ids.next().getTextString());
    }
    const selAttr = data.getAttribute('selectedIndex');
    if (selAttr !== null && selAttr !== undefined) {
      list._selectedIndex = parseInt(selAttr, 10);
    }
    if (list._ids.length > 0 && list._selectedIndex < 0) {
      list._selectedIndex = 0;
    }
    return list;
  }

  deepCopy(): ParameterIdList {
    const copy = new ParameterIdList();
    copy._ids = [...this._ids];
    copy._selectedIndex = this._selectedIndex;
    return copy;
  }
}
