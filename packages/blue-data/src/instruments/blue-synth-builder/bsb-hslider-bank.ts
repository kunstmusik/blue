import { XmlLoadContext } from '../../serialization/xml-load';
import { readBoolean } from '../../utilities/xml';
/**
 * BSBHSliderBank — bank of multiple horizontal sliders in one widget.
 * Mirrors the Java BSBHSliderBank class.
 */
import { Element } from '../../serialization/xml-reader';
import type { CopyMode } from '../../deep-copyable';
import { BSBWidget } from './bsb-widget';
import { BSBCompilationUnit } from './bsb-compilation-unit';
import { BSBHSlider } from './bsb-hslider';
import { Parameter } from '../../automation/parameter';
import { formatBlueNumber } from '../../utilities/number-format';
import { JavaDecimal } from '../../automation/java-decimal';
import {
  defaultBsbResolution,
  parseExactBsbResolution,
  parseLegacyBsbResolution,
} from './bsb-resolution';
import { snapToResolutionJava } from '../../automation/java-decimal';

export class BSBHSliderBank extends BSBWidget {
  /** Slider width in pixels. */
  sliderWidth = 150;
  /** Gap between adjacent sliders in pixels. */
  gap = 5;
  /** Exact Java-compatible decimal step used for value quantization. */
  resolutionDecimal: JavaDecimal = defaultBsbResolution();
  /** Whether the widget displays its current value. */
  valueDisplayEnabled = true;
  /** Whether this widget participates in value randomization. */
  randomizable = true;
  /** Sliders belonging to this horizontal slider bank, in stored order. */
  sliders: BSBHSlider[] = [new BSBHSlider()];

  /** Returns the number of sliders in the bank. */
  get numberOfSliders(): number {
    return this.sliders.length;
  }

  /** Sets the number of sliders in the bank. */
  set numberOfSliders(count: number) {
    while (this.sliders.length < count) {
      const slider = new BSBHSlider();
      slider.resolutionDecimal = this.resolutionDecimal;
      this.sliders.push(slider);
    }
    while (this.sliders.length > count) {
      this.sliders.pop();
    }
    this.syncSliderBounds();
  }

  /** Synchronizes the member sliders with the bank’s bounds and step size. */
  syncSliderBounds(): void {
    for (const slider of this.sliders) {
      slider.minimum = this.minimum;
      slider.maximum = this.maximum;
    }
  }

  override collectReplacements(unit: BSBCompilationUnit, parameters?: Parameter[]): void {
    for (let i = 0; i < this.sliders.length; i++) {
      const key = `${this.objectName}_${i}`;
      this.addCompilationReplacement(
        unit,
        key,
        formatBlueNumber(this.sliders[i].value),
        parameters,
      );
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

  /** Reconstructs the horizontal slider bank from its Blue XML element, using the supplied diagnostic context when provided. */
  loadFromXML(data: Element, context = new XmlLoadContext(data)): void {
    this.loadFromXMLCommon(data, context);
    const w = data.getTextString('sliderWidth');
    if (w) this.sliderWidth = parseInt(w, 10);
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
    if (vde) this.valueDisplayEnabled = readBoolean(vde, context);
    const rand = data.getElement('randomizable');
    if (rand) this.randomizable = readBoolean(rand, context);

    this.sliders = [];
    const childElems = data.getElements('bsbObject');
    while (childElems.hasMoreElements()) {
      const childElem = childElems.next();
      // A bank owns the resolution for all of its child sliders. Preserve the
      // child's raw value while loading so a stale/legacy child bdresolution
      // cannot quantize it before the bank resolution is applied below.
      const rawValueText = childElem.getTextString('value');
      const slider = new BSBHSlider();
      slider.loadFromXML(childElem, context);
      if (rawValueText !== null && rawValueText !== '') {
        const rawValue = parseFloat(rawValueText);
        if (Number.isFinite(rawValue)) slider.value = rawValue;
      }
      slider.minimum = this.minimum;
      slider.maximum = this.maximum;
      slider.resolutionDecimal = loadedResolution;
      slider.value = snapToResolutionJava(
        slider.value,
        this.minimum,
        this.maximum,
        loadedResolution,
      );
      this.sliders.push(slider);
    }
    if (this.sliders.length === 0) {
      const slider = new BSBHSlider();
      slider.minimum = this.minimum;
      slider.maximum = this.maximum;
      slider.resolutionDecimal = loadedResolution;
      slider.value = snapToResolutionJava(
        slider.value,
        this.minimum,
        this.maximum,
        loadedResolution,
      );
      this.sliders.push(slider);
    }
  }

  /** Picks a new horizontal slider bank value when randomization is enabled. */
  randomize(): void {
    if (!this.randomizable) return;
    for (const s of this.sliders) s.randomize();
  }

  /** Returns the numeric value step. */
  get resolution(): number {
    return this.resolutionDecimal.doubleValue;
  }
  /** Sets the numeric value step. */
  set resolution(value: number) {
    this.setResolutionText(parseLegacyBsbResolution(String(value)).canonicalText);
  }

  /** Returns the exact decimal text for the value step. */
  getResolutionText(): string {
    return this.resolutionDecimal.canonicalText;
  }
  /** Sets the exact decimal text for the value step. */
  setResolutionText(text: string): void {
    const next = parseExactBsbResolution(text);
    this.resolutionDecimal = next;
    this.syncSliderBounds();
    for (const slider of this.sliders) {
      slider.resolutionDecimal = next;
      slider.value = snapToResolutionJava(slider.value, this.minimum, this.maximum, next);
    }
  }

  override deepCopy(mode: CopyMode = 'duplication'): this {
    const copy = super.deepCopy(mode);
    copy.resolutionDecimal = this.resolutionDecimal;
    return copy;
  }
}
