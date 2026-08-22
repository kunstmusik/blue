/**
 * BSBVSliderBank — bank of multiple vertical sliders in one widget.
 * Mirrors the Java BSBVSliderBank class.
 */
import { Element } from '../../serialization/xml-reader';
import { BSBWidget } from './bsb-widget';
import { BSBCompilationUnit } from './bsb-compilation-unit';
import { BSBVSlider } from './bsb-vslider';
import { Parameter } from '../../automation/parameter';
import { formatBlueNumber } from '../../utilities/number-format';
import { JavaDecimal } from '../../automation/java-decimal';
import { defaultBsbResolution, parseExactBsbResolution, parseLegacyBsbResolution } from './bsb-resolution';
import { snapToResolutionJava } from '../../automation/java-decimal';

export class BSBVSliderBank extends BSBWidget {
  sliderHeight = 150;
  gap = 5;
  resolutionDecimal: JavaDecimal = defaultBsbResolution();
  valueDisplayEnabled = true;
  randomizable = true;
  sliders: BSBVSlider[] = [new BSBVSlider()];

  get numberOfSliders(): number {
    return this.sliders.length;
  }

  set numberOfSliders(count: number) {
    while (this.sliders.length < count) {
      const slider = new BSBVSlider();
      slider.resolutionDecimal = this.resolutionDecimal;
      this.sliders.push(slider);
    }
    while (this.sliders.length > count) {
      this.sliders.pop();
    }
  }

  override collectReplacements(
    unit: BSBCompilationUnit,
    parameters?: Parameter[],
  ): void {
    for (let i = 0; i < this.sliders.length; i++) {
      const key = `${this.objectName}_${i}`;
      this.addCompilationReplacement(unit, key, formatBlueNumber(this.sliders[i].value), parameters);
    }
  }

  override getPresetValue(): string {
    return this.sliders.map((slider) => String(slider.value)).join(':');
  }

  override setPresetValue(val: string): void {
    const values = val.split(':');
    const size = Math.min(this.sliders.length, values.length);
    for (let index = 0; index < size; index++) {
      const parsed = parseFloat(values[index]);
      if (Number.isFinite(parsed)) {
        this.sliders[index].setValue(parsed);
      }
    }
  }

  loadFromXML(data: Element): void {
    this.loadFromXMLCommon(data);
    const h = data.getTextString('sliderHeight');
    if (h) this.sliderHeight = parseInt(h, 10);
    const g = data.getTextString('gap');
    if (g) this.gap = parseInt(g, 10);
    const exactResolution = data.getTextString('bdresolution');
    const legacyResolution = data.getTextString('resolution');
    const loadedResolution = exactResolution
      ? parseExactBsbResolution(exactResolution)
      : legacyResolution
        ? parseLegacyBsbResolution(legacyResolution)
        : this.resolutionDecimal;
    this.resolutionDecimal = loadedResolution;
    const vde = data.getElement('valueDisplayEnabled');
    if (vde) this.valueDisplayEnabled = vde.getTextString() === 'true';
    const rand = data.getElement('randomizable');
    if (rand) this.randomizable = rand.getTextString() === 'true';

    this.sliders = [];
    const childElems = data.getElements('bsbObject');
    while (childElems.hasMoreElements()) {
      const childElem = childElems.next();
      // A bank owns the resolution for all of its child sliders. Preserve the
      // child's raw value while loading so a stale/legacy child bdresolution
      // cannot quantize it before the bank resolution is applied below.
      const rawValueText = childElem.getTextString('value');
      const slider = new BSBVSlider();
      slider.loadFromXML(childElem);
      if (rawValueText !== null && rawValueText !== '') {
        const rawValue = parseFloat(rawValueText);
        if (Number.isFinite(rawValue)) slider.value = rawValue;
      }
      slider.resolutionDecimal = loadedResolution;
      slider.value = snapToResolutionJava(slider.value, this.minimum, this.maximum, loadedResolution);
      this.sliders.push(slider);
    }
    if (this.sliders.length === 0) {
      const slider = new BSBVSlider();
      slider.resolutionDecimal = loadedResolution;
      slider.value = snapToResolutionJava(slider.value, this.minimum, this.maximum, loadedResolution);
      this.sliders.push(slider);
    }
  }

  randomize(): void {
    if (!this.randomizable) return;
    for (const s of this.sliders) s.randomize();
  }

  get resolution(): number { return this.resolutionDecimal.doubleValue; }
  set resolution(value: number) {
    this.setResolutionText(parseLegacyBsbResolution(String(value)).canonicalText);
  }

  getResolutionText(): string { return this.resolutionDecimal.canonicalText; }
  setResolutionText(text: string): void {
    const next = parseExactBsbResolution(text);
    this.resolutionDecimal = next;
    for (const slider of this.sliders) {
      slider.resolutionDecimal = next;
      slider.value = snapToResolutionJava(slider.value, this.minimum, this.maximum, next);
    }
  }

  override deepCopy(): this {
    const copy = super.deepCopy();
    copy.resolutionDecimal = this.resolutionDecimal;
    return copy;
  }
}
