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

export class ProjectUpgrader_2_3_0 extends ProjectUpgrader {
  constructor() {
    super('2.3.0');
  }

  override performUpgrade(data: Element): boolean {
    let retVal = false;

    retVal = this.upgradeTempo(data);
    retVal = retVal || this.upgradeBetaPatternLayersGroup(data);

    return retVal;
  }

  /**
   * Move tempo/soundObject (old root PolyObject) into a Score element.
   */
  private upgradeTempo(data: Element): boolean {
    const soundObjectNode = data.getElement('soundObject');
    const tempoNode = data.getElement('tempo');

    if (!soundObjectNode && !tempoNode) {
      return false;
    }

    // Create score element
    const score = data.addElement('score');

    if (soundObjectNode) {
      // In the Java version, this extracts TimeState from the PolyObject
      // and adds the PolyObject as a child of Score.
      // For Phase 2, we just move the node; full TimeState extraction
      // happens during BlueData deserialization.
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
  private upgradeBetaPatternLayersGroup(data: Element): boolean {
    const scoreElement = data.getElement('score');
    if (!scoreElement) {
      return false;
    }

    let retVal = false;
    const nodes = scoreElement.getElements();

    for (const node of nodes) {
      const nodeName = node.getName();

      if (nodeName === 'patternsLayerGroup') {
        const patternLayerCount = node.getElements('patternLayer').size;

        if (patternLayerCount > 0) {
          retVal = true;
        }

        const patternsNode = node.addElement('patternLayers');
        moveChildElements(node, patternsNode, 'patternLayer');
      }
    }

    return retVal;
  }
}
