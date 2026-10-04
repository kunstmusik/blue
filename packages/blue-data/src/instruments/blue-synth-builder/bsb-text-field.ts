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
  textValue = '';
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

  loadFromXML(data: Element, context = new XmlLoadContext(data)): void {
    this.loadFromXMLCommon(data, context);
    const text = data.getTextString('value');
    if (text !== null) this.textValue = text;
    const tw = data.getTextString('textFieldWidth');
    if (tw) this.textFieldWidth = parseInt(tw, 10);
  }
}
