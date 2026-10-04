/**
 * UpgradeManager — orchestrates version migrations.
 * Mirrors the Java UpgradeManager class.
 *
 * On loading a .blue file, the UpgradeManager checks the file's version
 * against all registered upgraders and applies any that are needed.
 * Upgrades operate on raw XML before BlueData deserialization.
 */
import { Element } from '../serialization/xml-reader';
import { ProjectVersion } from './project-version';
import { ProjectUpgrader } from './upgrader';
import { ProjectUpgrader_2_1_10 } from './upgrades/upgrade-2.1.10';
import { ProjectUpgrader_2_3_0 } from './upgrades/upgrade-2.3.0';
import { migrateAudioLayersToTracks } from './migrate-audio-layers-to-tracks';
import { XmlLoadContext } from '../serialization/xml-load';
import {
  migrateProjectTimeContext,
  migrateProjectReferences,
} from './migrate-project-time-context';
import { migrateProjectPanning } from './migrate-project-panning';

export class UpgradeManager {
  private upgraders: ProjectUpgrader[] = [];
  private static instance: UpgradeManager | null = null;

  constructor() {
    // Register all upgraders in order
    this.upgraders.push(new ProjectUpgrader_2_1_10());
    this.upgraders.push(new ProjectUpgrader_2_3_0());
  }

  /** Get the singleton instance. */
  static getInstance(): UpgradeManager {
    if (!UpgradeManager.instance) {
      UpgradeManager.instance = new UpgradeManager();
    }
    return UpgradeManager.instance;
  }

  /**
   * Perform all necessary upgrades on the XML element.
   * Called before BlueData deserialization.
   *
   * @param element The root XML element (blueData element).
   */
  performUpgrades(element: Element, context = new XmlLoadContext(element)): void {
    const versionAttr = element.getAttribute('version');
    const versionString = versionAttr ?? '0.0.0';
    const version = ProjectVersion.parse(versionString);

    for (const upgrader of this.upgraders) {
      if (version.lessThan(upgrader.version)) {
        upgrader.performUpgrade(element, context);
      }
    }
    const unmigratedRootObject = element.getElement('soundObject');
    if (unmigratedRootObject) {
      const competesWithScore = element.getElement('score') !== null;
      throw context.at(unmigratedRootObject).error({
        code: competesWithScore ? 'conflict' : 'member',
        member: 'soundObject',
        message: competesWithScore
          ? 'Legacy root PolyObject competes with an existing Score.'
          : 'Root SoundObject was not converted by the versioned project migrations.',
        recovery: competesWithScore
          ? 'Combine the score content in a compatible historical editor before loading.'
          : 'Save the PolyObject inside the canonical Score structure in a compatible editor.',
      });
    }
    migrateProjectTimeContext(element, context);
    migrateAudioLayersToTracks(element, context);
    migrateProjectPanning(element, context);
    migrateProjectReferences(element, context);
  }
}
