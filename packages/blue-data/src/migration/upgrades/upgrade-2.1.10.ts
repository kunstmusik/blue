/**
 * ProjectUpgrader_2_1_10 — upgrades projects to version 2.1.10.
 * Changes: Parse 0dbfs from global orc and set properties in projectProperties node.
 * Mirrors the Java ProjectUpgrader_2_1_10 class.
 */
import { Element } from '../../serialization/xml-reader';
import { ProjectUpgrader } from '../upgrader';
import { stripSingleLineComments } from '../../utilities/text';
import { XmlLoadContext } from '../../serialization/xml-load';
import { ProjectProperties } from '../../project-properties';
import { checkShape, readBoolean, readText } from '../../utilities/xml';

export class ProjectUpgrader_2_1_10 extends ProjectUpgrader {
  constructor() {
    super('2.1.10');
  }

  override performUpgrade(data: Element, context = new XmlLoadContext(data)): boolean {
    const global = data.getElement('globalOrcSco');
    if (!global) return false;
    checkShape(global, [], ['globalOrc', 'globalSco'], context);
    const code = global.getElement('globalOrc');
    if (!code) return false;
    const text = readText(code, context);
    const remaining: string[] = [];
    const assignments: string[] = [];
    for (const line of text.split('\n')) {
      const assignment = /^\s*0dbfs\s*=\s*(.*)$/.exec(stripSingleLineComments(line));
      if (assignment) assignments.push(assignment[1].trim());
      else remaining.push(line);
    }
    if (assignments.length === 0) return false;
    if (!assignments[0] || assignments.some((value) => value !== assignments[0])) {
      throw context.at(code).error({
        code: 'conflict',
        member: '0dbfs',
        message: 'Empty or conflicting historical 0dbfs assignments.',
        recovery: 'Keep a single nonempty 0dbfs setting.',
      });
    }
    const props = data.getElement('projectProperties') ?? data.addElement('projectProperties');
    ProjectProperties.loadFromXML(props, context);
    for (const field of ['zeroDbFS', 'diskZeroDbFS']) {
      const existing = props.getElement(field);
      if (existing && readText(existing, context).trim() !== assignments[0]) {
        throw context.at(existing).error({
          code: 'conflict',
          member: field,
          value: existing.getTextString(),
          message: 'Project property conflicts with historical 0dbfs.',
          recovery: 'Make the project property and orchestra assignment agree.',
        });
      }
    }
    for (const field of ['useZeroDbFS', 'diskUseZeroDbFS']) {
      const existing = props.getElement(field);
      if (existing && !readBoolean(existing, context)) {
        throw context.at(existing).error({
          code: 'conflict',
          member: field,
          value: existing.getTextString(),
          message: 'Disabled 0dbfs property conflicts with an active historical assignment.',
          recovery: 'Resolve the enabled state in a compatible editor.',
        });
      }
    }
    for (const field of ['zeroDbFS', 'diskZeroDbFS', 'useZeroDbFS', 'diskUseZeroDbFS']) {
      if (props.hasElement(field)) continue;
      const generated = props.addElement(field);
      generated.setText(
        field.startsWith('use') || field.startsWith('diskUse') ? 'true' : assignments[0],
      );
      context.anchor(generated, code);
    }
    code.setText(remaining.join('\n'));
    return true;
  }
}
