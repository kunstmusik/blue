/**
 * ParameterList — list of automation Parameters.
 * Mirrors the Java ParameterList class.
 */
import { Parameter } from './parameter';
import { Element } from '../serialization/xml-reader';
import type { CopyMode } from '../deep-copyable';

export class ParameterList extends Array<Parameter> {
  saveAsXML(): Element {
    const elem = new Element('parameterList');
    for (const param of this) {
      elem.addElement(param.saveAsXML());
    }
    return elem;
  }

  static loadFromXML(data: Element): ParameterList {
    const list = new ParameterList();
    const params = data.getElements('parameter');
    while (params.hasMoreElements()) {
      list.push(Parameter.loadFromXML(params.next()));
    }
    return list;
  }

  deepCopy(mode: CopyMode = 'duplication'): ParameterList {
    const copy = new ParameterList();
    for (const parameter of this) {
      copy.push(parameter.deepCopy(mode) as Parameter);
    }
    return copy;
  }
}
