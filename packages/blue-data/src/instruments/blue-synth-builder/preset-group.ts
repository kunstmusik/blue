import { Element } from "../../serialization/xml-reader";
import type { BSBGraphicInterface } from "./bsb-graphic-interface";
import { Preset } from "./preset";

export class PresetGroup {
  presetGroupName = "Presets";
  subGroups: PresetGroup[] = [];
  presets: Preset[] = [];
  currentPresetUniqueId = "";
  currentPresetModified = false;

  getPresetGroupName(): string {
    return this.presetGroupName;
  }

  setPresetGroupName(name: string): void {
    this.presetGroupName = name;
  }

  getSubGroups(): PresetGroup[] {
    return [...this.subGroups];
  }

  getPresets(): Preset[] {
    return [...this.presets];
  }

  getCurrentPresetUniqueId(): string {
    return this.currentPresetUniqueId;
  }

  setCurrentPresetUniqueId(id: string): void {
    this.currentPresetUniqueId = id;
  }

  isCurrentPresetModified(): boolean {
    return this.currentPresetModified;
  }

  setCurrentPresetModified(modified: boolean): void {
    this.currentPresetModified = modified;
  }

  findPresetByUniqueId(uniqueId: string): Preset | null {
    for (const preset of this.presets) {
      if (preset.getUniqueId() === uniqueId) return preset;
    }
    for (const sub of this.subGroups) {
      const found = sub.findPresetByUniqueId(uniqueId);
      if (found) return found;
    }
    return null;
  }

  /**
   * Recursively synchronize every preset in this group tree with the
   * current BSB graphic interface.
   *
   * Mirrors Java `PresetsUtilities.synchronizePresets(PresetGroup, BSBGraphicInterface)`.
   */
  synchronizePresets(graphicInterface: BSBGraphicInterface): void {
    for (const subGroup of this.subGroups) {
      subGroup.synchronizePresets(graphicInterface);
    }
    for (const preset of this.presets) {
      preset.synchronizeWithInterface(graphicInterface);
    }
  }

  saveAsXML(): Element {
    const elem = new Element("presetGroup");
    elem.setAttribute("name", this.presetGroupName);
    if (this.currentPresetUniqueId) {
      elem.setAttribute("currentPresetUniqueId", this.currentPresetUniqueId);
    }
    elem.setAttribute("currentPresetModified", this.currentPresetModified.toString());
    for (const preset of this.presets) {
      elem.addElement(preset.saveAsXML());
    }
    for (const subGroup of this.subGroups) {
      elem.addElement(subGroup.saveAsXML());
    }
    return elem;
  }

  static loadFromXML(data: Element): PresetGroup {
    const group = new PresetGroup();
    group.presetGroupName = data.getAttribute("name") ?? "Presets";
    group.currentPresetUniqueId = data.getAttribute("currentPresetUniqueId") ?? "";
    const modified = data.getAttribute("currentPresetModified");
    group.currentPresetModified = modified === "true";

    const presetElems = data.getElements("preset");
    while (presetElems.hasMoreElements()) {
      group.presets.push(Preset.loadFromXML(presetElems.next()));
    }

    const subGroupElems = data.getElements("presetGroup");
    while (subGroupElems.hasMoreElements()) {
      group.subGroups.push(PresetGroup.loadFromXML(subGroupElems.next()));
    }

    return group;
  }

  private cloneForDuplicate(presetIdMap: Map<string, string>): PresetGroup {
    const copy = new PresetGroup();
    copy.presetGroupName = this.presetGroupName;
    copy.currentPresetUniqueId = this.currentPresetUniqueId;
    copy.currentPresetModified = this.currentPresetModified;
    copy.presets = this.presets.map((preset) => preset.deepCopy(presetIdMap));
    copy.subGroups = this.subGroups.map((group) => group.cloneForDuplicate(presetIdMap));
    return copy;
  }

  private rewriteCurrentPresetIds(presetIdMap: Map<string, string>): void {
    const nextCurrentId = presetIdMap.get(this.currentPresetUniqueId);
    if (nextCurrentId) {
      this.currentPresetUniqueId = nextCurrentId;
    }

    for (const group of this.subGroups) {
      group.rewriteCurrentPresetIds(presetIdMap);
    }
  }

  deepCopy(): PresetGroup {
    const presetIdMap = new Map<string, string>();
    const copy = this.cloneForDuplicate(presetIdMap);
    copy.rewriteCurrentPresetIds(presetIdMap);
    return copy;
  }
}
