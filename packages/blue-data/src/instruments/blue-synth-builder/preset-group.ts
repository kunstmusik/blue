import { XmlLoadContext } from '../../serialization/xml-load';
import { checkRoot, checkShape, parseXmlBoolean } from '../../utilities/xml';
import { Element } from '../../serialization/xml-reader';
import type { CopyMode } from '../../deep-copyable';
import type { BSBGraphicInterface } from './bsb-graphic-interface';
import { Preset } from './preset';

/** Hierarchical collection of BlueSynthBuilder presets with selection and dirty-state tracking. */
export class PresetGroup {
  /** Display name of this preset group. */
  presetGroupName = 'Presets';
  /** Child preset groups belonging to this preset group, in stored order. */
  subGroups: PresetGroup[] = [];
  /** Presets belonging to this preset group, in stored order. */
  presets: Preset[] = [];
  /** Identifier of the currently selected preset. */
  currentPresetUniqueId = '';
  /** Whether the selected preset has unsaved value changes. */
  currentPresetModified = false;
  private _childOrder: Array<Preset | PresetGroup> = [];

  /** Returns the preset group name stored on the preset group. */
  getPresetGroupName(): string {
    return this.presetGroupName;
  }

  /** Sets the preset group name stored on the preset group. */
  setPresetGroupName(name: string): void {
    this.presetGroupName = name;
  }

  /** Returns a shallow snapshot of direct child groups. */
  getSubGroups(): PresetGroup[] {
    return [...this.subGroups];
  }

  /** Returns a shallow snapshot of the presets directly in this group. */
  getPresets(): Preset[] {
    return [...this.presets];
  }

  /** Returns the identifier of the currently selected preset. */
  getCurrentPresetUniqueId(): string {
    return this.currentPresetUniqueId;
  }

  /** Sets the identifier of the currently selected preset. */
  setCurrentPresetUniqueId(id: string): void {
    this.currentPresetUniqueId = id;
  }

  /** Reports whether the selected preset has unsaved changes. */
  isCurrentPresetModified(): boolean {
    return this.currentPresetModified;
  }

  /** Sets the whether the selected preset has unsaved value changes. */
  setCurrentPresetModified(modified: boolean): void {
    this.currentPresetModified = modified;
  }

  /** Searches this group and its descendants for the first preset with the given ID, or returns null. */
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

  /** Commit an authored reorder while preserving historical preset/group interleaving. */
  updateChildOrder(): void {
    const presets = [...this.presets],
      groups = [...this.subGroups];
    const children = new Set<Preset | PresetGroup>([...presets, ...groups]);
    this._childOrder = this._childOrder
      .filter((child) => children.has(child))
      .map((child) => (child instanceof Preset ? presets.shift()! : groups.shift()!));
    this._childOrder.push(...presets, ...groups);
  }

  /** Serializes the preset group and its persisted settings to a new Blue XML element. */
  saveAsXML(): Element {
    const elem = new Element('presetGroup');
    elem.setAttribute('name', this.presetGroupName);
    if (this.currentPresetUniqueId) {
      elem.setAttribute('currentPresetUniqueId', this.currentPresetUniqueId);
    }
    elem.setAttribute('currentPresetModified', this.currentPresetModified.toString());
    const children = [...this.presets, ...this.subGroups];
    for (const child of [
      ...this._childOrder.filter((item) => children.includes(item)),
      ...children.filter((item) => !this._childOrder.includes(item)),
    ])
      elem.addElement(child.saveAsXML());

    return elem;
  }

  /** Reconstructs the preset group from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(data: Element, context = new XmlLoadContext(data)): PresetGroup {
    checkRoot(data, 'presetGroup', context);
    const read = (node: Element): PresetGroup => {
      checkShape(
        node,
        ['name', 'currentPresetUniqueId', 'currentPresetModified'],
        ['preset', 'presetGroup'],
        context,
        ['preset', 'presetGroup'],
      );
      const group = new PresetGroup();
      group.presetGroupName = node.getAttribute('name') ?? 'Presets';
      group.currentPresetUniqueId = node.getAttribute('currentPresetUniqueId') ?? '';
      const modified = node.getAttribute('currentPresetModified');
      group.currentPresetModified =
        modified === null
          ? false
          : parseXmlBoolean(modified, context.at(node), '@currentPresetModified');
      for (const child of node.getElements()) {
        const value =
          child.getName() === 'preset' ? Preset.loadFromXML(child, context) : read(child);
        if (value instanceof Preset) group.presets.push(value);
        else group.subGroups.push(value);
        group._childOrder.push(value);
      }
      return group;
    };
    const root = read(data);
    const ids = new Set<string>();
    const visit = (group: PresetGroup): void => {
      for (const preset of group.presets) {
        if (ids.has(preset.uniqueId))
          throw context.at(data).error({
            code: 'conflict',
            member: '@uniqueId',
            value: preset.uniqueId,
            message: 'Duplicate preset identity.',
            recovery: 'Use unique preset identities.',
          });
        ids.add(preset.uniqueId);
      }
      for (const child of group.subGroups) visit(child);
    };
    visit(root);
    const validate = (group: PresetGroup): void => {
      if (group.currentPresetUniqueId && !ids.has(group.currentPresetUniqueId))
        throw context.at(data).error({
          code: 'reference',
          member: '@currentPresetUniqueId',
          value: group.currentPresetUniqueId,
          message: 'Selected preset reference does not exist.',
          recovery: 'Select a preset in this tree or clear the reference.',
        });
      for (const child of group.subGroups) validate(child);
    };
    validate(root);
    return root;
  }

  private cloneForDuplicate(
    presetIdMap: Map<string, string>,
    mode: CopyMode = 'duplication',
  ): PresetGroup {
    const copy = new PresetGroup();
    copy.presetGroupName = this.presetGroupName;
    copy.currentPresetUniqueId = this.currentPresetUniqueId;
    copy.currentPresetModified = this.currentPresetModified;
    copy.presets = this.presets.map((preset) => preset.deepCopy(presetIdMap, mode));
    copy.subGroups = this.subGroups.map((group) => group.cloneForDuplicate(presetIdMap, mode));
    copy._childOrder = this._childOrder
      .map((child) =>
        child instanceof Preset
          ? copy.presets[this.presets.indexOf(child)]!
          : copy.subGroups[this.subGroups.indexOf(child)]!,
      )
      .filter(Boolean);
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

  /** Copies the preset group and its editable state. The copy mode controls which identities are retained. */
  deepCopy(mode: CopyMode = 'duplication'): PresetGroup {
    if (mode === 'history') {
      const copy = new PresetGroup();
      copy.presetGroupName = this.presetGroupName;
      copy.currentPresetUniqueId = this.currentPresetUniqueId;
      copy.currentPresetModified = this.currentPresetModified;
      copy.presets = this.presets.map((preset) => preset.deepCopy(undefined, 'history'));
      copy.subGroups = this.subGroups.map((group) => group.deepCopy('history'));
      copy._childOrder = this._childOrder
        .map((child) =>
          child instanceof Preset
            ? copy.presets[this.presets.indexOf(child)]!
            : copy.subGroups[this.subGroups.indexOf(child)]!,
        )
        .filter(Boolean);
      return copy;
    }
    const presetIdMap = new Map<string, string>();
    const copy = this.cloneForDuplicate(presetIdMap, 'duplication');
    copy.rewriteCurrentPresetIds(presetIdMap);
    return copy;
  }
}
