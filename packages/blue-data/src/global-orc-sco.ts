/**
 * GlobalOrcSco — holds global orchestra and score code for CSD generation.
 * Mirrors the Java GlobalOrcSco class.
 *
 * Global orc/sco is code that applies to the entire CSD, not tied to any
 * specific instrument or sound object.
 */
import { Element } from './serialization/xml-reader';
import { XmlLoadContext } from './serialization/xml-load';
import { checkRoot, checkShape, readText } from './utilities/xml';

/** Stores project-wide Csound orchestra and score source text. */
export class GlobalOrcSco {
  private _globalOrc = '';
  private _globalSco = '';

  /** Creates empty source blocks or copies both blocks from another instance. */
  constructor(other?: GlobalOrcSco) {
    if (other) {
      this._globalOrc = other._globalOrc;
      this._globalSco = other._globalSco;
    }
  }

  /** Returns the authored project orchestra text. */
  getGlobalOrc(): string {
    return this._globalOrc;
  }

  /** Replaces the project-wide orchestra text. */
  setGlobalOrc(orc: string): void {
    this._globalOrc = orc;
  }

  /** Returns the authored project score text. */
  getGlobalSco(): string {
    return this._globalSco;
  }

  /** Replaces the project-wide score text. */
  setGlobalSco(sco: string): void {
    this._globalSco = sco;
  }

  // ─── XML ───

  /** Writes both Csound source blocks to a new XML element. */
  saveAsXML(): Element {
    const elem = new Element('globalOrcSco');
    elem.addElement('globalOrc').setText(this._globalOrc);
    elem.addElement('globalSco').setText(this._globalSco);
    return elem;
  }

  /** Loads the project orchestra and score blocks from XML. */
  static loadFromXML(data: Element, context = new XmlLoadContext(data)): GlobalOrcSco {
    checkRoot(data, 'globalOrcSco', context);
    checkShape(data, [], ['globalOrc', 'globalSco'], context);
    const gos = new GlobalOrcSco();
    const orc = data.getElement('globalOrc');
    if (orc) gos._globalOrc = readText(orc, context);
    const sco = data.getElement('globalSco');
    if (sco) gos._globalSco = readText(sco, context);
    return gos;
  }
}
