/**
 * InstrumentLibrary — user's library of instruments.
 * Mirrors the Java InstrumentLibrary class.
 *
 * Uses a recursive category tree structure for organizing instruments.
 * Supports Java-compatible XML format with instrumentCategory elements.
 */
import { Instrument } from './instrument';
import { InstrumentCategory } from './instrument-category';
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext, requireXmlValue } from '../serialization/xml-load';
import type { XmlDiagnosticSink } from '../serialization/xml-load';
import { checkRoot, checkShape } from '../utilities/xml';
import type { CopyMode } from '../deep-copyable';

/** Project instrument library organized as a hierarchy of categories. */
export class InstrumentLibrary {
  private _rootCategory: InstrumentCategory;

  /** Creates an empty library with a root instrument category. */
  constructor() {
    this._rootCategory = new InstrumentCategory('Instrument Library', true);
  }

  /** Returns the root category stored on the instrument library. */
  getRootCategory(): InstrumentCategory {
    return this._rootCategory;
  }

  /** Finds an instrument by name across the category hierarchy. */
  getInstrument(name: string): Instrument | undefined {
    return this.findInstrumentInCategory(this._rootCategory, name);
  }

  private findInstrumentInCategory(cat: InstrumentCategory, name: string): Instrument | undefined {
    for (const instr of cat.getInstruments()) {
      if (instr.getName() === name) return instr;
    }
    for (const subCat of cat.getSubCategories()) {
      const found = this.findInstrumentInCategory(subCat, name);
      if (found) return found;
    }
    return undefined;
  }

  /** Adds the supplied instrument to the root category. */
  addInstrument(instr: Instrument): void {
    this._rootCategory.addInstrument(instr);
  }

  /** Collects the instruments from the root and nested categories. */
  getAllInstruments(): Instrument[] {
    const result: Instrument[] = [];
    this.collectInstruments(this._rootCategory, result);
    return result;
  }

  private collectInstruments(cat: InstrumentCategory, result: Instrument[]): void {
    result.push(...cat.getInstruments());
    for (const subCat of cat.getSubCategories()) {
      this.collectInstruments(subCat, result);
    }
  }

  /** Removes an instrument by name from the category hierarchy and reports whether one was removed. */
  removeInstrument(name: string): boolean {
    return this.removeInstrumentFromCategory(this._rootCategory, name);
  }

  private removeInstrumentFromCategory(cat: InstrumentCategory, name: string): boolean {
    const instruments = cat.getInstruments();
    for (let i = 0; i < instruments.length; i++) {
      if (instruments[i].getName() === name) {
        cat.removeInstrument(instruments[i]);
        return true;
      }
    }
    for (const subCat of cat.getSubCategories()) {
      if (this.removeInstrumentFromCategory(subCat, name)) return true;
    }
    return false;
  }

  // ─── XML ───

  /** Serializes the instrument library and its persisted settings to a new Blue XML element. */
  saveAsXML(): Element {
    const elem = new Element('instrumentLibrary');
    elem.addElement(this._rootCategory.saveAsXML());
    return elem;
  }

  /** Reconstructs the instrument library from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(
    data: Element,
    providedContext?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): InstrumentLibrary {
    const context = providedContext ?? new XmlLoadContext(data);
    checkRoot(data, 'instrumentLibrary', context);
    checkShape(data, [], ['instrumentCategory'], context);
    const category = data.getElement('instrumentCategory');
    if (!category)
      throw context.at(data).error({
        code: 'cardinality',
        message: 'Instrument library requires one root category.',
        recovery: 'Supply the complete library envelope.',
      });
    const lib = new InstrumentLibrary();
    lib._rootCategory = InstrumentCategory.loadFromXML(category, context);
    return providedContext ? lib : requireXmlValue(context.result(lib), sink);
  }

  /**
   * Deep-copy the instrument library so the copy shares no mutable
   * references with the original. Recursively copies the category tree.
   */
  deepCopy(mode: CopyMode = 'duplication'): InstrumentLibrary {
    const copy = new InstrumentLibrary();
    copy._rootCategory = this._rootCategory.deepCopy(mode);
    return copy;
  }
}
