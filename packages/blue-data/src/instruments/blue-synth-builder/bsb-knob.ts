import { XmlLoadContext } from '../../serialization/xml-load';
import { readBoolean } from '../../utilities/xml';
/**
 * BSBKnob — rotary control widget.
 * Mirrors the Java BSBKnob class.
 */
import { Element } from '../../serialization/xml-reader';
import { BSBWidget } from './bsb-widget';
import { validateBsbFont } from './bsb-xml';
import { formatBlueNumber } from '../../utilities/number-format';

/** Font settings shared by BlueSynthBuilder widgets. */
export interface BSBFont {
  /** Font family name. */
  name: string;
  /** Font size stored by the widget. */
  size: number;
  /** Java-compatible font style bits for plain, bold, and italic rendering. */
  style: number;
}

export function loadFontFromXML(data: Element | null): BSBFont {
  const font: BSBFont = { name: 'Roboto', size: 12, style: 0 };
  if (!data) return font;
  validateBsbFont(data);
  const name = data.getTextString('name');
  if (name) font.name = name;
  const size = data.getTextString('size');
  if (size) font.size = parseFloat(size);
  const style = data.getTextString('style');
  if (style) font.style = parseInt(style, 10);
  return font;
}

export function saveFontToXML(font: BSBFont): Element {
  const elem = new Element('font');
  elem.addElement('name').setText(font.name);
  const roundedSize = Number.isFinite(font.size) ? Math.round(font.size) : 12;
  elem.addElement('size').setText(`${roundedSize}.0`);
  elem.addElement('style').setText(String(font.style));
  return elem;
}

export class BSBKnob extends BSBWidget {
  /** Knob width in pixels. */
  knobWidth = 60;
  /** Whether the widget displays its current value. */
  valueDisplayEnabled = true;
  /** Whether this widget participates in value randomization. */
  randomizable = true;
  /** Text displayed on or near the knob. */
  label = 'label';
  /** Whether the knob label is visible. */
  labelEnabled = true;
  /** Font used for the widget label. */
  labelFont: BSBFont = { name: 'Roboto', size: 12, style: 0 };

  override getPresetValue(): string {
    return `ver2:${formatBlueNumber(this.value)}`;
  }

  override setPresetValue(val: string): void {
    let nextValue = Number.NaN;

    if (val.indexOf(':') < 0) {
      const relative = parseFloat(val);
      if (Number.isFinite(relative)) {
        nextValue = relative * (this.maximum - this.minimum) + this.minimum;
      }
    } else {
      nextValue = parseFloat(val.substring(val.indexOf(':') + 1));
    }

    if (Number.isFinite(nextValue)) {
      this.setValue(nextValue);
    }
  }

  /** Reconstructs the knob widget from its Blue XML element, using the supplied diagnostic context when provided. */
  loadFromXML(data: Element, context = new XmlLoadContext(data)): void {
    this.loadFromXMLCommon(data, context);
    const versionAttribute = data.getAttribute('version');
    const version = versionAttribute === null ? 1 : Number(versionAttribute);
    const w = data.getTextString('knobWidth');
    if (w) this.knobWidth = parseInt(w, 10);
    const vde = data.getElement('valueDisplayEnabled');
    if (vde) this.valueDisplayEnabled = readBoolean(vde, context);
    const rand = data.getElement('randomizable');
    if (rand) this.randomizable = readBoolean(rand, context);
    const lbl = data.getTextString('label');
    if (lbl !== null) this.label = lbl;
    const le = data.getElement('labelEnabled');
    this.labelEnabled = le ? readBoolean(le, context) : false;
    const fontElem = data.getElement('font');
    if (fontElem) this.labelFont = loadFontFromXML(fontElem);

    if (version === 1) {
      const range = this.maximum - this.minimum;
      this.value = this.value * range + this.minimum;
    }
  }

  /** Picks a new knob widget value when randomization is enabled. */
  randomize(): void {
    if (!this.randomizable) return;
    this.value = this.minimum + Math.random() * (this.maximum - this.minimum);
  }
}
