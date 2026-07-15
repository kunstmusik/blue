/**
 * InstrumentCategory — a category node in the instrument library tree.
 * Mirrors the Java InstrumentCategory class.
 *
 * Each category has a name, optional subcategories, and optional instruments.
 */
import { Instrument } from './instrument';
import { loadInstrumentFromXML } from './instrument-registry';
import { Element } from '../serialization/xml-reader';

export class InstrumentCategory {
  private _categoryName: string;
  private _isRoot: boolean;
  private _subCategories: InstrumentCategory[] = [];
  private _instruments: Instrument[] = [];

  constructor(categoryName = 'New Instrument Category', isRoot = false) {
    this._categoryName = categoryName;
    this._isRoot = isRoot;
  }

  getCategoryName(): string { return this._categoryName; }
  setCategoryName(name: string): void { this._categoryName = name; }

  isRoot(): boolean { return this._isRoot; }
  setRoot(root: boolean): void { this._isRoot = root; }

  getSubCategories(): InstrumentCategory[] { return this._subCategories; }
  addSubCategory(cat: InstrumentCategory): void { this._subCategories.push(cat); }
  removeSubCategory(cat: InstrumentCategory): boolean {
    const idx = this._subCategories.indexOf(cat);
    if (idx !== -1) { this._subCategories.splice(idx, 1); return true; }
    return false;
  }

  getInstruments(): Instrument[] { return this._instruments; }
  addInstrument(instr: Instrument): void { this._instruments.push(instr); }
  removeInstrument(instr: Instrument): boolean {
    const idx = this._instruments.indexOf(instr);
    if (idx !== -1) { this._instruments.splice(idx, 1); return true; }
    return false;
  }

  /**
   * Get an instrument by colon-delimited path (e.g., "2:0:3").
   */
  getInstrumentById(path: string): Instrument | undefined {
    const indices = path.split(':').map(s => parseInt(s, 10));
    return this.getInstrumentByIndices(indices, 0);
  }

  private getInstrumentByIndices(indices: number[], depth: number): Instrument | undefined {
    if (depth >= indices.length) return undefined;
    const idx = indices[depth];

    if (depth === indices.length - 1) {
      // Last index — instrument index within this category
      return this._instruments[idx];
    }

    // Intermediate index — subcategory
    const subCat = this._subCategories[idx];
    if (!subCat) return undefined;
    return subCat.getInstrumentByIndices(indices, depth + 1);
  }

  // ─── XML ───

  saveAsXML(): Element {
    const elem = new Element('instrumentCategory');
    elem.setAttribute('categoryName', this._categoryName);
    elem.setAttribute('isRoot', this._isRoot.toString());

    for (const subCat of this._subCategories) {
      elem.addElement(subCat.saveAsXML());
    }
    for (const instr of this._instruments) {
      elem.addElement(instr.saveAsXML());
    }

    return elem;
  }

  static loadFromXML(data: Element): InstrumentCategory {
    const cat = new InstrumentCategory();

    const nameAttr = data.getAttribute('categoryName');
    if (nameAttr) cat._categoryName = nameAttr;

    const rootAttr = data.getAttribute('isRoot');
    if (rootAttr) cat._isRoot = rootAttr.toLowerCase() === 'true';

    const children = data.getElements();
    while (children.hasMoreElements()) {
      const node = children.next();
      const nodeName = node.getName();

      if (nodeName === 'instrumentCategory') {
        cat._subCategories.push(InstrumentCategory.loadFromXML(node));
      } else if (nodeName === 'instrument' || nodeName === 'genericInstrument') {
        const instrument = loadInstrumentFromXML(node);
        if (instrument) cat._instruments.push(instrument);
      }
    }

    return cat;
  }
}
