/**
 * BSBXYController — 2D XY pad controller.
 * Mirrors the Java BSBXYController class.
 */
import { Element } from '../../serialization/xml-reader';
import { BSBWidget } from './bsb-widget';
import { BSBCompilationUnit } from './bsb-compilation-unit';
import { Parameter } from '../../automation/parameter';
import { formatBlueNumber } from '../../utilities/number-format';

export class BSBXYController extends BSBWidget {
  xValue = 0.5;
  yValue = 0.5;
  xMin = 0;
  xMax = 1;
  yMin = 0;
  yMax = 1;
  width = 100;
  height = 80;
  valueDisplayEnabled = true;
  randomizable = true;

  override getPresetValue(): string {
    return `ver2:${this.xValue}:${this.yValue}`;
  }

  override setPresetValue(val: string): void {
    const parts = val.split(':');

    let nextX = Number.NaN;
    let nextY = Number.NaN;

    if (parts.length === 2) {
      const relativeX = parseFloat(parts[0]);
      const relativeY = parseFloat(parts[1]);
      if (Number.isFinite(relativeX) && Number.isFinite(relativeY)) {
        nextX = relativeX * (this.xMax - this.xMin) + this.xMin;
        nextY = relativeY * (this.yMax - this.yMin) + this.yMin;
      }
    } else if (parts.length >= 3) {
      nextX = parseFloat(parts[1]);
      nextY = parseFloat(parts[2]);
    }

    if (Number.isFinite(nextX) && Number.isFinite(nextY)) {
      this.xValue = nextX;
      this.yValue = nextY;
    }
  }

  override collectReplacements(unit: BSBCompilationUnit, parameters?: Parameter[]): void {
    const xName = `${this.objectName}X`;
    const yName = `${this.objectName}Y`;
    this.addCompilationReplacement(unit, xName, formatBlueNumber(this.xValue), parameters);
    this.addCompilationReplacement(unit, yName, formatBlueNumber(this.yValue), parameters);
  }

  loadFromXML(data: Element): void {
    this.loadFromXMLCommon(data);
    const versionAttribute = data.getAttribute('version');
    const xv = data.getTextString('xValue');
    if (xv) this.xValue = parseFloat(xv);
    const yv = data.getTextString('yValue');
    if (yv) this.yValue = parseFloat(yv);
    const xmin = data.getTextString('xMin');
    if (xmin) this.xMin = parseFloat(xmin);
    const xmax = data.getTextString('xMax');
    if (xmax) this.xMax = parseFloat(xmax);
    const ymin = data.getTextString('yMin');
    if (ymin) this.yMin = parseFloat(ymin);
    const ymax = data.getTextString('yMax');
    if (ymax) this.yMax = parseFloat(ymax);
    const w = data.getTextString('width');
    if (w) this.width = parseInt(w, 10);
    const h = data.getTextString('height');
    if (h) this.height = parseInt(h, 10);
    const vde = data.getElement('valueDisplayEnabled');
    if (vde) this.valueDisplayEnabled = vde.getTextString() === 'true';
    const rand = data.getElement('randomizable');
    if (rand) this.randomizable = rand.getTextString() === 'true';

    if (versionAttribute === '1') {
      this.xValue = (this.xMax - this.xMin) * this.xValue + this.xMin;
      this.yValue = (this.yMax - this.yMin) * this.yValue + this.yMin;
    }
  }

  randomize(): void {
    if (!this.randomizable) return;
    this.xValue = this.xMin + Math.random() * (this.xMax - this.xMin);
    this.yValue = this.yMin + Math.random() * (this.yMax - this.yMin);
  }
}
