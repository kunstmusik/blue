/**
 * PatternData — boolean array pattern for PatternLayer.
 * Mirrors the Java PatternData class.
 *
 * PatternData stores which pattern steps are active (true = play, false = skip).
 * It auto-resizes in blocks of 16 when needed.
 *
 * The pattern is stored as a boolean array where each element represents
 * one "beat" (of patternBeatsLength duration). When generating CSD, the
 * containing SoundObject is repeated at each active step position.
 */
import { XmlLoadContext } from '../../serialization/xml-load';
import { checkRoot, readText } from '../../utilities/xml';
import { Element } from '../../serialization/xml-reader';

const BLOCK_SIZE = 16;

export class PatternData {
  private _patterns: boolean[] = new Array(BLOCK_SIZE).fill(false);
  private _maxSelected = -1;

  constructor(other?: PatternData) {
    if (other) {
      this._patterns = [...other._patterns];
      this._maxSelected = other._maxSelected;
    }
  }

  /** Check if a pattern step is active. */
  isPatternSet(index: number): boolean {
    if (index < 0 || index >= this._patterns.length) {
      return false;
    }
    return this._patterns[index];
  }

  /** Set a pattern step. Auto-resizes if needed. */
  setPattern(index: number, selected: boolean): void {
    if (index < 0 || this.isPatternSet(index) === selected) {
      return;
    }
    if (index >= this._patterns.length) {
      if (selected) {
        this.resizePatterns(index);
      } else {
        return;
      }
    }
    this._patterns[index] = selected;

    if (index >= this._maxSelected) {
      if (selected) {
        this._maxSelected = index;
      } else {
        this._maxSelected = this._calculateMaxSelected();
      }
    }
  }

  /** Get the total pattern array size. */
  getSize(): number {
    return this._patterns.length;
  }

  /** Get the highest active pattern index (-1 if none). */
  getMaxSelected(): number {
    return this._maxSelected;
  }

  /** Get all pattern steps as a boolean array. */
  getPatterns(): boolean[] {
    return [...this._patterns];
  }

  /** Calculate the highest active step index. */
  private _calculateMaxSelected(): number {
    for (let i = this._patterns.length - 1; i >= 0; i--) {
      if (this._patterns[i]) {
        return i;
      }
    }
    return -1;
  }

  /** Resize the pattern array to accommodate the given index (or shrink). */
  resizePatterns(index: number): void {
    const newSize = (Math.floor(index / BLOCK_SIZE) + 1) * BLOCK_SIZE;

    if (newSize === this._patterns.length) {
      return;
    }

    const newPatterns = new Array(newSize).fill(false);
    const length = Math.min(this._patterns.length, newPatterns.length);
    for (let i = 0; i < length; i++) {
      newPatterns[i] = this._patterns[i];
    }
    this._patterns = newPatterns;
  }

  // ─── XML Serialization ───

  saveAsXML(): Element {
    const elem = new Element('patternData');

    // Resize to max selected for efficiency
    const size =
      (Math.floor(Math.max(this._calculateMaxSelected(), 0) / BLOCK_SIZE) + 1) * BLOCK_SIZE;

    // Serialize as binary string: "101001..."
    const buffer: string[] = [];
    for (let index = 0; index < size; index++) {
      buffer.push(this._patterns[index] ? '1' : '0');
    }
    elem.setText(buffer.join(''));

    return elem;
  }

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): PatternData {
    checkRoot(data, 'patternData', context);
    const patternData = new PatternData();
    const valStr = readText(data, context);
    if (!/^[01]*$/.test(valStr))
      throw context.at(data).error({
        code: 'value',
        value: valStr,
        message: 'Pattern data must be a binary vector.',
        recovery: 'Supply only 0 and 1 characters.',
      });

    patternData._patterns = new Array(valStr.length).fill(false);

    for (let i = 0; i < valStr.length; i++) {
      patternData._patterns[i] = valStr.charAt(i) === '1';
    }

    patternData._maxSelected = patternData._calculateMaxSelected();

    return patternData;
  }
}
