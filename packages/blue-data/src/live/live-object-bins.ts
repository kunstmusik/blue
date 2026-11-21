import { Element } from '../serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { BlueDataObject } from '../blue-data-object';
import { LiveObject } from './live-object';
import { XmlLoadContext } from '../serialization/xml-load';
import { checkRoot, checkShape, parseXmlInteger } from '../utilities/xml';
import type { CopyMode } from '../deep-copyable';

export class LiveObjectBins implements BlueDataObject {
  private _cells: Array<Array<LiveObject | null>>;

  /** Creates an empty rectangular grid, with one column and eight rows by default. */
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

  /** Wraps the supplied column-major cell array without copying it. */
  static fromGrid(grid: Array<Array<LiveObject | null>>): LiveObjectBins {
    const bins = Object.create(LiveObjectBins.prototype) as LiveObjectBins;
    bins._cells = grid;
    return bins;
  }

  /** Returns the number of columns in the Blue Live grid. */
  getColumnCount(): number {
    return this._cells.length;
  }

  /** Returns the number of rows in the Blue Live grid. */
  getRowCount(): number {
    return this._cells.length > 0 ? this._cells[0].length : 0;
  }

  /** Returns the cell at the supplied zero-based column and row, or null when empty or out of range. */
  getLiveObject(column: number, row: number): LiveObject | null {
    if (column < 0 || column >= this._cells.length) return null;
    if (row < 0 || row >= this._cells[column].length) return null;
    return this._cells[column][row];
  }

  /** Sets or clears the cell at the supplied grid coordinates. */
  setLiveObject(column: number, row: number, obj: LiveObject | null): void {
    if (column < 0 || column >= this._cells.length) return;
    if (row < 0 || row >= this._cells[column].length) return;
    this._cells[column][row] = obj;
  }

  /** Inserts an empty row at the supplied position. */
  insertRow(index: number): boolean {
    if (index < 0) index = 0;
    const rows = this.getRowCount();
    if (index > rows) index = rows;
    for (let c = 0; c < this._cells.length; c++) {
      this._cells[c].splice(index, 0, null);
    }
    return true;
  }

  /** Removes the row at the supplied position. */
  removeRow(index: number): boolean {
    if (index < 0 || index >= this.getRowCount() || this.getRowCount() <= 1) return false;
    for (let c = 0; c < this._cells.length; c++) {
      this._cells[c].splice(index, 1);
    }
    return true;
  }

  /** Inserts an empty column at the supplied position. */
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

  /** Removes the column at the supplied position. */
  removeColumn(index: number): boolean {
    if (index < 0 || index >= this._cells.length || this._cells.length <= 1) return false;
    this._cells.splice(index, 1);
    return true;
  }

  /** Captures the currently enabled cells as a Live object set. */
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

  /** Updates the grid's enable flags using the cell identities stored in the set. */
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

  /** Finds a populated cell by its persistent identifier. */
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

  /** Returns the zero-based column of the supplied cell instance, or -1 if absent. */
  getColumnForObject(liveObject: LiveObject | null): number {
    if (!liveObject) return -1;
    for (let c = 0; c < this._cells.length; c++) {
      for (const obj of this._cells[c]) {
        if (obj === liveObject) return c;
      }
    }
    return -1;
  }

  /** Returns the zero-based row of the supplied cell instance, or -1 if absent. */
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

  /** Reconstructs the Blue Live grid from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(
    data: Element,
    objRefMap?: ObjRefLoadMap,
    context = new XmlLoadContext(data),
  ): LiveObjectBins {
    checkRoot(data, 'liveObjectBins', context);
    checkShape(data, ['columns', 'rows'], ['bin'], context, ['bin']);
    const columns = parseXmlInteger(
      data.getAttribute('columns') ?? '',
      context.at(data),
      1,
      Number.MAX_SAFE_INTEGER,
      '@columns',
    );
    const rows = parseXmlInteger(
      data.getAttribute('rows') ?? '',
      context.at(data),
      1,
      Number.MAX_SAFE_INTEGER,
      '@rows',
    );
    const bins = [...data.getElements('bin')];
    if (bins.length !== columns)
      throw context.at(data).error({
        code: 'cardinality',
        message: 'Live grid column count does not match its declared dimensions.',
        recovery: 'Supply exactly the declared number of bins.',
      });
    // Validate actual slots before allocating: authored dimensions never drive a padded allocation.
    const ids = new Set<string>();
    const grid = bins.map((bin) => {
      checkShape(bin, [], ['null', 'liveObject'], context, ['null', 'liveObject']);
      const slots = [...bin.getElements()];
      if (slots.length !== rows)
        throw context.at(bin).error({
          code: 'cardinality',
          message: 'Live grid row count does not match its declared dimensions.',
          recovery: 'Supply exactly the declared number of ordered slots.',
        });
      return slots.map((slot) => {
        if (slot.getName() === 'null') {
          checkShape(slot, [], [], context);
          return null;
        }
        const object = LiveObject.loadFromXML(slot, objRefMap, context);
        const id = object.getUniqueId();
        if (ids.has(id))
          throw context.at(slot).error({
            code: 'reference',
            member: '@uniqueId',
            value: id,
            message: 'Duplicate Live object identity.',
            recovery: 'Assign distinct Live object IDs.',
          });
        ids.add(id);
        return object;
      });
    });
    return LiveObjectBins.fromGrid(grid);
  }

  deepCopy(mode: CopyMode = 'duplication'): BlueDataObject {
    const grid: Array<Array<LiveObject | null>> = [];
    for (const col of this._cells) {
      const newCol: Array<LiveObject | null> = [];
      for (const obj of col) {
        newCol.push(obj ? (obj.deepCopy(mode) as LiveObject) : null);
      }
      grid.push(newCol);
    }
    return LiveObjectBins.fromGrid(grid);
  }
}
