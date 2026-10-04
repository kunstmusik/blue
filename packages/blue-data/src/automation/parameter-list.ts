/**
 * ParameterList — list of automation Parameters.
 * Mirrors the Java ParameterList class.
 */
import { XmlLoadContext } from '../serialization/xml-load';
import { checkRoot, checkShape } from '../utilities/xml';
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

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): ParameterList {
    checkRoot(data, ['parameterList', 'bsbParameterList'], context);
    checkShape(data, [], ['parameter'], context, ['parameter']);
    const identities = new Set<string>();
    const list = new ParameterList();
    const params = data.getElements('parameter');
    while (params.hasMoreElements()) {
      const node = params.next();
      const parameter = Parameter.loadFromXML(node, context);
      const identity = parameter.getUniqueId();
      if (identities.has(identity))
        throw context.at(node).error({
          code: 'conflict',
          member: '@uniqueId',
          value: identity,
          message: 'Duplicate parameter identity.',
          recovery: 'Assign distinct parameter identities.',
        });
      identities.add(identity);
      list.push(parameter);
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
