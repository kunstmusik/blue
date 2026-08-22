import { Element } from '../serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { BlueDataObject } from '../blue-data-object';
import { LiveObject } from './live-object';

export class LiveObjectBins implements BlueDataObject {
  private _cells: Array<Array<LiveObject | null>>;

  constructor(columns = 1, rows = 8) {
    this._cells = [];
    for (let c = 0; c < columns; c++) {
      const col: Array<LiveObject | null> = [];
      for (let r = 0; r < rows; r++) {
        col.push(null);
      }
      this._cells.push(col);
    }
  }

  static fromGrid(grid: Array<Array<LiveObject | null>>): LiveObjectBins {
    const bins = Object.create(LiveObjectBins.prototype) as LiveObjectBins;
    bins._cells = grid;
    return bins;
  }

  getColumnCount(): number {
    return this._cells.length;
  }

  getRowCount(): number {
    return this._cells.length > 0 ? this._cells[0].length : 0;
  }

  getLiveObject(column: number, row: number): LiveObject | null {
    if (column < 0 || column >= this._cells.length) return null;
    if (row < 0 || row >= this._cells[column].length) return null;
    return this._cells[column][row];
  }

  setLiveObject(column: number, row: number, obj: LiveObject | null): void {
    if (column < 0 || column >= this._cells.length) return;
    if (row < 0 || row >= this._cells[column].length) return;
    this._cells[column][row] = obj;
  }

  insertRow(index: number): boolean {
    if (index < 0) index = 0;
    const rows = this.getRowCount();
    if (index > rows) index = rows;
    for (let c = 0; c < this._cells.length; c++) {
      this._cells[c].splice(index, 0, null);
    }
    return true;
  }

  removeRow(index: number): boolean {
    if (index < 0 || index >= this.getRowCount() || this.getRowCount() <= 1) return false;
    for (let c = 0; c < this._cells.length; c++) {
      this._cells[c].splice(index, 1);
    }
    return true;
  }

  insertColumn(index: number): boolean {
    if (index < 0) index = 0;
    if (index > this._cells.length) index = this._cells.length;
    const rows = this.getRowCount();
    const newCol: Array<LiveObject | null> = [];
    for (let r = 0; r < rows; r++) {
      newCol.push(null);
    }
    this._cells.splice(index, 0, newCol);
    return true;
  }

  removeColumn(index: number): boolean {
    if (index < 0 || index >= this._cells.length || this._cells.length <= 1) return false;
    this._cells.splice(index, 1);
    return true;
  }

  getEnabledLiveObjectSet(): LiveObject[] {
    const result: LiveObject[] = [];
    for (const col of this._cells) {
      for (const obj of col) {
        if (obj !== null && obj.isEnabled()) {
          result.push(obj);
        }
      }
    }
    return result;
  }

  setEnabledFromLiveObjectSet(set: LiveObject[]): boolean {
    const setIds = new Set(set.map((o) => o.getUniqueId()));
    let changed = false;
    for (const col of this._cells) {
      for (const obj of col) {
        if (obj !== null) {
          const enabled = setIds.has(obj.getUniqueId());
          if (obj.isEnabled() !== enabled) {
            obj.setEnabled(enabled);
            changed = true;
          }
        }
      }
    }
    return changed;
  }

  getLiveObjectByUniqueId(uniqueId: string | null): LiveObject | null {
    if (!uniqueId) return null;
    for (const col of this._cells) {
      for (const obj of col) {
        if (obj !== null && obj.getUniqueId() === uniqueId) {
          return obj;
        }
      }
    }
    return null;
  }

  getColumnForObject(liveObject: LiveObject | null): number {
    if (!liveObject) return -1;
    for (let c = 0; c < this._cells.length; c++) {
      for (const obj of this._cells[c]) {
        if (obj === liveObject) return c;
      }
    }
    return -1;
  }

  getRowForObject(liveObject: LiveObject | null): number {
    if (!liveObject) return -1;
    for (const col of this._cells) {
      for (let r = 0; r < col.length; r++) {
        if (col[r] === liveObject) return r;
      }
    }
    return -1;
  }

  saveAsXML(_objRefMap?: ObjRefSaveMap): Element {
    const elem = new Element('liveObjectBins');
    elem.setAttribute('columns', this._cells.length.toString());
    const rows = this.getRowCount();
    elem.setAttribute('rows', rows.toString());

    for (const col of this._cells) {
      const bin = elem.addElement('bin');
      for (const obj of col) {
        if (obj === null) {
          bin.addElement('null');
        } else {
          bin.addElement(obj.saveAsXML(_objRefMap));
        }
      }
    }

    return elem;
  }

  static loadFromXML(data: Element, objRefMap?: ObjRefLoadMap): LiveObjectBins {
    const columnsAttr = data.getAttribute('columns');
    const rowsAttr = data.getAttribute('rows');
    if (!columnsAttr || !rowsAttr) {
      throw new Error('LiveObjectBins could not load: missing columns/rows attributes');
    }
    const columns = parseInt(columnsAttr, 10);
    const rows = parseInt(rowsAttr, 10);

    const grid: Array<Array<LiveObject | null>> = [];
    for (let c = 0; c < columns; c++) {
      const col: Array<LiveObject | null> = [];
      for (let r = 0; r < rows; r++) {
        col.push(null);
      }
      grid.push(col);
    }

    const bins = LiveObjectBins.fromGrid(grid);
    let column = 0;

    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      if (node.getName() === 'bin') {
        let row = 0;
        const lObjNodes = node.getElements();
        while (lObjNodes.hasMoreElements()) {
          const lObjNode = lObjNodes.next();
          if (lObjNode.getName() === 'liveObject' && column < columns && row < rows) {
            bins._cells[column][row] = LiveObject.loadFromXML(lObjNode, objRefMap);
          }
          row++;
        }
        column++;
      }
    }

    return bins;
  }

  deepCopy(): BlueDataObject {
    const grid: Array<Array<LiveObject | null>> = [];
    for (const col of this._cells) {
      const newCol: Array<LiveObject | null> = [];
      for (const obj of col) {
        newCol.push(obj ? obj.deepCopy() as LiveObject : null);
      }
      grid.push(newCol);
    }
    return LiveObjectBins.fromGrid(grid);
  }
}
