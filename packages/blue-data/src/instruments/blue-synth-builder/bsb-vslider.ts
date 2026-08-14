/**
 * BSBVSlider — vertical slider widget.
 * Mirrors the Java BSBVSlider class.
 */
import { Element } from '../../serialization/xml-reader';
import { BSBWidget } from './bsb-widget';
import { JavaDecimal } from '../../automation/java-decimal';
import { defaultBsbResolution, parseExactBsbResolution, parseLegacyBsbResolution } from './bsb-resolution';
import { snapToResolutionJava } from '../../automation/java-decimal';

export class BSBVSlider extends BSBWidget {
  sliderHeight = 150;
  resolutionDecimal: JavaDecimal = defaultBsbResolution();
  valueDisplayEnabled = true;
  randomizable = true;

  loadFromXML(data: Element): void {
    this.loadFromXMLCommon(data);
    const h = data.getTextString('sliderHeight');
    if (h) this.sliderHeight = parseInt(h, 10);
    const exactResolution = data.getTextString('bdresolution');
    const legacyResolution = data.getTextString('resolution');
    if (exactResolution) this.setResolutionText(exactResolution);
    else if (legacyResolution) this.setResolutionText(parseLegacyBsbResolution(legacyResolution).canonicalText);
    const vde = data.getElement('valueDisplayEnabled');
    if (vde) this.valueDisplayEnabled = vde.getTextString() === 'true';
    const rand = data.getElement('randomizable');
    if (rand) this.randomizable = rand.getTextString() === 'true';
  }

  randomize(): void {
    if (!this.randomizable) return;
    const range = this.maximum - this.minimum;
    const raw = range * Math.random();
    this.value = this.minimum + snapToResolutionJava(raw, 0, range, this.resolutionDecimal);
  }

  get resolution(): number { return this.resolutionDecimal.doubleValue; }
  set resolution(value: number) {
    this.setResolutionText(parseLegacyBsbResolution(String(value)).canonicalText);
  }

  getResolutionText(): string { return this.resolutionDecimal.canonicalText; }
  setResolutionText(text: string): void {
    const next = parseExactBsbResolution(text);
    this.resolutionDecimal = next;
    this.value = snapToResolutionJava(this.value, this.minimum, this.maximum, next);
  }

  override deepCopy(): this {
    const copy = super.deepCopy();
    copy.resolutionDecimal = this.resolutionDecimal;
    return copy;
  }
}
