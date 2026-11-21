import { XmlLoadContext } from '../../serialization/xml-load';
/**
 * BSBTextField — text input field.
 * Extends BSBObject directly (not automatable).
 * Contributes its text value as a replacement.
 */
import { Element } from '../../serialization/xml-reader';
import { BSBWidget } from './bsb-widget';
import { BSBCompilationUnit } from './bsb-compilation-unit';

export class BSBTextField extends BSBWidget {
  /** Current text entered in the widget. */
  textValue = '';
  /** Width of the text entry field in pixels. */
  textFieldWidth = 100;

  override getPresetValue(): string {
    return this.textValue;
  }

  override setPresetValue(val: string): void {
    this.textValue = val;
  }

  override collectReplacements(unit: BSBCompilationUnit): void {
    unit.addReplacementValue(this.objectName, this.textValue);
  }

  /** Reconstructs the text-field widget from its Blue XML element, using the supplied diagnostic context when provided. */
  loadFromXML(data: Element, context = new XmlLoadContext(data)): void {
    this.loadFromXMLCommon(data, context);
    const text = data.getTextString('value');
    if (text !== null) this.textValue = text;
    const tw = data.getTextString('textFieldWidth');
    if (tw) this.textFieldWidth = parseInt(tw, 10);
  }
}
