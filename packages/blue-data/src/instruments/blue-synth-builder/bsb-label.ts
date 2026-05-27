/**
 * BSBLabel — static text label.
 * Does not contribute replacement values — visual only.
 */
import { Element } from '../../serialization/xml-reader';
import { BSBWidget } from './bsb-widget';
import { BSBCompilationUnit } from './bsb-compilation-unit';
import { loadFontFromXML, type BSBFont } from './bsb-knob';
import { parseLegacySwingHtmlFont, stripLegacySwingHtml } from './legacy-swing-html';

export class BSBLabel extends BSBWidget {
  label = 'label';
  font: BSBFont = { name: 'Roboto', size: 12, style: 0 };

  override getPresetValue(): string | null {
    return null;
  }

  override setPresetValue(_val: string): void {
  }

  override collectReplacements(_unit: BSBCompilationUnit): void {
  }

  loadFromXML(data: Element): void {
    this.loadFromXMLCommon(data);
    const versionAttr = data.getAttribute('version');
    const parsedVersion = versionAttr ? Number.parseInt(versionAttr, 10) : 1;
    const version = Number.isFinite(parsedVersion) ? parsedVersion : 1;
    const text = data.getTextString('label') ?? '';

    if (version < 2) {
      this.font = parseLegacySwingHtmlFont(text);
      this.label = stripLegacySwingHtml(text);
      return;
    }

    this.label = text;
    const fontElem = data.getElement('font');
    if (fontElem) this.font = loadFontFromXML(fontElem);
  }
}
