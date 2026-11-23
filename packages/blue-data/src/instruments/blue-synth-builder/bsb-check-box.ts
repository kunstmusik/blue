import { XmlLoadContext } from '../../serialization/xml-load';
import { readBoolean } from '../../utilities/xml';
/**
 * BSBCheckBox — binary on/off control.
 * Mirrors the Java BSBCheckBox class.
 */
import { Element } from '../../serialization/xml-reader';
import { BSBWidget } from './bsb-widget';
import { BSBCompilationUnit } from './bsb-compilation-unit';
import { Parameter } from '../../automation/parameter';

export class BSBCheckBox extends BSBWidget {
  /** Text displayed beside the checkbox. */
  label = 'label';
  /** Whether the checkbox is checked. */
  selected = false;
  /** Whether this widget participates in value randomization. */
  randomizable = true;

  override getPresetValue(): string {
    return this.selected ? 'true' : 'false';
  }

  override setPresetValue(val: string): void {
    if (val.startsWith('ver2:')) {
      const parsed = parseFloat(val.substring(5));
      if (Number.isFinite(parsed)) {
        this.setValue(parsed);
      }
    } else {
      // Legacy Java Blue: "true" or "false"
      this.setValue(val.toLowerCase() === 'true' ? 1 : 0);
    }
  }

  override setValue(val: number): void {
    this.value = val;
    this.selected = val > 0;
  }

  override collectReplacements(unit: BSBCompilationUnit, parameters?: Parameter[]): void {
    this.addCompilationReplacement(unit, this.objectName, this.selected ? '1' : '0', parameters);
  }

  /** Reconstructs the checkbox widget from its Blue XML element, using the supplied diagnostic context when provided. */
  loadFromXML(data: Element, context = new XmlLoadContext(data)): void {
    this.loadFromXMLCommon(data, context);
    const lbl = data.getTextString('label');
    if (lbl !== null) this.label = lbl;
    const sel = data.getTextString('selected');
    this.setValue(sel === 'true' ? 1 : 0);
    const rand = data.getElement('randomizable');
    if (rand) this.randomizable = readBoolean(rand, context);
  }

  /** Picks a new checkbox widget value when randomization is enabled. */
  randomize(): void {
    if (!this.randomizable) return;
    this.setValue(Math.random() >= 0.5 ? 1 : 0);
  }
}
