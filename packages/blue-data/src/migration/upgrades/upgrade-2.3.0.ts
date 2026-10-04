/**
 * ProjectUpgrader_2_3_0 — upgrades projects to version 2.3.0.
 * Changes:
 *   - Root PolyObject moved as sub-object of Score
 *   - Tempo object moved to sub-object of Score
 *   - Time values in PolyObject encapsulated into TimeState object
 *   - Fix beta patternLayers group structure (patternLayer children moved under patternLayers)
 * Mirrors the Java ProjectUpgrader_2_3_0 class.
 */
import { Element } from '../../serialization/xml-reader';
import { ProjectUpgrader } from '../upgrader';
import { moveChildElements } from '../xml-migration-utils';
import { XmlLoadContext } from '../../serialization/xml-load';
import { readText } from '../../utilities/xml';

export class ProjectUpgrader_2_3_0 extends ProjectUpgrader {
  constructor() {
    super('2.3.0');
  }

  override performUpgrade(data: Element, context = new XmlLoadContext(data)): boolean {
    const moved = this.upgradeTempo(data, context);
    const nested = this.upgradeBetaPatternLayersGroup(data, context);
    return moved || nested;
  }

  /**
   * Move tempo/soundObject (old root PolyObject) into a Score element.
   */
  private upgradeTempo(data: Element, context: XmlLoadContext): boolean {
    const soundObjectNode = data.getElement('soundObject');
    const tempoNode = data.getElement('tempo');

    if (!soundObjectNode && !tempoNode) {
      return false;
    }

    const existingScore = data.getElement('score');
    if (soundObjectNode && existingScore)
      throw context.at(soundObjectNode).error({
        code: 'conflict',
        message: 'Legacy root PolyObject competes with an existing Score.',
        recovery: 'Combine the score content in a compatible historical editor before loading.',
      });
    const score = existingScore ?? data.addElement('score');
    if (!existingScore) context.anchor(score, soundObjectNode ?? tempoNode!);

    if (soundObjectNode) {
      const type = soundObjectNode.getAttribute('type');
      if (type !== 'blue.soundObject.PolyObject' && type !== 'PolyObject')
        throw context.at(soundObjectNode).error({
          code: 'type',
          member: '@type',
          value: type ?? '',
          message: 'Legacy root soundObject must be a PolyObject.',
          recovery: 'Convert the root to the supported Score structure.',
        });
      const state = score.addElement('timeState');
      context.anchor(state, soundObjectNode);
      for (const field of [
        'pixelSecond',
        'zoomIterations',
        'snapEnabled',
        'snapValue',
        'timeDisplay',
        'timeUnit',
      ]) {
        const fields = soundObjectNode.getElements(field).toArray();
        if (fields.length > 1)
          throw context.at(fields[1]).error({
            code: 'cardinality',
            member: field,
            message: `Duplicate old timing field ${field}.`,
            recovery: 'Keep one timing value.',
          });
        if (fields[0]) {
          readText(fields[0], context);
          state.addElement(soundObjectNode.removeElement(field)!);
        }
      }
      data.removeElement('soundObject');
      score.addElement(soundObjectNode);
    }

    if (tempoNode) {
      data.removeElement('tempo');
      score.addElement(tempoNode);
    }

    return true;
  }

  /**
   * Fix beta patternLayers group structure: move patternLayer children
   * from directly under patternsLayerGroup into a patternLayers sub-element.
   */
  private upgradeBetaPatternLayersGroup(data: Element, context: XmlLoadContext): boolean {
    const scoreElement = data.getElement('score');
    if (!scoreElement) {
      return false;
    }

    let retVal = false;
    const nodes = scoreElement.getElements();

    for (const node of nodes) {
      const nodeName = node.getName();

      if (nodeName === 'patternsLayerGroup') {
        const containers = node.getElements('patternLayers').toArray();
        if (containers.length > 1)
          throw context.at(containers[1]).error({
            code: 'cardinality',
            member: 'patternLayers',
            message: 'Duplicate pattern layer container.',
            recovery: 'Keep one patternLayers container.',
          });
        if (node.getElements('patternLayer').size === 0) continue;
        if (containers[0]?.getElements().size)
          throw context.at(node).error({
            code: 'conflict',
            message: 'Direct beta pattern layers compete with a populated current container.',
            recovery: 'Choose one unambiguous pattern layer sequence.',
          });
        const patternsNode = containers[0] ?? node.addElement('patternLayers');
        if (!containers[0]) context.anchor(patternsNode, node);
        moveChildElements(node, patternsNode, 'patternLayer');
        retVal = true;
      }
    }

    return retVal;
  }
}
