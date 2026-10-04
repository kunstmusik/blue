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

export class InstrumentLibrary {
  private _rootCategory: InstrumentCategory;

  constructor() {
    this._rootCategory = new InstrumentCategory('Instrument Library', true);
  }

  getRootCategory(): InstrumentCategory {
    return this._rootCategory;
  }

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

  addInstrument(instr: Instrument): void {
    this._rootCategory.addInstrument(instr);
  }

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

  saveAsXML(): Element {
    const elem = new Element('instrumentLibrary');
    elem.addElement(this._rootCategory.saveAsXML());
    return elem;
  }

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
   * references with the original. Delegates to
   * {@link InstrumentCategory.deepCopy} for the recursive tree copy.
   */
  deepCopy(mode: CopyMode = 'duplication'): InstrumentLibrary {
    const copy = new InstrumentLibrary();
    copy._rootCategory = this._rootCategory.deepCopy(mode);
    return copy;
  }
}
