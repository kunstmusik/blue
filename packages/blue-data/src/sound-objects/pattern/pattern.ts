/**
 * Pattern — a single row/layer in the PatternObject step sequencer.
 * Mirrors the Java blue.soundObject.pattern.Pattern class.
 *
 * Each Pattern has a boolean values array (which steps are active),
 * a patternScore (Csound score text emitted for each active step),
 * and muted/solo flags.
 */
import { Element } from '../../serialization/xml-reader';
import { XmlLoadContext } from '../../serialization/xml-load';
import { checkRoot, checkShape, readText, readBoolean } from '../../utilities/xml';

export class Pattern {
  values: boolean[];
  patternName = 'pattern';
  patternScore = '';
  muted = false;
  solo = false;

  constructor(numSteps: number) {
    this.values = new Array(numSteps).fill(false);
  }

  static copyFrom(other: Pattern): Pattern {
    const p = new Pattern(other.values.length);
    p.values = [...other.values];
    p.patternName = other.patternName;
    p.patternScore = other.patternScore;
    p.muted = other.muted;
    p.solo = other.solo;
    return p;
  }

  // ─── XML Serialization ───

  saveAsXML(): Element {
    const elem = new Element('pattern');
    elem.addElement('patternName').setText(this.patternName);
    elem.addElement('patternScore').setText(this.patternScore);
    elem.addElement('muted').setText(this.muted.toString());
    elem.addElement('solo').setText(this.solo.toString());

    const buffer: string[] = [];
    for (const v of this.values) {
      buffer.push(v ? '1' : '0');
    }
    elem.addElement('values').setText(buffer.join(''));

    return elem;
  }

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): Pattern {
    checkRoot(data, 'pattern', context);
    checkShape(data, [], ['patternName', 'patternScore', 'muted', 'solo', 'values'], context);
    let name = '';
    let score = '';
    let muted = false;
    let solo = false;
    let values = new Array(16).fill(false);

    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      const nodeName = node.getName();
      switch (nodeName) {
        case 'patternName':
          name = readText(node, context);
          break;
        case 'patternScore':
          score = readText(node, context);
          break;
        case 'muted':
          muted = readBoolean(node, context);
          break;
        case 'solo':
          solo = readBoolean(node, context);
          break;
        case 'values': {
          const valStr = readText(node, context).trim();
          if (!/^[01]*$/.test(valStr))
            throw context.at(node).error({
              code: 'value',
              value: valStr,
              message: 'Pattern values must be a binary vector.',
              recovery: 'Use only zero and one step values.',
            });
          values = new Array(valStr.length).fill(false);
          for (let i = 0; i < valStr.length; i++) {
            values[i] = valStr[i] === '1';
          }
          break;
        }
      }
    }

    const p = new Pattern(values.length);
    p.patternName = name;
    p.patternScore = score;
    p.muted = muted;
    p.solo = solo;
    p.values = values;
    return p;
  }
}
